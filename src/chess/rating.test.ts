import {
  accuracy,
  applyOutcome,
  clampRating,
  difficultyFor,
  expectedScore,
  isReasonableFor,
  K_ESTABLISHED,
  K_PROVISIONAL,
  kFactor,
  MAX_RATING,
  MIN_RATING,
  nextRating,
  PROVISIONAL_THRESHOLD,
} from './rating';
import { INITIAL_PROGRESS, type UserProgress } from './types';

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });

  it('is high against a much weaker puzzle', () => {
    expect(expectedScore(1800, 1000)).toBeGreaterThan(0.95);
  });

  it('is low against a much harder puzzle', () => {
    expect(expectedScore(1000, 1800)).toBeLessThan(0.05);
  });
});

describe('kFactor', () => {
  it('is provisional below the threshold', () => {
    expect(kFactor(0)).toBe(K_PROVISIONAL);
    expect(kFactor(PROVISIONAL_THRESHOLD - 1)).toBe(K_PROVISIONAL);
  });

  it('settles once established', () => {
    expect(kFactor(PROVISIONAL_THRESHOLD)).toBe(K_ESTABLISHED);
  });
});

describe('nextRating', () => {
  it('rises on a solve', () => {
    expect(nextRating(1200, 1200, 'solved', 0)).toBeGreaterThan(1200);
  });

  it('falls on a failure', () => {
    expect(nextRating(1200, 1200, 'failed', 0)).toBeLessThan(1200);
  });

  it('rewards beating a much harder puzzle more', () => {
    const hard = nextRating(1200, 1800, 'solved', 0) - 1200;
    const easy = nextRating(1200, 800, 'solved', 0) - 1200;
    expect(hard).toBeGreaterThan(easy);
  });

  it('punishes losing to a much easier puzzle more', () => {
    const toEasy = 1200 - nextRating(1200, 800, 'failed', 0);
    const toHard = 1200 - nextRating(1200, 1800, 'failed', 0);
    expect(toEasy).toBeGreaterThan(toHard);
  });

  it('caps a hinted solve at the puzzle rating', () => {
    // Puzzle far below the user: a hinted "solve" must not push them up.
    const r = nextRating(1200, 900, 'solved-with-hint', 0);
    expect(r).toBeLessThanOrEqual(1200);
  });

  it('lets a hinted solve of a harder puzzle still gain, but bounded', () => {
    const r = nextRating(1200, 1600, 'solved-with-hint', 0);
    expect(r).toBeGreaterThanOrEqual(1200);
    expect(r).toBeLessThanOrEqual(1600);
  });

  it('stays inside the rating bounds', () => {
    expect(nextRating(MIN_RATING, 3000, 'failed', 100)).toBeGreaterThanOrEqual(MIN_RATING);
    expect(nextRating(MAX_RATING, 400, 'solved', 100)).toBeLessThanOrEqual(MAX_RATING);
  });

  it('moves less once established', () => {
    const provisional = Math.abs(nextRating(1200, 1200, 'solved', 0) - 1200);
    const established = Math.abs(nextRating(1200, 1200, 'solved', 100) - 1200);
    expect(established).toBeLessThan(provisional);
  });
});

describe('clampRating', () => {
  it('clamps both ends', () => {
    expect(clampRating(-50)).toBe(MIN_RATING);
    expect(clampRating(99999)).toBe(MAX_RATING);
    expect(clampRating(1500)).toBe(1500);
  });
});

describe('applyOutcome', () => {
  it('records a solve and extends the streak', () => {
    const p = applyOutcome(INITIAL_PROGRESS, 'abc', 1200, 'solved');
    expect(p.solved).toBe(1);
    expect(p.attempted).toBe(1);
    expect(p.currentStreak).toBe(1);
    expect(p.bestStreak).toBe(1);
    expect(p.seen).toContain('abc');
  });

  it('resets the streak on failure but keeps the best', () => {
    let p: UserProgress = INITIAL_PROGRESS;
    p = applyOutcome(p, 'a', 1200, 'solved');
    p = applyOutcome(p, 'b', 1200, 'solved');
    expect(p.bestStreak).toBe(2);
    p = applyOutcome(p, 'c', 1200, 'failed');
    expect(p.currentStreak).toBe(0);
    expect(p.bestStreak).toBe(2);
    expect(p.solved).toBe(2);
    expect(p.attempted).toBe(3);
  });

  it('counts a hinted solve as a success for the streak', () => {
    const p = applyOutcome(INITIAL_PROGRESS, 'a', 1200, 'solved-with-hint');
    expect(p.currentStreak).toBe(1);
    expect(p.solved).toBe(1);
  });

  it('does not duplicate ids in seen', () => {
    let p = applyOutcome(INITIAL_PROGRESS, 'a', 1200, 'solved');
    p = applyOutcome(p, 'a', 1200, 'failed');
    expect(p.seen.filter((id) => id === 'a')).toHaveLength(1);
  });
});

describe('accuracy', () => {
  it('is 0 with no attempts', () => {
    expect(accuracy(INITIAL_PROGRESS)).toBe(0);
  });

  it('is a whole percentage', () => {
    expect(accuracy({ ...INITIAL_PROGRESS, solved: 3, attempted: 4 })).toBe(75);
  });
});

describe('rating convergence', () => {
  it('climbs toward the level the player actually solves at', () => {
    // Player reliably solves 1500s, fails 1900s. Rating should settle in between.
    let p: UserProgress = INITIAL_PROGRESS;
    for (let i = 0; i < 60; i++) {
      const puzzleRating = i % 3 === 0 ? 1900 : 1500;
      const outcome = puzzleRating === 1900 ? 'failed' : 'solved';
      p = applyOutcome(p, `p${i}`, puzzleRating, outcome);
    }
    expect(p.rating).toBeGreaterThan(1400);
    expect(p.rating).toBeLessThan(1900);
  });
});

describe('difficultyFor', () => {
  it('eases in for brand new players', () => {
    expect(difficultyFor(INITIAL_PROGRESS)).toBe('easier');
  });

  it('ramps up on a hot streak', () => {
    expect(difficultyFor({ ...INITIAL_PROGRESS, attempted: 20, currentStreak: 6 })).toBe('harder');
  });

  it('backs off after a failure', () => {
    expect(difficultyFor({ ...INITIAL_PROGRESS, attempted: 20, currentStreak: 0 })).toBe('easier');
  });
});

describe('isReasonableFor', () => {
  it('accepts puzzles near the user rating', () => {
    expect(isReasonableFor(1200, 1300)).toBe(true);
    expect(isReasonableFor(1200, 1000)).toBe(true);
  });

  it('rejects puzzles far away', () => {
    expect(isReasonableFor(1200, 2000)).toBe(false);
  });
});
