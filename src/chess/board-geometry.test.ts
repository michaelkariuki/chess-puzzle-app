import { Chess } from 'chess.js';

import {
  cellCoords,
  displayFiles,
  displayRanks,
  FILES,
  isLightSquare,
  squareName,
  squareToCell,
  squareToXY,
} from './board-geometry';
import type { Square } from './types';

const chess = new Chess();

describe('isLightSquare', () => {
  /**
   * chess.js is the ground truth. The previous formula was inverted on every
   * square — a bug that is invisible in review and only shows up on screen, so
   * it gets an exhaustive test.
   */
  it('matches chess.js on all 64 squares', () => {
    const mismatches: string[] = [];

    for (let f = 0; f < 8; f++) {
      for (let r = 1; r <= 8; r++) {
        const square = squareName(f, r);
        const expected = chess.squareColor(square as Square);
        const actual = isLightSquare(f, r) ? 'light' : 'dark';
        if (expected !== actual) mismatches.push(`${square}: expected ${expected}, got ${actual}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('gets the corners right', () => {
    expect(isLightSquare(0, 1)).toBe(false); // a1 dark
    expect(isLightSquare(7, 1)).toBe(true); // h1 light
    expect(isLightSquare(0, 8)).toBe(true); // a8 light
    expect(isLightSquare(7, 8)).toBe(false); // h8 dark
  });

  it('alternates along a rank', () => {
    const rank1 = FILES.map((_, f) => isLightSquare(f, 1));
    expect(rank1).toEqual([false, true, false, true, false, true, false, true]);
  });
});

describe('cellCoords', () => {
  it('puts a8 top-left and h1 bottom-right for White', () => {
    expect(cellCoords('w', 0, 0)).toEqual({ rank: 8, fileIndex: 0 }); // a8
    expect(cellCoords('w', 7, 7)).toEqual({ rank: 1, fileIndex: 7 }); // h1
  });

  it('puts h1 top-left and a8 bottom-right for Black', () => {
    expect(cellCoords('b', 0, 0)).toEqual({ rank: 1, fileIndex: 7 }); // h1
    expect(cellCoords('b', 7, 7)).toEqual({ rank: 8, fileIndex: 0 }); // a8
  });

  it('covers all 64 squares exactly once in both orientations', () => {
    for (const orientation of ['w', 'b'] as const) {
      const seen = new Set<string>();
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const { rank, fileIndex } = cellCoords(orientation, row, col);
          seen.add(squareName(fileIndex, rank));
        }
      }
      expect(seen.size).toBe(64);
    }
  });

  /**
   * The board must look identical whichever way it's turned — flipping
   * orientation may not change any square's colour.
   */
  it('keeps square colours stable across orientation', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const white = cellCoords('w', row, col);
        const black = cellCoords('b', 7 - row, 7 - col);
        expect(squareName(white.fileIndex, white.rank)).toBe(
          squareName(black.fileIndex, black.rank),
        );
      }
    }
  });
});

describe('squareToCell / squareToXY', () => {
  it('is the exact inverse of cellCoords in both orientations', () => {
    for (const orientation of ['w', 'b'] as const) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const { rank, fileIndex } = cellCoords(orientation, row, col);
          const square = squareName(fileIndex, rank);
          expect(squareToCell(orientation, square)).toEqual({ row, col });
        }
      }
    }
  });

  it('places a8 at the origin for White and h1 for Black', () => {
    expect(squareToXY('w', 'a8' as Square, 50)).toEqual({ x: 0, y: 0 });
    expect(squareToXY('b', 'h1' as Square, 50)).toEqual({ x: 0, y: 0 });
  });

  it('scales with square size', () => {
    expect(squareToXY('w', 'h1' as Square, 50)).toEqual({ x: 350, y: 350 });
    expect(squareToXY('w', 'h1' as Square, 20)).toEqual({ x: 140, y: 140 });
  });

  it('keeps every square inside the board bounds', () => {
    const size = 40;
    for (let f = 0; f < 8; f++) {
      for (let r = 1; r <= 8; r++) {
        for (const orientation of ['w', 'b'] as const) {
          const { x, y } = squareToXY(orientation, squareName(f, r), size);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(size * 7);
          expect(y).toBeLessThanOrEqual(size * 7);
        }
      }
    }
  });

  it('mirrors coordinates when the board flips', () => {
    const size = 50;
    const white = squareToXY('w', 'a1' as Square, size);
    const black = squareToXY('b', 'a1' as Square, size);
    expect(white.x + black.x).toBe(size * 7);
    expect(white.y + black.y).toBe(size * 7);
  });
});

describe('display order', () => {
  it('runs a-h / 8-1 for White', () => {
    expect(displayFiles('w').join('')).toBe('abcdefgh');
    expect(displayRanks('w')).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('runs h-a / 1-8 for Black', () => {
    expect(displayFiles('b').join('')).toBe('hgfedcba');
    expect(displayRanks('b')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('agrees with cellCoords', () => {
    for (const orientation of ['w', 'b'] as const) {
      const files = displayFiles(orientation);
      const ranks = displayRanks(orientation);
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const { rank, fileIndex } = cellCoords(orientation, row, col);
          expect(FILES[fileIndex]).toBe(files[col]);
          expect(rank).toBe(ranks[row]);
        }
      }
    }
  });
});
