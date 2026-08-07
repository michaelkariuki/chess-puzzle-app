import { Chess } from 'chess.js';

import { parseUci } from '@/src/chess/uci';
import {
  FEATURED_THEMES,
  filterCatalogue,
  loadCatalogue,
  RATING_BANDS,
  themeCounts,
  themeLabel,
} from './catalogue';

const catalogue = loadCatalogue();

describe('catalogue integrity', () => {
  it('is substantial enough to browse', () => {
    expect(catalogue.length).toBeGreaterThanOrEqual(1000);
  });

  it('has unique ids', () => {
    expect(new Set(catalogue.map((p) => p.id)).size).toBe(catalogue.length);
  });

  it('every entry is playable', () => {
    const broken: string[] = [];
    for (const p of catalogue) {
      if (!p.fen || !p.solution?.length || typeof p.rating !== 'number') {
        broken.push(`${p.id}: malformed`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('every solution line is legal from its position', () => {
    const broken: string[] = [];
    for (const puzzle of catalogue) {
      try {
        const chess = new Chess(puzzle.fen);
        for (const uci of puzzle.solution) {
          const parsed = parseUci(uci);
          if (!parsed) throw new Error(`bad move ${uci}`);
          chess.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
        }
      } catch (err) {
        broken.push(`${puzzle.id}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('mate puzzles end in mate delivered by the solver', () => {
    const broken: string[] = [];
    for (const puzzle of catalogue.filter((p) => p.themes.some((t) => /^mateIn\d+$/.test(t)))) {
      const chess = new Chess(puzzle.fen);
      const solver = chess.turn();
      for (const uci of puzzle.solution) {
        const parsed = parseUci(uci);
        if (!parsed) break;
        try {
          chess.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
        } catch {
          break;
        }
      }
      if (!chess.isCheckmate() || chess.turn() === solver) broken.push(puzzle.id);
    }
    expect(broken).toEqual([]);
  });

  it('carries setup positions for the opening animation', () => {
    const withSetup = catalogue.filter((p) => p.setupFen && p.lastMove);
    expect(withSetup.length).toBe(catalogue.length);
  });

  it('spans a wide rating range', () => {
    const ratings = catalogue.map((p) => p.rating);
    expect(Math.min(...ratings)).toBeLessThan(800);
    expect(Math.max(...ratings)).toBeGreaterThan(2000);
  });
});

describe('filterCatalogue', () => {
  it('respects rating bounds', () => {
    const out = filterCatalogue(catalogue, { minRating: 1400, maxRating: 1600 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((p) => p.rating >= 1400 && p.rating <= 1600)).toBe(true);
  });

  it('requires ALL selected themes, not any', () => {
    const out = filterCatalogue(catalogue, { themes: ['mateIn2', 'sacrifice'] });
    expect(out.every((p) => p.themes.includes('mateIn2') && p.themes.includes('sacrifice'))).toBe(
      true,
    );
  });

  it('excludes ids on request', () => {
    const victim = catalogue[0].id;
    const out = filterCatalogue(catalogue, { excludeIds: new Set([victim]) });
    expect(out.find((p) => p.id === victim)).toBeUndefined();
    expect(out.length).toBe(catalogue.length - 1);
  });

  it('matches a free-text query against themes', () => {
    const out = filterCatalogue(catalogue, { query: 'fork' });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((p) => p.themes.some((t) => t.toLowerCase().includes('fork')))).toBe(true);
  });

  it('matches a query against the puzzle id', () => {
    const target = catalogue[5];
    const out = filterCatalogue(catalogue, { query: target.id });
    expect(out.map((p) => p.id)).toContain(target.id);
  });

  it('is case-insensitive', () => {
    expect(filterCatalogue(catalogue, { query: 'FORK' }).length).toBe(
      filterCatalogue(catalogue, { query: 'fork' }).length,
    );
  });

  it('sorts ascending and descending', () => {
    const asc = filterCatalogue(catalogue, {}, 'rating-asc');
    const desc = filterCatalogue(catalogue, {}, 'rating-desc');
    expect(asc[0].rating).toBeLessThanOrEqual(asc[asc.length - 1].rating);
    expect(desc[0].rating).toBeGreaterThanOrEqual(desc[desc.length - 1].rating);
  });

  it('returns empty rather than throwing on an impossible filter', () => {
    expect(filterCatalogue(catalogue, { minRating: 9000 })).toEqual([]);
  });

  it('every rating band returns something', () => {
    for (const band of RATING_BANDS) {
      const out = filterCatalogue(catalogue, { minRating: band.min, maxRating: band.max });
      expect({ band: band.label, count: out.length }).toEqual({
        band: band.label,
        count: expect.any(Number),
      });
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

describe('theme helpers', () => {
  it('counts themes present in the catalogue', () => {
    const counts = themeCounts(catalogue);
    expect(counts.mateIn1).toBeGreaterThan(0);
    expect(counts.fork).toBeGreaterThan(0);
  });

  it('most featured themes are actually represented', () => {
    const counts = themeCounts(catalogue);
    const present = FEATURED_THEMES.filter((t) => (counts[t] ?? 0) > 0);
    expect(present.length).toBeGreaterThanOrEqual(FEATURED_THEMES.length - 2);
  });

  it('humanises camelCase theme ids', () => {
    expect(themeLabel('backRankMate')).toBe('Back rank mate');
    expect(themeLabel('fork')).toBe('Fork');
    expect(themeLabel('mateIn2')).toBe('Mate in2');
  });
});
