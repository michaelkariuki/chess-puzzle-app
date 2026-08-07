/**
 * Where the next puzzle comes from.
 *
 * Resolution order, so the app always has something to serve:
 *   1. the prefetched queue (instant, works offline)
 *   2. a live fetch from Lichess
 *   3. the bundled seed set (always present, never empty)
 *
 * Puzzles already seen are skipped where possible, but if every source is
 * exhausted we'd rather repeat one than show an error screen.
 */

import type { Puzzle, UserProgress } from '@/src/chess/types';
import { difficultyFor, isReasonableFor, type Difficulty } from '@/src/chess/rating';
import { fetchNextPuzzle, fetchPuzzleBatch } from './lichess';
import { loadQueue, saveQueue } from './storage';
import seedData from './seed-puzzles.json';

const SEED: Puzzle[] = seedData as Puzzle[];

/** Keep roughly this many puzzles ready for offline play. */
export const QUEUE_TARGET = 20;
const QUEUE_REFILL_AT = 8;

function unseen(puzzles: Puzzle[], progress: UserProgress): Puzzle[] {
  const seen = new Set(progress.seen);
  return puzzles.filter((p) => !seen.has(p.id));
}

/** The candidate closest to `rating`, or null if there are none. */
export function closestTo(puzzles: Puzzle[], rating: number): Puzzle | null {
  let best: Puzzle | null = null;
  let bestDelta = Infinity;
  for (const p of puzzles) {
    const delta = Math.abs(p.rating - rating);
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Last-resort puzzle, compiled in. Guarantees `fromSeed` always has something
 * to return even if the generated seed file is empty — a back-rank mate, which
 * is about as universally solvable as a puzzle gets.
 */
const FALLBACK_PUZZLE: Puzzle = {
  id: 'builtin-backrank',
  fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
  solution: ['a1a8'],
  rating: 800,
  themes: ['mateIn1', 'backRankMate'],
};

/** Best seed puzzle for a rating: unseen and closest in difficulty. */
function fromSeed(progress: UserProgress): Puzzle {
  const candidates = unseen(SEED, progress);
  const pool = candidates.length > 0 ? candidates : SEED;
  if (pool.length === 0) return FALLBACK_PUZZLE;

  let best = pool[0];
  let bestDelta = Math.abs(best.rating - progress.rating);
  for (const p of pool) {
    const delta = Math.abs(p.rating - progress.rating);
    if (delta < bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best;
}

export interface NextOptions {
  difficulty?: Difficulty;
  angle?: string;
}

export async function nextPuzzleFor(
  progress: UserProgress,
  opts: NextOptions = {},
): Promise<Puzzle> {
  const queue = await loadQueue();
  const fresh = unseen(queue, progress);

  // 1. Queue — but pick the BEST match in it, not simply the head. Taking the
  //    head made the queue a FIFO of whatever the network happened to return,
  //    which is why rating matching almost never had an effect in practice.
  const wellMatched = fresh.filter((p) => isReasonableFor(progress.rating, p.rating));
  if (wellMatched.length > 0) {
    const pick = closestTo(wellMatched, progress.rating)!;
    await saveQueue(queue.filter((p) => p.id !== pick.id));
    return pick;
  }

  // 2. Live fetch, steered by the current difficulty.
  try {
    const puzzle = await fetchNextPuzzle(opts);
    if (!progress.seen.includes(puzzle.id)) {
      if (isReasonableFor(progress.rating, puzzle.rating)) return puzzle;
      // Off-target: keep it for later rather than discarding a network round
      // trip, and fall through to a closer local option.
      await saveQueue([...queue, puzzle].slice(0, QUEUE_TARGET));
    }
  } catch {
    // Offline or throttled — fall through to local sources.
  }

  // 3. Best local option: whichever of the queue or the seed set is closer.
  const seedPick = fromSeed(progress);
  const queuePick = closestTo(fresh, progress.rating);
  if (
    queuePick &&
    Math.abs(queuePick.rating - progress.rating) < Math.abs(seedPick.rating - progress.rating)
  ) {
    await saveQueue(queue.filter((p) => p.id !== queuePick.id));
    return queuePick;
  }
  return seedPick;
}

/**
 * Top the offline queue up in the background. Failures are silent by design —
 * this is opportunistic, and the seed set is the real guarantee.
 */
export async function primeQueue(progress: UserProgress): Promise<void> {
  try {
    const queue = await loadQueue();
    if (queue.length >= QUEUE_REFILL_AT) return;

    const wanted = QUEUE_TARGET - queue.length;
    // Steer the prefetch by the CURRENT difficulty. Passing {} here meant the
    // queue filled with un-personalised puzzles — and since the queue is
    // consulted first, the difficulty selection had almost no effect.
    const fetched = await fetchPuzzleBatch(
      wanted,
      { difficulty: difficultyFor(progress) },
      500,
    );
    if (fetched.length === 0) return;

    const seen = new Set([...progress.seen, ...queue.map((p) => p.id)]);
    const merged = [...queue, ...fetched.filter((p) => !seen.has(p.id))];
    await saveQueue(merged.slice(0, QUEUE_TARGET));
  } catch {
    // Opportunistic only.
  }
}

/** How well-matched the seed set is to a rating — drives an offline warning. */
export function seedCoverage(rating: number): number {
  return SEED.filter((p) => isReasonableFor(rating, p.rating)).length;
}

export const SEED_COUNT = SEED.length;
