import { useEffect, useRef, useState } from 'react';

import { boardSquares } from '@/src/chess/puzzle-session';
import type { Piece as PieceModel, Square as SquareName } from '@/src/chess/types';

export interface SlidingMove {
  piece: PieceModel;
  from: SquareName;
  to: SquareName;
  /** Distinguishes consecutive moves so the animation restarts. */
  key: string;
}

function pieceAt(fen: string, square: SquareName): PieceModel | null {
  for (const row of boardSquares(fen)) {
    for (const cell of row) {
      if (cell?.square === square) return cell.piece;
    }
  }
  return null;
}

/**
 * Detects a move by watching the FEN and the session's `lastMove`, and reports
 * the piece that should slide.
 *
 * Deriving this from board state rather than threading it through the reducer
 * keeps the animation entirely in the view layer — the solve machine stays
 * pure and testable, and animation has no way to affect game logic.
 */
export function useMoveAnimation(
  fen: string,
  lastMove: { from: SquareName; to: SquareName } | null,
  enabled: boolean,
): { sliding: SlidingMove | null; clear: () => void } {
  const [sliding, setSliding] = useState<SlidingMove | null>(null);
  const prevFen = useRef(fen);
  const prevMoveKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !lastMove) {
      prevFen.current = fen;
      return;
    }

    const moveKey = `${lastMove.from}${lastMove.to}:${fen}`;

    // Only animate when the position actually changed. Re-renders that leave
    // the FEN alone (selection, hints) must not retrigger a slide.
    if (prevFen.current === fen || prevMoveKey.current === moveKey) {
      prevFen.current = fen;
      return;
    }

    const landed = pieceAt(fen, lastMove.to);
    prevFen.current = fen;
    prevMoveKey.current = moveKey;

    if (landed) {
      setSliding({ piece: landed, from: lastMove.from, to: lastMove.to, key: moveKey });
    }
  }, [fen, lastMove, enabled]);

  return {
    sliding,
    clear: () => setSliding(null),
  };
}
