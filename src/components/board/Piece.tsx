import React from 'react';
import { SvgXml } from 'react-native-svg';

import type { Piece as PieceModel, PieceCode } from '@/src/chess/types';
import { PIECE_SVG } from './pieces.generated';

/** chess.js gives {type:'n', color:'w'}; assets are keyed 'wN'. */
export function pieceCode(piece: PieceModel): PieceCode {
  return `${piece.color}${piece.type.toUpperCase()}` as PieceCode;
}

interface Props {
  piece: PieceModel;
  size: number;
}

function PieceComponent({ piece, size }: Props) {
  return <SvgXml xml={PIECE_SVG[pieceCode(piece)]} width={size} height={size} />;
}

/**
 * Memoized: a board re-render moves at most two pieces, so re-rendering the
 * other 30 SVGs on every move is pure waste.
 */
export const Piece = React.memo(
  PieceComponent,
  (a, b) =>
    a.size === b.size && a.piece.type === b.piece.type && a.piece.color === b.piece.color,
);
