import { Chess } from 'chess.js';

import { positionFromPgn } from './fen-from-pgn';

/**
 * Puzzle hXKWW, fetched live 2026-08-07. It is the useful case because it
 * carries pgn, initialPly AND fen — so the derivation can be checked against
 * Lichess's own answer.
 */
const PGN =
  'e4 g6 d4 Nf6 Nc3 d5 e5 Ne4 Nxe4 dxe4 c3 Bg7 Ne2 O-O Ng3 c5 Nxe4 cxd4 cxd4 ' +
  'Qb6 b3 Rd8 Be3 Bxe5 Bc4 Bxd4 O-O Bxe3 Qf3 Bd4 Qxf7+ Kh8 Rad1 Nc6';
const INITIAL_PLY = 33;
const LICHESS_FEN = 'r1br3k/pp2pQ1p/1qn3p1/8/2BbN3/1P6/P4PPP/3R1RK1 w - - 1 1';

/** Compare only the parts of a FEN a puzzle depends on. */
function positionOnly(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

describe('positionFromPgn', () => {
  it('reproduces the position Lichess reports', () => {
    const derived = positionFromPgn(PGN, INITIAL_PLY);
    expect(derived).not.toBeNull();
    expect(positionOnly(derived!.fen)).toBe(positionOnly(LICHESS_FEN));
  });

  it('recovers the setup move for highlighting', () => {
    expect(positionFromPgn(PGN, INITIAL_PLY)!.lastMove).toBe('b8c6');
  });

  it('produces a position the solution is actually legal in', () => {
    // The whole point: the derived FEN must accept the puzzle's first move.
    const { fen } = positionFromPgn(PGN, INITIAL_PLY)!;
    const chess = new Chess(fen);
    expect(() => chess.move({ from: 'e4', to: 'g5' })).not.toThrow();
  });

  it('leaves the correct side to move', () => {
    const { fen } = positionFromPgn(PGN, INITIAL_PLY)!;
    expect(new Chess(fen).turn()).toBe('w');
  });

  it('returns null when initialPly is past the end of the game', () => {
    expect(positionFromPgn(PGN, 999)).toBeNull();
  });

  it('returns null on unusable input', () => {
    expect(positionFromPgn('', 5)).toBeNull();
    expect(positionFromPgn(PGN, -1)).toBeNull();
  });
});
