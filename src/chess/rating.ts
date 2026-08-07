/**
 * Elo rating, user vs. puzzle.
 *
 * Deliberately not Glicko-2: there is no opponent pool and no rating periods
 * here, so Glicko's deviation/volatility bookkeeping would be machinery with
 * nothing to do. Plain Elo converges fine for a single-player trainer.
 */

import type { Outcome, UserProgress } from './types';

/** Higher K while the rating is still finding its level. */
export const K_PROVISIONAL = 32;
export const K_ESTABLISHED = 16;
export const PROVISIONAL_THRESHOLD = 50;

export const MIN_RATING = 400;
export const MAX_RATING = 3000;

export function kFactor(puzzlesAttempted: number): number {
  return puzzlesAttempted < PROVISIONAL_THRESHOLD ? K_PROVISIONAL : K_ESTABLISHED;
}

/** Probability the user solves a puzzle of this rating. */
export function expectedScore(userRating: number, puzzleRating: number): number {
  return 1 / (1 + 10 ** ((puzzleRating - userRating) / 400));
}

function scoreFor(outcome: Outcome): number {
  switch (outcome) {
    case 'solved':
      return 1;
    case 'solved-with-hint':
      return 0.5;
    case 'failed':
      return 0;
  }
}

export function clampRating(rating: number): number {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, rating));
}

/**
 * New rating after one puzzle.
 *
 * A hinted solve is capped at the puzzle's own rating — you shouldn't be able
 * to climb past a puzzle you needed help with.
 */
export function nextRating(
  userRating: number,
  puzzleRating: number,
  outcome: Outcome,
  puzzlesAttempted: number,
): number {
  const k = kFactor(puzzlesAttempted);
  const score = scoreFor(outcome);
  const expected = expectedScore(userRating, puzzleRating);
  let updated = userRating + k * (score - expected);

  if (outcome === 'solved-with-hint' && updated > userRating) {
    updated = Math.min(updated, Math.max(userRating, puzzleRating));
  }

  return clampRating(Math.round(updated));
}

/** Fold a completed puzzle into the stored progress. */
export function applyOutcome(
  progress: UserProgress,
  puzzleId: string,
  puzzleRating: number,
  outcome: Outcome,
): UserProgress {
  const rating = nextRating(progress.rating, puzzleRating, outcome, progress.attempted);
  const success = outcome !== 'failed';
  const currentStreak = success ? progress.currentStreak + 1 : 0;

  return {
    rating,
    solved: progress.solved + (success ? 1 : 0),
    attempted: progress.attempted + 1,
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    seen: progress.seen.includes(puzzleId) ? progress.seen : [...progress.seen, puzzleId],
  };
}

export function accuracy(progress: UserProgress): number {
  if (progress.attempted === 0) return 0;
  return Math.round((progress.solved / progress.attempted) * 100);
}

export type Difficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

/**
 * Pick the `difficulty` parameter for /api/puzzle/next.
 *
 * Lichess treats difficulty as relative, not as an absolute rating filter, so
 * this only steers the distribution — we still filter what comes back against
 * our own rating (see isReasonableFor).
 */
export function difficultyFor(progress: UserProgress): Difficulty {
  if (progress.attempted < 5) return 'easier';
  const recent = progress.currentStreak;
  if (recent >= 5) return 'harder';
  if (recent >= 3) return 'normal';
  if (progress.currentStreak === 0 && progress.attempted > 0) return 'easier';
  return 'normal';
}

/** Window of puzzle ratings we consider well-matched to the user. */
export const RATING_WINDOW = 300;

export function isReasonableFor(userRating: number, puzzleRating: number): boolean {
  return Math.abs(puzzleRating - userRating) <= RATING_WINDOW;
}
