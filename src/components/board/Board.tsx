import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  cellCoords,
  displayFiles,
  displayRanks,
  isLightSquare,
  squareName,
} from '@/src/chess/board-geometry';
import {
  boardSquares,
  isPromotion,
  legalDestinations,
  type SessionState,
} from '@/src/chess/puzzle-session';
import type { Square as SquareName } from '@/src/chess/types';
import { useAppTheme } from '@/src/theme/use-app-theme';
import { MovingPiece } from './MovingPiece';
import { PromotionPicker } from './PromotionPicker';
import { Square } from './Square';
import { useMoveAnimation } from './use-move-animation';

/** Gutter reserved for rank/file labels around the board. */
const COORD_GUTTER = 16;
/** How far the board jolts sideways when a wrong move is played. */
const SHAKE_DISTANCE = 9;

interface Props {
  session: SessionState;
  orientation: 'w' | 'b';
  size: number;
  showLegalMoves: boolean;
  animate?: boolean;
  hintSquares?: { from: SquareName; to?: SquareName } | null;
  onMove: (from: SquareName, to: SquareName, promotion?: string) => void;
}

export function Board({
  session,
  orientation,
  size,
  showLegalMoves,
  animate = true,
  hintSquares,
  onMove,
}: Props) {
  const c = useAppTheme();
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: SquareName;
    to: SquareName;
  } | null>(null);

  const boardSize = size - COORD_GUTTER;
  const squareSize = boardSize / 8;

  const rows = useMemo(() => boardSquares(session.fen), [session.fen]);
  const orderedRows = useMemo(
    () => (orientation === 'w' ? rows : [...rows].reverse().map((r) => [...r].reverse())),
    [rows, orientation],
  );

  const { sliding, clear: clearSlide } = useMoveAnimation(
    session.fen,
    session.lastMove,
    animate,
  );

  // Shake the board on a wrong move — the red square flash alone is easy to
  // miss, and the motion reads instantly as "no".
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!animate || session.status !== 'wrong') return;
    shake.value = withSequence(
      withTiming(-SHAKE_DISTANCE, { duration: 45 }),
      withTiming(SHAKE_DISTANCE, { duration: 55 }),
      withTiming(-SHAKE_DISTANCE * 0.55, { duration: 50 }),
      withTiming(0, { duration: 55, easing: Easing.out(Easing.quad) }),
    );
  }, [session.status, session.wrongAttempts, animate, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const legalTargets = useMemo(
    () => (selected && showLegalMoves ? legalDestinations(session, selected) : []),
    [selected, session, showLegalMoves],
  );

  // Deselect when the board changes underneath us (opponent reply, new puzzle).
  const fenRef = React.useRef(session.fen);
  if (fenRef.current !== session.fen) {
    fenRef.current = session.fen;
    if (selected) setSelected(null);
  }

  const handlePress = useCallback(
    (square: SquareName) => {
      if (session.locked) return;

      if (selected && square !== selected) {
        const isLegalDestination = legalDestinations(session, selected).includes(square);

        // Tapping another of your own pieces re-selects rather than failing.
        if (!isLegalDestination && legalDestinations(session, square).length > 0) {
          setSelected(square);
          return;
        }

        if (isPromotion(session, selected, square)) {
          setPendingPromotion({ from: selected, to: square });
          setSelected(null);
          return;
        }
        onMove(selected, square);
        setSelected(null);
        return;
      }

      if (selected === square) {
        setSelected(null);
        return;
      }

      setSelected(legalDestinations(session, square).length > 0 ? square : null);
    },
    [selected, session, onMove],
  );

  const handlePromotionChoice = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion) return;
      onMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
    },
    [pendingPromotion, onMove],
  );

  const files = displayFiles(orientation);
  const ranks = displayRanks(orientation);

  return (
    <View style={{ width: size }}>
      <View style={styles.boardRow}>
        <View style={{ width: COORD_GUTTER }}>
          {ranks.map((r) => (
            <View key={r} style={[styles.rankCell, { height: squareSize }]}>
              <Text style={[styles.coordText, { color: c.boardCoord }]}>{r}</Text>
            </View>
          ))}
        </View>

        <Animated.View
          style={[
            styles.board,
            { width: boardSize, height: boardSize, borderColor: c.border },
            shakeStyle,
          ]}
        >
          {orderedRows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((cell, colIdx) => {
                const { rank, fileIndex } = cellCoords(orientation, rowIdx, colIdx);
                const name = (cell?.square ?? squareName(fileIndex, rank)) as SquareName;

                // Hide the landed piece while its copy slides in on the overlay.
                const hiddenForSlide = sliding?.to === name;

                return (
                  <Square
                    key={name}
                    name={name}
                    piece={hiddenForSlide ? null : (cell?.piece ?? null)}
                    isLight={isLightSquare(fileIndex, rank)}
                    size={squareSize}
                    lightColor={c.boardLight}
                    darkColor={c.boardDark}
                    animate={animate}
                    selected={selected === name}
                    isLastMove={
                      session.lastMove?.from === name || session.lastMove?.to === name
                    }
                    isWrong={
                      session.wrongMove?.from === name || session.wrongMove?.to === name
                    }
                    isHinted={hintSquares?.from === name || hintSquares?.to === name}
                    isLegalTarget={legalTargets.includes(name)}
                    onPress={handlePress}
                  />
                );
              })}
            </View>
          ))}

          {sliding ? (
            <MovingPiece
              key={sliding.key}
              piece={sliding.piece}
              from={sliding.from}
              to={sliding.to}
              orientation={orientation}
              squareSize={squareSize}
              onComplete={clearSlide}
            />
          ) : null}
        </Animated.View>
      </View>

      <View style={[styles.fileRow, { paddingLeft: COORD_GUTTER }]}>
        {files.map((f) => (
          <View key={f} style={{ width: squareSize, alignItems: 'center' }}>
            <Text style={[styles.coordText, { color: c.boardCoord }]}>{f}</Text>
          </View>
        ))}
      </View>

      {pendingPromotion ? (
        <PromotionPicker
          color={session.turn}
          onChoose={handlePromotionChoice}
          onCancel={() => setPendingPromotion(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  boardRow: { flexDirection: 'row' },
  board: {
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  row: { flexDirection: 'row' },
  rankCell: { alignItems: 'center', justifyContent: 'center' },
  fileRow: { flexDirection: 'row', paddingTop: 3 },
  coordText: { fontSize: 10, fontWeight: '600' },
});
