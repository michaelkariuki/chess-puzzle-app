import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import type { Piece as PieceModel, Square as SquareName } from '@/src/chess/types';
import { Piece } from './Piece';

/** Highlight overlays. Scheme-independent — they sit on top of squares. */
export const HIGHLIGHT = {
  selected: 'rgba(255, 214, 0, 0.55)',
  lastMove: 'rgba(255, 214, 0, 0.32)',
  wrong: 'rgba(220, 53, 69, 0.62)',
  hint: 'rgba(66, 133, 244, 0.55)',
  legalDot: 'rgba(0, 0, 0, 0.22)',
  captureRing: 'rgba(0, 0, 0, 0.22)',
} as const;

const HIGHLIGHT_FADE_MS = 140;
const DOT_POP_MS = 110;

interface Props {
  name: SquareName;
  piece: PieceModel | null;
  isLight: boolean;
  size: number;
  lightColor: string;
  darkColor: string;
  animate: boolean;
  selected: boolean;
  isLastMove: boolean;
  isWrong: boolean;
  isHinted: boolean;
  isLegalTarget: boolean;
  onPress: (square: SquareName) => void;
}

function SquareComponent({
  name,
  piece,
  isLight,
  size,
  lightColor,
  darkColor,
  animate,
  selected,
  isLastMove,
  isWrong,
  isHinted,
  isLegalTarget,
  onPress,
}: Props) {
  // Ordered by urgency: a wrong-move flash beats everything.
  const overlay = isWrong
    ? HIGHLIGHT.wrong
    : selected
      ? HIGHLIGHT.selected
      : isHinted
        ? HIGHLIGHT.hint
        : isLastMove
          ? HIGHLIGHT.lastMove
          : null;

  return (
    <Pressable
      onPress={() => onPress(name)}
      style={[
        styles.square,
        { width: size, height: size, backgroundColor: isLight ? lightColor : darkColor },
      ]}
      accessibilityRole="button"
      accessibilityLabel={piece ? `${name}, ${piece.color}${piece.type}` : name}
    >
      {overlay ? (
        <Animated.View
          // Keyed by colour so switching highlight type re-runs the fade
          // rather than snapping between tints.
          key={overlay}
          entering={animate ? FadeIn.duration(HIGHLIGHT_FADE_MS) : undefined}
          exiting={animate ? FadeOut.duration(HIGHLIGHT_FADE_MS) : undefined}
          style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]}
        />
      ) : null}

      {piece ? <Piece piece={piece} size={size} /> : null}

      {isLegalTarget && !piece ? (
        <Animated.View
          entering={animate ? ZoomIn.duration(DOT_POP_MS) : undefined}
          style={[
            styles.dot,
            { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 },
          ]}
        />
      ) : null}

      {isLegalTarget && piece ? (
        <Animated.View
          entering={animate ? FadeIn.duration(DOT_POP_MS) : undefined}
          style={[
            StyleSheet.absoluteFill,
            styles.captureRing,
            { borderWidth: size * 0.07, borderRadius: size / 2 },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  square: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', backgroundColor: HIGHLIGHT.legalDot },
  captureRing: { borderColor: HIGHLIGHT.captureRing },
});

export const Square = React.memo(SquareComponent);
