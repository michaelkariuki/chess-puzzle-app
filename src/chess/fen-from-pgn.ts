/**
 * Deriving a puzzle's starting position from the game PGN.
 *
 * `GET /api/puzzle/daily` includes a `fen` on the puzzle object, but
 * `GET /api/puzzle/next` — our primary source — does NOT. It gives the whole
 * game PGN plus an `initialPly`, and the position has to be replayed out of
 * them. Missing this yields puzzle records with no position at all, which fail
 * only at render time.
 *
 * Semantics, validated against puzzle hXKWW (which carries pgn, initialPly AND
 * fen, so the derivation can be checked against a known answer):
 * `initialPly` is the 0-indexed ply of the LAST move played — the move that
 * sets up the puzzle. So the position is the result of replaying plies
 * 0..initialPly inclusive.
 *
 * Lichess normalises the halfmove/fullmove counters on its own `fen` field to
 * `1 1`; the replayed position keeps the true counters. The piece placement,
 * side to move, castling rights and en-passant square are identical, and
 * nothing in a puzzle depends on the counters.
 */

import { Chess } from 'chess.js';

export interface DerivedPosition {
  fen: string;
  /** UCI of the setup move, for highlighting. */
  lastMove?: string;
}

export function positionFromPgn(pgn: string, initialPly: number): DerivedPosition | null {
  if (!pgn || !Number.isInteger(initialPly) || initialPly < 0) return null;

  let history;
  try {
    const full = new Chess();
    full.loadPgn(pgn);
    history = full.history({ verbose: true });
  } catch {
    return null;
  }

  if (initialPly >= history.length) return null;

  const board = new Chess();
  try {
    for (let i = 0; i <= initialPly; i++) {
      board.move(history[i].san);
    }
  } catch {
    return null;
  }

  return { fen: board.fen(), lastMove: history[initialPly].lan };
}
