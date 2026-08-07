import { Chess } from 'chess.js';

import {
  applyOpponentReply,
  beginPuzzle,
  clearMoveMapCache,
  legalMoveMap,
  movableSquares,
  clearWrongMove,
  createSession,
  giveUp,
  isPromotion,
  legalDestinations,
  attemptsRemaining,
  MAX_WRONG_ATTEMPTS,
  movesRemaining,
  outcomeOf,
  playMove,
  restart,
  solverColor,
  takeHint,
} from './puzzle-session';
import { UNLIMITED_ATTEMPTS, type Puzzle } from './types';

/**
 * Real Lichess puzzle hXKWW, fetched live on 2026-08-07. A 5-ply smothered
 * mate: White plays plies 0, 2, 4; Black's replies are plies 1 and 3.
 */
const REAL_PUZZLE: Puzzle = {
  id: 'hXKWW',
  fen: 'r1br3k/pp2pQ1p/1qn3p1/8/2BbN3/1P6/P4PPP/3R1RK1 w - - 1 1',
  solution: ['e4g5', 'd4g7', 'f7g8', 'd8g8', 'g5f7'],
  rating: 2066,
  themes: ['long', 'mateIn3', 'sacrifice', 'master', 'middlegame', 'kingsideAttack'],
  lastMove: 'b8c6',
};

/** Same puzzle plus the position one ply earlier, so the intro can play. */
const PUZZLE_WITH_INTRO: Puzzle = {
  ...REAL_PUZZLE,
  setupFen: 'rnbr3k/pp2pQ1p/6p1/8/2BbN3/1P6/P4PPP/3R1RK1 b - - 0 1',
};

/** Underpromotion: only e8=N is the solution; e8=Q must be rejected. */
const UNDERPROMOTION_PUZZLE: Puzzle = {
  id: 'underpromo',
  fen: '8/4P3/8/8/8/8/8/K6k w - - 0 1',
  solution: ['e7e8n'],
  rating: 1500,
  themes: ['promotion'],
};

/** Single-move puzzle, for the simplest solve path. */
const ONE_MOVE_PUZZLE: Puzzle = {
  id: 'onemove',
  fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
  solution: ['a1a8'],
  rating: 800,
  themes: ['mateIn1', 'backRankMate'],
};

describe('createSession', () => {
  it('starts awaiting a move with the solver to play', () => {
    const s = createSession(REAL_PUZZLE, 1000);
    expect(s.status).toBe('awaiting-move');
    expect(s.plyIndex).toBe(0);
    expect(s.turn).toBe('w');
    expect(s.locked).toBe(false);
    expect(s.fen).toBe(REAL_PUZZLE.fen);
  });

  it('seeds lastMove from the puzzle so the setup move is highlighted', () => {
    const s = createSession(REAL_PUZZLE, 0);
    expect(s.lastMove).toEqual({ from: 'b8', to: 'c6' });
  });

  it('reports the solver colour from the FEN', () => {
    expect(solverColor(REAL_PUZZLE)).toBe('w');
    expect(solverColor({ ...REAL_PUZZLE, fen: '8/8/8/8/8/8/8/K6k b - - 0 1' })).toBe('b');
  });
});

describe('solving a multi-move line', () => {
  it('walks the full 5-ply solution to solved', () => {
    let s = createSession(REAL_PUZZLE, 0);

    // Ply 0 — solver
    let r = playMove(s, 'e4', 'g5');
    expect(r.state.status).toBe('opponent-replying');
    expect(r.pendingOpponentReply).toBe(true);
    expect(r.state.plyIndex).toBe(1);
    expect(r.state.locked).toBe(true);

    // Ply 1 — opponent auto-reply
    s = applyOpponentReply(r.state);
    expect(s.status).toBe('awaiting-move');
    expect(s.plyIndex).toBe(2);
    expect(s.locked).toBe(false);
    expect(s.lastMove).toEqual({ from: 'd4', to: 'g7' });

    // Ply 2 — solver
    r = playMove(s, 'f7', 'g8');
    expect(r.state.status).toBe('opponent-replying');

    // Ply 3 — opponent
    s = applyOpponentReply(r.state);
    expect(s.plyIndex).toBe(4);

    // Ply 4 — solver, final move
    r = playMove(s, 'g5', 'f7');
    expect(r.state.status).toBe('solved');
    expect(r.pendingOpponentReply).toBe(false);
    expect(outcomeOf(r.state)).toBe('solved');
  });

  it('counts down remaining solver moves', () => {
    const s = createSession(REAL_PUZZLE, 0);
    expect(movesRemaining(s)).toBe(3);
    const after = applyOpponentReply(playMove(s, 'e4', 'g5').state);
    expect(movesRemaining(after)).toBe(2);
  });

  it('solves a one-move puzzle immediately', () => {
    const s = createSession(ONE_MOVE_PUZZLE, 0);
    const r = playMove(s, 'a1', 'a8', undefined, 500);
    expect(r.state.status).toBe('solved');
    expect(r.state.finishedAt).toBe(500);
  });
});

describe('wrong moves', () => {
  it('does not advance the position on a legal but wrong move', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const r = playMove(s, 'f7', 'e7'); // legal queen move, not the solution
    expect(r.state.status).toBe('wrong');
    expect(r.state.fen).toBe(REAL_PUZZLE.fen); // reverted
    expect(r.state.plyIndex).toBe(0);
    expect(r.state.wrongAttempts).toBe(1);
    expect(r.state.wrongMove).toEqual({ from: 'f7', to: 'e7' });
  });

  it('ignores illegal moves entirely without counting an attempt', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const r = playMove(s, 'a1', 'a8'); // no piece on a1
    expect(r.state).toBe(s);
    expect(r.state.wrongAttempts).toBe(0);
  });

  it('fails the puzzle after the attempt limit', () => {
    let s = createSession(REAL_PUZZLE, 0);
    for (let i = 0; i < MAX_WRONG_ATTEMPTS; i++) {
      s = clearWrongMove(playMove(s, 'f7', 'e7').state);
    }
    // The final wrong attempt should have locked it as failed.
    expect(s.wrongAttempts).toBe(MAX_WRONG_ATTEMPTS);
    expect(s.status).toBe('failed');
    expect(outcomeOf(s)).toBe('failed');
  });

  it('clearWrongMove hands control back to the player', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const wrong = playMove(s, 'f7', 'e7').state;
    const cleared = clearWrongMove(wrong);
    expect(cleared.status).toBe('awaiting-move');
    expect(cleared.wrongMove).toBeNull();
    expect(cleared.locked).toBe(false);
  });
});

describe('underpromotion', () => {
  it('rejects a queen promotion when the solution underpromotes', () => {
    const s = createSession(UNDERPROMOTION_PUZZLE, 0);
    const r = playMove(s, 'e7', 'e8', 'q');
    expect(r.state.status).toBe('wrong');
    expect(r.state.wrongAttempts).toBe(1);
  });

  it('accepts the knight promotion', () => {
    const s = createSession(UNDERPROMOTION_PUZZLE, 0);
    const r = playMove(s, 'e7', 'e8', 'n');
    expect(r.state.status).toBe('solved');
  });

  it('detects that a move needs a promotion choice', () => {
    const s = createSession(UNDERPROMOTION_PUZZLE, 0);
    expect(isPromotion(s, 'e7', 'e8')).toBe(true);
    expect(isPromotion(s, 'a1', 'a2')).toBe(false);
  });
});

describe('locking', () => {
  it('rejects input while the opponent is replying', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const afterFirst = playMove(s, 'e4', 'g5').state;
    const attempted = playMove(afterFirst, 'f7', 'g8');
    expect(attempted.state).toBe(afterFirst);
  });

  it('rejects input once solved', () => {
    const solved = playMove(createSession(ONE_MOVE_PUZZLE, 0), 'a1', 'a8').state;
    expect(playMove(solved, 'g1', 'f1').state).toBe(solved);
  });
});

describe('hints', () => {
  it('escalates piece -> destination -> played', () => {
    let s = createSession(REAL_PUZZLE, 0);
    let h = takeHint(s);
    expect(h.hint).toEqual({ kind: 'piece', square: 'e4' });
    s = h.state;

    h = takeHint(s);
    expect(h.hint).toEqual({ kind: 'destination', from: 'e4', to: 'g5' });
    s = h.state;

    h = takeHint(s);
    expect(h.hint).toEqual({ kind: 'played' });
    expect(h.state.hintsUsed).toBe(3);
  });

  it('marks a hinted solve distinctly', () => {
    const hinted = takeHint(createSession(ONE_MOVE_PUZZLE, 0)).state;
    const solved = playMove(hinted, 'a1', 'a8').state;
    expect(outcomeOf(solved)).toBe('solved-with-hint');
  });
});

describe('giveUp and restart', () => {
  it('giveUp fails and locks the board', () => {
    const s = giveUp(createSession(REAL_PUZZLE, 0), 900);
    expect(s.status).toBe('failed');
    expect(s.locked).toBe(true);
    expect(s.finishedAt).toBe(900);
  });

  it('restart returns to the start but keeps counters', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const advanced = applyOpponentReply(playMove(s, 'e4', 'g5').state);
    const withHint = takeHint(advanced).state;
    const back = restart(withHint);
    expect(back.plyIndex).toBe(0);
    expect(back.fen).toBe(REAL_PUZZLE.fen);
    expect(back.status).toBe('awaiting-move');
    expect(back.hintsUsed).toBe(1);
  });
});

describe('legalDestinations', () => {
  it('lists destinations for a piece', () => {
    const s = createSession(REAL_PUZZLE, 0);
    expect(legalDestinations(s, 'e4')).toContain('g5');
  });

  it('returns nothing while locked', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const locked = playMove(s, 'e4', 'g5').state;
    expect(legalDestinations(locked, 'f7')).toEqual([]);
  });
});

describe('intro — the opponent\'s setup move', () => {
  it('opens on the setup position, locked, with no highlight yet', () => {
    const s = createSession(PUZZLE_WITH_INTRO, 0);
    expect(s.status).toBe('intro');
    expect(s.fen).toBe(PUZZLE_WITH_INTRO.setupFen);
    expect(s.locked).toBe(true);
    // The setup move hasn't happened, so highlighting it would spoil the reveal.
    expect(s.lastMove).toBeNull();
  });

  it('shows the OPPONENT to move during the intro', () => {
    const s = createSession(PUZZLE_WITH_INTRO, 0);
    expect(s.turn).toBe('b');
    // ...but the board must still be oriented for the solver.
    expect(solverColor(PUZZLE_WITH_INTRO)).toBe('w');
  });

  it('beginPuzzle lands on the real position and hands over control', () => {
    const s = beginPuzzle(createSession(PUZZLE_WITH_INTRO, 0));
    expect(s.status).toBe('awaiting-move');
    expect(s.fen).toBe(PUZZLE_WITH_INTRO.fen);
    expect(s.turn).toBe('w');
    expect(s.lastMove).toEqual({ from: 'b8', to: 'c6' });
    expect(s.locked).toBe(false);
    expect(s.plyIndex).toBe(0);
  });

  it('rejects moves while the intro is playing', () => {
    const s = createSession(PUZZLE_WITH_INTRO, 0);
    // e4g5 is the correct first move, but it is not the player's turn yet.
    expect(playMove(s, 'e4', 'g5').state).toBe(s);
    expect(s.wrongAttempts).toBe(0);
  });

  it('solves normally once the intro has played', () => {
    let s = beginPuzzle(createSession(PUZZLE_WITH_INTRO, 0));
    let r = playMove(s, 'e4', 'g5');
    expect(r.state.status).toBe('opponent-replying');
    s = applyOpponentReply(r.state);
    r = playMove(s, 'f7', 'g8');
    s = applyOpponentReply(r.state);
    expect(playMove(s, 'g5', 'f7').state.status).toBe('solved');
  });

  it('skips the intro when no setup position is known', () => {
    const s = createSession(REAL_PUZZLE, 0);
    expect(s.status).toBe('awaiting-move');
    expect(s.locked).toBe(false);
    expect(s.fen).toBe(REAL_PUZZLE.fen);
    expect(s.lastMove).toEqual({ from: 'b8', to: 'c6' });
  });

  it('beginPuzzle is a no-op outside the intro', () => {
    const playing = beginPuzzle(createSession(PUZZLE_WITH_INTRO, 0));
    expect(beginPuzzle(playing)).toBe(playing);
  });

  it('restart replays the intro', () => {
    const played = beginPuzzle(createSession(PUZZLE_WITH_INTRO, 0));
    const advanced = playMove(played, 'e4', 'g5').state;
    const back = restart(advanced);
    expect(back.status).toBe('intro');
    expect(back.fen).toBe(PUZZLE_WITH_INTRO.setupFen);
    expect(back.locked).toBe(true);
  });

  it('restart keeps hint and attempt counts', () => {
    let s = beginPuzzle(createSession(PUZZLE_WITH_INTRO, 0));
    s = takeHint(s).state;
    s = playMove(s, 'f7', 'e7').state; // wrong
    const back = restart(s);
    expect(back.hintsUsed).toBe(1);
    expect(back.wrongAttempts).toBe(1);
  });
});

describe('configurable attempt limit', () => {
  const wrong = (s: ReturnType<typeof createSession>) =>
    clearWrongMove(playMove(s, 'f7', 'e7').state);

  it('defaults to the standard limit', () => {
    expect(createSession(REAL_PUZZLE, 0).maxAttempts).toBe(MAX_WRONG_ATTEMPTS);
  });

  it('fails after one wrong move when set to 1', () => {
    const s = createSession(REAL_PUZZLE, 0, 1);
    const after = playMove(s, 'f7', 'e7').state;
    expect(after.status).toBe('failed');
    expect(after.locked).toBe(true);
  });

  it('allows five wrong moves when set to 5', () => {
    let s = createSession(REAL_PUZZLE, 0, 5);
    for (let i = 0; i < 4; i++) {
      s = wrong(s);
      expect(s.status).toBe('awaiting-move');
    }
    const fifth = playMove(s, 'f7', 'e7').state;
    expect(fifth.status).toBe('failed');
  });

  it('never fails on wrong moves when unlimited', () => {
    let s = createSession(REAL_PUZZLE, 0, UNLIMITED_ATTEMPTS);
    for (let i = 0; i < 25; i++) s = wrong(s);
    expect(s.status).toBe('awaiting-move');
    expect(s.wrongAttempts).toBe(25);
    expect(s.locked).toBe(false);
  });

  it('can still be solved with unlimited tries after many misses', () => {
    let s = createSession(ONE_MOVE_PUZZLE, 0, UNLIMITED_ATTEMPTS);
    for (let i = 0; i < 5; i++) s = clearWrongMove(playMove(s, 'g1', 'f1').state);
    expect(playMove(s, 'a1', 'a8').state.status).toBe('solved');
  });

  it('give up still ends an unlimited puzzle', () => {
    const s = giveUp(createSession(REAL_PUZZLE, 0, UNLIMITED_ATTEMPTS), 100);
    expect(s.status).toBe('failed');
  });

  it('reports tries remaining, or null when unlimited', () => {
    const limited = createSession(REAL_PUZZLE, 0, 3);
    expect(attemptsRemaining(limited)).toBe(3);
    expect(attemptsRemaining(wrong(limited))).toBe(2);
    expect(attemptsRemaining(createSession(REAL_PUZZLE, 0, UNLIMITED_ATTEMPTS))).toBeNull();
  });

  it('never reports negative tries remaining', () => {
    let s = createSession(REAL_PUZZLE, 0, 1);
    s = playMove(s, 'f7', 'e7').state;
    expect(attemptsRemaining(s)).toBe(0);
  });

  it('restart preserves the session limit', () => {
    const s = createSession(PUZZLE_WITH_INTRO, 0, 5);
    expect(restart(s).maxAttempts).toBe(5);
  });

  /**
   * The limit is captured at session start on purpose: lowering the setting
   * mid-puzzle must not retroactively fail a puzzle already in progress.
   */
  it('is fixed for the life of the session', () => {
    let s = createSession(REAL_PUZZLE, 0, 5);
    s = wrong(s);
    s = wrong(s);
    s = wrong(s);
    expect(s.status).toBe('awaiting-move');
    expect(s.maxAttempts).toBe(5);
  });
});

describe('legal move map', () => {
  beforeEach(clearMoveMapCache);

  it('groups every legal move by its origin square', () => {
    const map = legalMoveMap(REAL_PUZZLE.fen);
    const chess = new Chess(REAL_PUZZLE.fen);
    const all = chess.moves({ verbose: true });

    const grouped = [...map.values()].reduce((n, list) => n + list.length, 0);
    expect(grouped).toBe(all.length);
    for (const move of all) {
      expect(map.get(move.from)?.some((m) => m.to === move.to)).toBe(true);
    }
  });

  it('agrees with chess.js per square', () => {
    const chess = new Chess(REAL_PUZZLE.fen);
    const map = legalMoveMap(REAL_PUZZLE.fen);
    for (const from of map.keys()) {
      const expected = chess
        .moves({ square: from as never, verbose: true })
        .map((m) => m.to)
        .sort();
      const actual = map.get(from)!.map((m) => m.to).sort();
      expect(actual).toEqual(expected);
    }
  });

  it('returns the identical object on a cache hit', () => {
    expect(legalMoveMap(REAL_PUZZLE.fen)).toBe(legalMoveMap(REAL_PUZZLE.fen));
  });

  it('keys by FEN, so a different position gets a different map', () => {
    const other = legalMoveMap(ONE_MOVE_PUZZLE.fen);
    expect(other).not.toBe(legalMoveMap(REAL_PUZZLE.fen));
  });

  /** The cache must not grow without bound across a long session. */
  it('evicts once past its limit', () => {
    // 40 distinct positions, limit is 32.
    const chess = new Chess();
    const fens: string[] = [];
    for (let i = 0; i < 40; i++) {
      const moves = chess.moves();
      if (!moves.length) break;
      chess.move(moves[0]);
      fens.push(chess.fen());
    }
    fens.forEach((f) => legalMoveMap(f));

    // The earliest position should have been evicted, so it rebuilds fresh.
    const first = legalMoveMap(fens[0]);
    expect(first).not.toBe(legalMoveMap(fens[1]));
    // ...but the map is still correct after eviction.
    const chess2 = new Chess(fens[0]);
    const total = [...first.values()].reduce((n, l) => n + l.length, 0);
    expect(total).toBe(chess2.moves({ verbose: true }).length);
  });

  it('movableSquares lists exactly the squares with a legal move', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const movable = movableSquares(s);
    expect(movable.has('e4')).toBe(true); // knight can move
    expect(movable.has('a8')).toBe(false); // black's rook, not White's turn
    expect(movable.size).toBe(legalMoveMap(REAL_PUZZLE.fen).size);
  });

  it('movableSquares is empty while the board is locked', () => {
    const locked = playMove(createSession(REAL_PUZZLE, 0), 'e4', 'g5').state;
    expect(movableSquares(locked).size).toBe(0);
  });

  it('legalDestinations still matches chess.js after the rewrite', () => {
    const s = createSession(REAL_PUZZLE, 0);
    const chess = new Chess(REAL_PUZZLE.fen);
    const expected = chess.moves({ square: 'e4', verbose: true }).map((m) => m.to).sort();
    expect(legalDestinations(s, 'e4').sort()).toEqual(expected);
  });

  it('isPromotion still works off the cached map', () => {
    const s = createSession(UNDERPROMOTION_PUZZLE, 0);
    expect(isPromotion(s, 'e7', 'e8')).toBe(true);
    expect(isPromotion(s, 'a1', 'a2')).toBe(false);
  });
});
