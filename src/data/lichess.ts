/**
 * Lichess puzzle API client.
 *
 * Endpoints verified live on 2026-08-07 (see Docs/PLAN.md §2.1):
 *
 *   GET /api/puzzle/next?angle=&difficulty=   200 — works, no auth
 *   GET /api/puzzle/daily                     200 — one puzzle, no params
 *   GET /api/puzzle/{id}                      200
 *
 * Endpoints the old plan relied on and which DO NOT work:
 *   GET /api/puzzle/batch?max=N               404 — does not exist
 *   GET /api/puzzle/daily?max=N&minRating=R   200 but silently ignores params
 *
 * Note the response nests the puzzle under `puzzle`, alongside a `game` object
 * we don't need.
 */

import type { Puzzle } from '@/src/chess/types';
import type { Difficulty } from '@/src/chess/rating';
import { positionFromPgn } from '@/src/chess/fen-from-pgn';

const BASE = 'https://lichess.org/api';
const TIMEOUT_MS = 10_000;

export class LichessError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LichessError';
  }
}

/** Shape of the `puzzle` object in a Lichess response. */
interface RawPuzzle {
  id: string;
  /** Present on /puzzle/daily, ABSENT on /puzzle/next — see parsePuzzle. */
  fen?: string;
  solution: string[];
  rating: number;
  themes: string[];
  lastMove?: string;
  initialPly?: number;
}

interface RawResponse {
  puzzle?: RawPuzzle;
  game?: { pgn?: string };
}

function parsePuzzle(raw: unknown): Puzzle {
  const outer = raw as RawResponse;
  const p = outer?.puzzle;

  if (!p || typeof p.id !== 'string') {
    throw new LichessError('Malformed puzzle response: missing id');
  }
  if (!Array.isArray(p.solution) || p.solution.length === 0) {
    throw new LichessError(`Puzzle ${p.id} has no solution line`);
  }

  // /puzzle/daily hands us a ready-made fen; /puzzle/next does not, and we have
  // to replay the game PGN up to initialPly instead. Assuming `fen` is always
  // present silently produces positionless puzzles.
  let fen = typeof p.fen === 'string' ? p.fen : undefined;
  let lastMove = typeof p.lastMove === 'string' ? p.lastMove : undefined;

  const pgn = outer?.game?.pgn;
  const hasPly = typeof pgn === 'string' && typeof p.initialPly === 'number';

  if (!fen) {
    const derived = hasPly ? positionFromPgn(pgn, p.initialPly!) : null;
    if (!derived) {
      throw new LichessError(
        `Puzzle ${p.id} has neither a fen nor a replayable pgn/initialPly pair`,
      );
    }
    fen = derived.fen;
    lastMove = lastMove ?? derived.lastMove;
  }

  // One ply earlier, so the board can play the opponent's setup move on load.
  // Optional by design — a puzzle is perfectly playable without it.
  const setupFen = hasPly ? positionFromPgn(pgn, p.initialPly! - 1)?.fen : undefined;

  return {
    id: p.id,
    fen,
    solution: p.solution,
    rating: typeof p.rating === 'number' ? p.rating : 1500,
    // `themes` is an array in the real payload — the old plan modelled it as a
    // single enum, which would have thrown away all but one label.
    themes: Array.isArray(p.themes) ? p.themes : [],
    lastMove,
    setupFen,
  };
}

async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new LichessError('Rate limited by Lichess — backing off', 429);
    }
    if (!res.ok) {
      throw new LichessError(`Lichess returned ${res.status} for ${path}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof LichessError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LichessError('Request to Lichess timed out');
    }
    throw new LichessError(
      err instanceof Error ? err.message : 'Network request to Lichess failed',
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface NextPuzzleOptions {
  difficulty?: Difficulty;
  /** A theme name such as 'fork' or 'mateIn2'. */
  angle?: string;
}

/** Fetch the next puzzle. This is the primary source. */
export async function fetchNextPuzzle(opts: NextPuzzleOptions = {}): Promise<Puzzle> {
  const params = new URLSearchParams();
  if (opts.difficulty) params.set('difficulty', opts.difficulty);
  if (opts.angle) params.set('angle', opts.angle);
  const qs = params.toString();
  return parsePuzzle(await getJson(`/puzzle/next${qs ? `?${qs}` : ''}`));
}

export async function fetchDailyPuzzle(): Promise<Puzzle> {
  return parsePuzzle(await getJson('/puzzle/daily'));
}

export async function fetchPuzzleById(id: string): Promise<Puzzle> {
  return parsePuzzle(await getJson(`/puzzle/${encodeURIComponent(id)}`));
}

/**
 * Fetch several puzzles.
 *
 * There is no batch endpoint, so this is sequential calls to /next with a
 * small delay to stay polite. Failures are tolerated — callers get whatever
 * arrived, and the bundled seed set covers the rest.
 */
export async function fetchPuzzleBatch(
  count: number,
  opts: NextPuzzleOptions = {},
  delayMs = 250,
): Promise<Puzzle[]> {
  const out: Puzzle[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    try {
      const puzzle = await fetchNextPuzzle(opts);
      if (!seen.has(puzzle.id)) {
        seen.add(puzzle.id);
        out.push(puzzle);
      }
    } catch (err) {
      // Stop early on rate limiting; otherwise skip this one and continue.
      if (err instanceof LichessError && err.status === 429) break;
    }
    if (i < count - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return out;
}
