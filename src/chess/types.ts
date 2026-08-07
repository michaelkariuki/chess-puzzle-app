/**
 * Core domain types.
 *
 * These mirror the *actual* Lichess puzzle payload, verified against a live
 * response on 2026-08-07. In particular: `themes` is an array, `rating` is a
 * plain number, and `solution` holds UCI strings — see Docs/PLAN.md §2.2.
 */

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** e.g. 'wK', 'bQ' — matches the Cburnett asset filenames. */
export type PieceCode = `${'w' | 'b'}${'K' | 'Q' | 'R' | 'B' | 'N' | 'P'}`;

export interface Piece {
  type: PieceType;
  color: Color;
}

/** A UCI move string: 'e2e4', or 'e7e8q' when promoting. */
export type Uci = string;

export interface Puzzle {
  id: string;
  /** Position with the *solver* to move. */
  fen: string;
  /**
   * Position one ply earlier — before the opponent's setup move.
   *
   * Optional. When present the board opens here and plays `lastMove` into
   * `fen`, so you see the move you're responding to instead of being dropped
   * into a position cold.
   */
  setupFen?: string;
  /**
   * The full forced line in UCI. Even indices are the solver's moves, odd
   * indices are the opponent's replies, which we play automatically.
   */
  solution: Uci[];
  rating: number;
  themes: string[];
  /** The move that led into the position, for highlighting. Optional. */
  lastMove?: Uci;
}

export type PuzzleStatus =
  | 'loading'
  /** Showing the position before the opponent's setup move, about to play it. */
  | 'intro'
  | 'awaiting-move'
  | 'opponent-replying'
  | 'wrong'
  | 'solved'
  | 'failed';

/** How a finished puzzle was resolved — drives the rating update. */
export type Outcome = 'solved' | 'solved-with-hint' | 'failed';

export interface UserProgress {
  rating: number;
  solved: number;
  attempted: number;
  currentStreak: number;
  bestStreak: number;
  /** Puzzle ids already seen, so we don't repeat them. */
  seen: string[];
}

export const INITIAL_PROGRESS: UserProgress = {
  rating: 1200,
  solved: 0,
  attempted: 0,
  currentStreak: 0,
  bestStreak: 0,
  seen: [],
};

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  showLegalMoves: boolean;
  autoPromoteToQueen: boolean;
  /**
   * Wrong moves allowed before a puzzle is failed.
   * `UNLIMITED_ATTEMPTS` (0) means keep trying forever.
   */
  maxAttempts: number;
}

/** Sentinel for "never fail me" — 0 rather than Infinity, which JSON drops. */
export const UNLIMITED_ATTEMPTS = 0;

export const ATTEMPT_CHOICES = [1, 2, 3, 5, UNLIMITED_ATTEMPTS] as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  showLegalMoves: true,
  autoPromoteToQueen: false,
  maxAttempts: 3,
};
