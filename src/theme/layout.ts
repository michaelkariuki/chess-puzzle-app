/**
 * Responsive layout.
 *
 * One set of screens serves phone and desktop web. On a wide viewport the
 * puzzle screen splits into board + side panel; below the breakpoint it stacks.
 * Without this, react-native-web stretches every control to the full window
 * width, which is what made the desktop build look broken.
 */

import { useWindowDimensions } from 'react-native';

/** Above this width, lay out board and controls side by side. */
export const WIDE_BREAKPOINT = 900;

/** Content never exceeds this, so text lines stay readable on a big monitor. */
export const MAX_CONTENT_WIDTH = 1100;
/** Max width for single-column content (home, stats). */
export const MAX_COLUMN_WIDTH = 560;
/** The board stops growing here — beyond this it's just wasted pixels. */
export const MAX_BOARD_SIZE = 560;
export const MIN_BOARD_SIZE = 260;

export interface Layout {
  width: number;
  height: number;
  isWide: boolean;
  /** Board edge length in px, already fitted to the viewport. */
  boardSize: number;
  contentWidth: number;
  columnWidth: number;
  gutter: number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const gutter = width < 400 ? 12 : 20;

  // Side by side: the board gets a little over half, capped. Stacked: full
  // width minus gutters. Either way it must also fit the viewport height,
  // or on a short laptop window the board runs off the bottom.
  const widthBudget = isWide
    ? Math.min((Math.min(width, MAX_CONTENT_WIDTH) - gutter * 3) * 0.58, MAX_BOARD_SIZE)
    : Math.min(width - gutter * 2, MAX_BOARD_SIZE);

  const heightBudget = height - (isWide ? 160 : 320);

  const boardSize = Math.max(
    MIN_BOARD_SIZE,
    Math.floor(Math.min(widthBudget, Math.max(heightBudget, MIN_BOARD_SIZE))),
  );

  return {
    width,
    height,
    isWide,
    boardSize,
    contentWidth: Math.min(width, MAX_CONTENT_WIDTH),
    columnWidth: Math.min(width - gutter * 2, MAX_COLUMN_WIDTH),
    gutter,
  };
}
