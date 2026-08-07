/**
 * UCI move parsing.
 *
 * Lichess puzzle solutions are UCI strings ('e4g5'), not SAN ('Ng5').
 * chess.js wants {from, to, promotion}, so every solution move has to be
 * sliced apart before it can be played.
 */

import type { Square, Uci } from './types';

export interface ParsedMove {
  from: Square;
  to: Square;
  /** Present only for promotions: the piece promoted to, lowercase. */
  promotion?: 'q' | 'r' | 'b' | 'n';
}

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/** Parse a UCI string. Returns null if it isn't well-formed. */
export function parseUci(uci: Uci): ParsedMove | null {
  const m = UCI_RE.exec(uci);
  if (!m) return null;
  const [, from, to, promotion] = m;
  return promotion
    ? { from: from as Square, to: to as Square, promotion: promotion as ParsedMove['promotion'] }
    : { from: from as Square, to: to as Square };
}

/** Build a UCI string from its parts. */
export function toUci(from: Square, to: Square, promotion?: string): Uci {
  return promotion ? `${from}${to}${promotion.toLowerCase()}` : `${from}${to}`;
}

/**
 * Compare a played move against a solution move.
 *
 * This compares the *full* UCI string on purpose. Comparing only from+to would
 * accept a queen promotion where the puzzle's solution is an underpromotion to
 * knight — a real class of tactic (e.g. promoting with check or to fork).
 */
export function movesMatch(played: Uci, expected: Uci): boolean {
  return played === expected;
}
