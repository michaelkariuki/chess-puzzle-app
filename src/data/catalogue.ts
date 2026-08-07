/**
 * The browsable puzzle catalogue.
 *
 * Why this is bundled rather than paged from the network: Lichess exposes no
 * public list or search endpoint for puzzles. Verified 2026-08-07 —
 * `/api/puzzle/search`, `/api/puzzle/list` and `/api/puzzles` all return 404,
 * and `/api/puzzle/next` (the only public source) hands back exactly one puzzle
 * and rate-limits after a couple of dozen calls. There is nothing to paginate.
 *
 * So the catalogue ships with the app, generated from the Lichess bulk database
 * at build time. "Lazy loading" here means two real things:
 *
 *   1. The 533 KB JSON is `require`d on first use, not at app start, so the
 *      puzzle screen never pays for it.
 *   2. The list renders through a windowed FlatList, so only visible rows are
 *      mounted no matter how long the filtered result is.
 *
 * Regenerate with:
 *   node ./scripts/seed-puzzles.mjs --from-db --count 2000 --fresh \
 *     --out src/data/catalogue.json
 */

import type { Puzzle } from '@/src/chess/types';

let cache: Puzzle[] | null = null;

/**
 * Load the catalogue, parsing on first call only.
 *
 * Metro resolves `require` at build time, so this doesn't produce a separate
 * chunk — but it does defer the JSON parse until something actually browses,
 * which is the cost that matters on a phone.
 */
export function loadCatalogue(): Puzzle[] {
  if (!cache) {
    cache = require('./catalogue.json') as Puzzle[];
  }
  return cache;
}

export interface CatalogueFilter {
  /** Inclusive rating bounds. */
  minRating?: number;
  maxRating?: number;
  /** Puzzle must carry ALL of these themes. */
  themes?: string[];
  /** Hide puzzles already solved. */
  excludeIds?: Set<string>;
  /** Free-text match against id or theme. */
  query?: string;
}

export type SortOrder = 'rating-asc' | 'rating-desc' | 'themed';

/** Themes worth surfacing as filter chips, in a sensible teaching order. */
export const FEATURED_THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'hangingPiece',
  'deflection',
  'backRankMate',
  'sacrifice',
  'promotion',
  'endgame',
  'middlegame',
  'opening',
] as const;

export function filterCatalogue(
  puzzles: Puzzle[],
  filter: CatalogueFilter,
  sort: SortOrder = 'rating-asc',
): Puzzle[] {
  const { minRating, maxRating, themes, excludeIds, query } = filter;
  const needle = query?.trim().toLowerCase();

  const out = puzzles.filter((p) => {
    if (minRating !== undefined && p.rating < minRating) return false;
    if (maxRating !== undefined && p.rating > maxRating) return false;
    if (excludeIds?.has(p.id)) return false;
    if (themes?.length && !themes.every((t) => p.themes.includes(t))) return false;
    if (needle) {
      const hit =
        p.id.toLowerCase().includes(needle) ||
        p.themes.some((t) => t.toLowerCase().includes(needle));
      if (!hit) return false;
    }
    return true;
  });

  if (sort === 'rating-desc') return out.sort((a, b) => b.rating - a.rating);
  if (sort === 'rating-asc') return out.sort((a, b) => a.rating - b.rating);
  return out;
}

/** How many catalogue puzzles carry each featured theme, for chip counts. */
export function themeCounts(puzzles: Puzzle[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of puzzles) {
    for (const t of p.themes) {
      if (counts[t] !== undefined) counts[t] += 1;
      else counts[t] = 1;
    }
  }
  return counts;
}

/** Human label for a Lichess theme id, e.g. 'backRankMate' -> 'Back rank mate'. */
export function themeLabel(theme: string): string {
  const spaced = theme.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const RATING_BANDS = [
  { label: 'All', min: 0, max: 4000 },
  { label: '<1000', min: 0, max: 999 },
  { label: '1000–1400', min: 1000, max: 1399 },
  { label: '1400–1800', min: 1400, max: 1799 },
  { label: '1800+', min: 1800, max: 4000 },
] as const;
