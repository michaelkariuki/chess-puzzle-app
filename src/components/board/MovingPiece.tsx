import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { squareToXY } from '@/src/chess/board-geometry';
import type { Piece as PieceModel, Square as SquareName } from '@/src/chess/types';
import { Piece } from './Piece';

export const SLIDE_DURATION_MS = 190;

interface Props {
  piece: PieceModel;
  from: SquareName;
  to: SquareName;
  orientation: 'w' | 'b';
  squareSize: number;
  onComplete: () => void;
}

/**
 * A single piece sliding between squares, drawn above the grid.
 *
 * The grid itself renders the destination square empty for the duration, so
 * the piece appears to travel rather than teleport. Position comes from
 * `squareToXY`, which is unit-tested as the exact inverse of the grid's own
 * coordinate mapping — if those two disagreed the piece would land off-square.
 */
export function MovingPiece({
  piece,
  from,
  to,
  orientation,
  squareSize,
  onComplete,
}: Props) {
  const start = squareToXY(orientation, from, squareSize);
  const end = squareToXY(orientation, to, squareSize);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: SLIDE_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onComplete)();
      },
    );
    // Re-run whenever the move changes, not just on mount.
  }, [from, to, progress, onComplete]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: start.x + (end.x - start.x) * progress.value },
      { translateY: start.y + (end.y - start.y) * progress.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { width: squareSize, height: squareSize }, style]}
    >
      <Piece piece={piece} size={squareSize} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
