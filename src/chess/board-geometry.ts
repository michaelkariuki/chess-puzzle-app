/**
 * Board geometry — square colours and display ordering.
 *
 * Extracted from the Board component so it can be tested against chess.js as
 * ground truth. The colour formula was previously inverted on all 64 squares,
 * which is invisible in code review and obvious only on screen.
 */

import type { Square } from './types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Is the square at (fileIndex 0-7, rank 1-8) a light square?
 *
 * a1 is dark: file 0 + rank 1 = 1. So an ODD sum is dark, an EVEN sum is light.
 */
export function isLightSquare(fileIndex: number, rank: number): boolean {
  return (fileIndex + rank) % 2 === 0;
}

export function squareName(fileIndex: number, rank: number): Square {
  return `${FILES[fileIndex]}${rank}` as Square;
}

/**
 * Board coordinates for a cell in the rendered grid.
 *
 * chess.js `board()` yields rank 8 first with files a-h left to right, i.e.
 * White's view. For Black the grid is reversed on both axes.
 */
export function cellCoords(
  orientation: 'w' | 'b',
  rowIdx: number,
  colIdx: number,
): { rank: number; fileIndex: number } {
  return orientation === 'w'
    ? { rank: 8 - rowIdx, fileIndex: colIdx }
    : { rank: rowIdx + 1, fileIndex: 7 - colIdx };
}

/** File letters in display order, left to right. */
export function displayFiles(orientation: 'w' | 'b'): readonly string[] {
  return orientation === 'w' ? FILES : [...FILES].reverse();
}

/** Rank numbers in display order, top to bottom. */
export function displayRanks(orientation: 'w' | 'b'): number[] {
  return orientation === 'w'
    ? [8, 7, 6, 5, 4, 3, 2, 1]
    : [1, 2, 3, 4, 5, 6, 7, 8];
}

/** Grid position (row, col) of a named square in the rendered board. */
export function squareToCell(
  orientation: 'w' | 'b',
  square: Square,
): { row: number; col: number } {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rank = Number(square[1]);

  return orientation === 'w'
    ? { row: 8 - rank, col: fileIndex }
    : { row: rank - 1, col: 7 - fileIndex };
}

/**
 * Pixel offset of a square's top-left corner within the board.
 * Drives the sliding-piece animation overlay.
 */
export function squareToXY(
  orientation: 'w' | 'b',
  square: Square,
  squareSize: number,
): { x: number; y: number } {
  const { row, col } = squareToCell(orientation, square);
  return { x: col * squareSize, y: row * squareSize };
}
