import type { Puzzle, UserProgress } from '@/src/chess/types';
import { INITIAL_PROGRESS } from '@/src/chess/types';
import { closestTo, seedCoverage, SEED_COUNT } from './puzzle-source';

const puzzle = (id: string, rating: number): Puzzle => ({
  id,
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  solution: ['a1a2'],
  rating,
  themes: [],
});

describe('closestTo', () => {
  it('returns null for an empty pool', () => {
    expect(closestTo([], 1200)).toBeNull();
  });

  it('picks the nearest rating', () => {
    const pool = [puzzle('a', 800), puzzle('b', 1250), puzzle('c', 1900)];
    expect(closestTo(pool, 1200)?.id).toBe('b');
  });

  it('handles ties deterministically by taking the first', () => {
    const pool = [puzzle('a', 1100), puzzle('b', 1300)];
    expect(closestTo(pool, 1200)?.id).toBe('a');
  });

  it('works when every candidate is far away', () => {
    const pool = [puzzle('a', 400), puzzle('b', 2600)];
    expect(closestTo(pool, 1200)?.id).toBe('a');
  });
});

describe('seedCoverage', () => {
  it('counts seed puzzles near a rating', () => {
    expect(seedCoverage(1200)).toBeGreaterThan(0);
    expect(seedCoverage(1200)).toBeLessThanOrEqual(SEED_COUNT);
  });

  /** A rating with no nearby puzzles should report zero, not crash. */
  it('is zero far outside the seed range', () => {
    expect(seedCoverage(9000)).toBe(0);
  });

  it('is widest in the middle of the range', () => {
    const middle = seedCoverage(1500);
    const edge = seedCoverage(600);
    expect(middle).toBeGreaterThan(edge);
  });
});

describe('progress shape', () => {
  it('starts everyone at 1200 with nothing seen', () => {
    const p: UserProgress = INITIAL_PROGRESS;
    expect(p.rating).toBe(1200);
    expect(p.seen).toEqual([]);
    expect(p.attempted).toBe(0);
  });
});
