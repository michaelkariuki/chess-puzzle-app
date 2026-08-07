/**
 * The puzzle solve state machine.
 *
 * This is the heart of the app and the only genuinely subtle logic in it, so
 * it lives here as pure TypeScript with no React and no react-native imports —
 * which is what makes it cheap to test.
 *
 * Model (see Docs/PLAN.md §4): a puzzle is a single forced line in UCI.
 * `solution[0]` is the solver's first move; even indices are the solver's,
 * odd indices are the opponent's forced replies, which we play automatically.
 */

import { Chess, type Move as ChessMove } from 'chess.js';

import { UNLIMITED_ATTEMPTS } from './types';
import type { Outcome, Piece, Puzzle, PuzzleStatus, Square, Uci } from './types';
import { movesMatch, parseUci } from './uci';

/** Fallback when no session limit is supplied. */
export const MAX_WRONG_ATTEMPTS = 3;
/** Pause before the opponent replies, so the move is readable. */
export const OPPONENT_REPLY_DELAY_MS = 300;
/**
 * Beat before the opponent's setup move plays on load. Long enough to register
 * the starting position, short enough not to feel like a stall.
 */
export const INTRO_DELAY_MS = 550;

export interface SessionState {
  puzzle: Puzzle;
  status: PuzzleStatus;
  /** Index into `puzzle.solution` of the move currently expected. */
  plyIndex: number;
  fen: string;
  /** Whose turn the board shows — also the orientation the solver sees. */
  turn: 'w' | 'b';
  /** Squares of the most recent move, for highlighting. */
  lastMove: { from: Square; to: Square } | null;
  /** Set when a wrong move was just played, so the UI can flash it. */
  wrongMove: { from: Square; to: Square } | null;
  wrongAttempts: number;
  hintsUsed: number;
  /**
   * Wrong moves allowed before failing, captured when the session starts.
   * `UNLIMITED_ATTEMPTS` disables failing on wrong moves entirely.
   * Held on the session, not read live, so changing the setting mid-puzzle
   * can't retroactively fail a puzzle you're partway through.
   */
  maxAttempts: number;
  /** Board is locked while the opponent replies or once the puzzle is over. */
  locked: boolean;
  startedAt: number;
  finishedAt: number | null;
}

export interface MoveResult {
  state: SessionState;
  /**
   * Set when the opponent must reply. The caller is responsible for waiting
   * OPPONENT_REPLY_DELAY_MS and then calling `applyOpponentReply`.
   */
  pendingOpponentReply: boolean;
  /**
   * What the move did, for sound and feedback. Reported here because chess.js
   * already computed it — re-deriving it in the view would mean replaying the
   * position a second time.
   */
  effect: MoveEffect | null;
}

export interface MoveEffect {
  captured: boolean;
  check: boolean;
}

/** Rebuild a chess.js instance for a given state. */
function engineFor(state: SessionState): Chess {
  return new Chess(state.fen);
}

/**
 * Legal moves for a position, grouped by origin square.
 *
 * chess.js `moves({square})` regenerates and validates EVERY legal move for
 * the side, then filters — measured at ~537µs per call versus ~17µs to
 * construct the engine. A single board tap asked for it three times
 * (destination check, re-select check, promotion check), so the position is
 * generated once and reused instead.
 *
 * Cached by FEN. Positions are immutable, so a hit is always valid.
 */
const MOVE_MAP_CACHE = new Map<string, Map<string, ChessMove[]>>();
/** Small enough to stay trivial; a puzzle only ever visits a few positions. */
const MOVE_MAP_CACHE_LIMIT = 32;

export function legalMoveMap(fen: string): Map<string, ChessMove[]> {
  const hit = MOVE_MAP_CACHE.get(fen);
  if (hit) return hit;

  const chess = new Chess(fen);
  const map = new Map<string, ChessMove[]>();
  for (const move of chess.moves({ verbose: true }) as ChessMove[]) {
    const list = map.get(move.from);
    if (list) list.push(move);
    else map.set(move.from, [move]);
  }

  if (MOVE_MAP_CACHE.size >= MOVE_MAP_CACHE_LIMIT) {
    // Plain FIFO eviction — insertion order is Map's iteration order.
    const oldest = MOVE_MAP_CACHE.keys().next().value;
    if (oldest !== undefined) MOVE_MAP_CACHE.delete(oldest);
  }
  MOVE_MAP_CACHE.set(fen, map);
  return map;
}

/** Test-only: drop the cache so timings aren't polluted between cases. */
export function clearMoveMapCache(): void {
  MOVE_MAP_CACHE.clear();
}

export function createSession(
  puzzle: Puzzle,
  now: number,
  maxAttempts: number = MAX_WRONG_ATTEMPTS,
): SessionState {
  const last = puzzle.lastMove ? parseUci(puzzle.lastMove) : null;

  // When we know the position one ply earlier, open there and play the
  // opponent's move in — otherwise the puzzle starts mid-conversation.
  const canIntro = Boolean(puzzle.setupFen && last);
  const startFen = canIntro ? puzzle.setupFen! : puzzle.fen;

  return {
    puzzle,
    status: canIntro ? 'intro' : 'awaiting-move',
    plyIndex: 0,
    fen: startFen,
    turn: new Chess(startFen).turn(),
    // No highlight during the intro: the move hasn't been played yet.
    lastMove: canIntro ? null : last ? { from: last.from, to: last.to } : null,
    wrongMove: null,
    wrongAttempts: 0,
    hintsUsed: 0,
    maxAttempts,
    // Locked through the intro so a fast tap can't move for the opponent.
    locked: canIntro,
    startedAt: now,
    finishedAt: null,
  };
}

/**
 * Play the opponent's setup move, moving from `setupFen` into the real puzzle
 * position. The FEN change plus a populated `lastMove` is what drives the
 * sliding-piece animation in the view.
 */
export function beginPuzzle(state: SessionState): SessionState {
  if (state.status !== 'intro') return state;

  const last = state.puzzle.lastMove ? parseUci(state.puzzle.lastMove) : null;

  return {
    ...state,
    status: 'awaiting-move',
    // Trust the puzzle's own fen rather than replaying — it is authoritative,
    // and a malformed setup move must not strand the player on a bad position.
    fen: state.puzzle.fen,
    turn: new Chess(state.puzzle.fen).turn(),
    lastMove: last ? { from: last.from, to: last.to } : null,
    locked: false,
  };
}

/**
 * The colour the human is playing — the side to move in the puzzle FEN.
 * Deliberately NOT the intro position, where it is the opponent's turn; using
 * that would flip the board for the whole puzzle.
 */
export function solverColor(puzzle: Puzzle): 'w' | 'b' {
  return new Chess(puzzle.fen).turn();
}

/** Legal destination squares from `from`, for move-hint dots. */
export function legalDestinations(state: SessionState, from: Square): Square[] {
  if (state.locked) return [];
  const moves = legalMoveMap(state.fen).get(from);
  return moves ? moves.map((m) => m.to as Square) : [];
}

/** All squares the side to move can move a piece FROM. */
export function movableSquares(state: SessionState): Set<string> {
  if (state.locked) return new Set();
  return new Set(legalMoveMap(state.fen).keys());
}

/** Board as 8 rows (rank 8 first), each 8 cells. */
export function boardSquares(fen: string): ({ square: Square; piece: Piece } | null)[][] {
  return new Chess(fen).board().map((row) =>
    row.map((cell) =>
      cell
        ? { square: cell.square as Square, piece: { type: cell.type, color: cell.color } }
        : null,
    ),
  );
}

/**
 * Does moving `from` -> `to` require choosing a promotion piece?
 * Used to decide whether to show the promotion picker.
 */
export function isPromotion(state: SessionState, from: Square, to: Square): boolean {
  const moves = legalMoveMap(state.fen).get(from);
  return Boolean(moves?.some((m) => m.to === to && Boolean(m.promotion)));
}

/**
 * Attempt the solver's move.
 *
 * Illegal moves are rejected without counting as a wrong attempt — they're a
 * mis-tap, not a wrong answer. Legal-but-not-the-solution moves do count.
 */
export function playMove(
  state: SessionState,
  from: Square,
  to: Square,
  promotion?: string,
  now = 0,
): MoveResult {
  if (state.locked || state.status === 'solved' || state.status === 'failed') {
    return { state, pendingOpponentReply: false, effect: null };
  }

  const chess = engineFor(state);
  let move: ChessMove;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    // Not a legal chess move at all — ignore it entirely.
    return { state, pendingOpponentReply: false, effect: null };
  }

  const played: Uci = move.lan;
  const expected = state.puzzle.solution[state.plyIndex];

  if (!movesMatch(played, expected)) {
    const wrongAttempts = state.wrongAttempts + 1;
    const exhausted =
      state.maxAttempts !== UNLIMITED_ATTEMPTS && wrongAttempts >= state.maxAttempts;
    return {
      state: {
        ...state,
        // Board position is NOT advanced — the wrong move is reverted.
        status: exhausted ? 'failed' : 'wrong',
        wrongMove: { from, to },
        wrongAttempts,
        locked: exhausted,
        finishedAt: exhausted ? now : null,
      },
      pendingOpponentReply: false,
      effect: { captured: Boolean(move.captured), check: chess.isCheck() },
    };
  }

  const nextPly = state.plyIndex + 1;
  const lineExhausted = nextPly >= state.puzzle.solution.length;

  return {
    state: {
      ...state,
      status: lineExhausted ? 'solved' : 'opponent-replying',
      plyIndex: nextPly,
      fen: chess.fen(),
      turn: chess.turn(),
      lastMove: { from, to },
      wrongMove: null,
      locked: true,
      finishedAt: lineExhausted ? now : null,
    },
    pendingOpponentReply: !lineExhausted,
    effect: { captured: Boolean(move.captured), check: chess.isCheck() },
  };
}

/**
 * Play the opponent's forced reply at the current ply. Call this after
 * OPPONENT_REPLY_DELAY_MS when `playMove` reported `pendingOpponentReply`.
 */
export function applyOpponentReply(state: SessionState): SessionState {
  return applyOpponentReplyWithEffect(state).state;
}

/** As `applyOpponentReply`, but also reports what the reply did. */
export function applyOpponentReplyWithEffect(state: SessionState): {
  state: SessionState;
  effect: MoveEffect | null;
} {
  if (state.status !== 'opponent-replying') return { state, effect: null };

  const reply = state.puzzle.solution[state.plyIndex];
  const parsed = reply ? parseUci(reply) : null;
  if (!parsed) {
    // Malformed solution data — treat the puzzle as complete rather than wedging.
    return { state: { ...state, status: 'solved', locked: true }, effect: null };
  }

  const chess = engineFor(state);
  let move;
  try {
    move = chess.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
  } catch {
    return { state: { ...state, status: 'solved', locked: true }, effect: null };
  }

  return {
    state: {
      ...state,
      status: 'awaiting-move',
      plyIndex: state.plyIndex + 1,
      fen: chess.fen(),
      turn: chess.turn(),
      lastMove: { from: parsed.from, to: parsed.to },
      locked: false,
    },
    effect: { captured: Boolean(move.captured), check: chess.isCheck() },
  };
}

/** Clear the red flash after a wrong move and hand control back. */
export function clearWrongMove(state: SessionState): SessionState {
  if (state.status !== 'wrong') return state;
  return { ...state, status: 'awaiting-move', wrongMove: null, locked: false };
}

export type Hint =
  | { kind: 'piece'; square: Square }
  | { kind: 'destination'; from: Square; to: Square }
  | { kind: 'played' };

/**
 * Progressive hints: first the piece, then the destination, then play it.
 * Each hint is recorded — a solve using any hint scores half (see rating.ts).
 */
export function takeHint(state: SessionState): { state: SessionState; hint: Hint | null } {
  if (state.status === 'solved' || state.status === 'failed') {
    return { state, hint: null };
  }
  const expected = state.puzzle.solution[state.plyIndex];
  const parsed = expected ? parseUci(expected) : null;
  if (!parsed) return { state, hint: null };

  const next = state.hintsUsed + 1;
  const withHint = { ...state, hintsUsed: next };

  if (next === 1) return { state: withHint, hint: { kind: 'piece', square: parsed.from } };
  if (next === 2) {
    return { state: withHint, hint: { kind: 'destination', from: parsed.from, to: parsed.to } };
  }
  return { state: withHint, hint: { kind: 'played' } };
}

export function giveUp(state: SessionState, now = 0): SessionState {
  if (state.status === 'solved' || state.status === 'failed') return state;
  return { ...state, status: 'failed', locked: true, finishedAt: now };
}

/** Reset to the starting position, keeping hint and attempt counts. */
export function restart(state: SessionState): SessionState {
  // Reuse createSession so restart replays the intro exactly as a fresh load
  // does, rather than drifting into a second, subtly different setup path.
  const fresh = createSession(state.puzzle, state.startedAt, state.maxAttempts);
  return {
    ...fresh,
    wrongAttempts: state.wrongAttempts,
    hintsUsed: state.hintsUsed,
  };
}

export function outcomeOf(state: SessionState): Outcome | null {
  if (state.status === 'solved') {
    return state.hintsUsed > 0 ? 'solved-with-hint' : 'solved';
  }
  if (state.status === 'failed') return 'failed';
  return null;
}

/** Tries left, or null when unlimited. */
export function attemptsRemaining(state: SessionState): number | null {
  if (state.maxAttempts === UNLIMITED_ATTEMPTS) return null;
  return Math.max(0, state.maxAttempts - state.wrongAttempts);
}

/** Solver moves remaining in the line — drives the "2 more moves" indicator. */
export function movesRemaining(state: SessionState): number {
  const remaining = state.puzzle.solution.length - state.plyIndex;
  return Math.max(0, Math.ceil(remaining / 2));
}
