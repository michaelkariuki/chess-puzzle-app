/**
 * Generates the bundled offline puzzle set.
 *
 * The app must work with no network at all, and there is no Lichess batch
 * endpoint (see Docs/PLAN.md §2.1), so we collect a spread of puzzles at build
 * time and commit the result.
 *
 * Two modes:
 *   pnpm seed-puzzles              — sample /api/puzzle/next across themes and
 *                                    difficulties (default; no big download)
 *   pnpm seed-puzzles --from-db    — stream the 304 MB bulk database and sample
 *                                    evenly by rating band (needs `zstd`)
 *
 * Usage: pnpm seed-puzzles [--count N] [--from-db]
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DEFAULT = resolve(HERE, '../src/data/seed-puzzles.json');

const args = process.argv.slice(2);
const FROM_DB = args.includes('--from-db');
const COUNT = Number(args[args.indexOf('--count') + 1]) || 80;
/** Lichess throttles unauthenticated /next aggressively; be patient. */
const DELAY_MS = Number(args[args.indexOf('--delay') + 1]) || 2500;
const OUT = args.includes('--out')
  ? resolve(process.cwd(), args[args.indexOf('--out') + 1])
  : OUT_DEFAULT;
/** Start fresh instead of merging into whatever is already there. */
const FRESH = args.includes('--fresh');

/** Spread requests across themes and levels so the set isn't monotonous. */
const ANGLES = [
  'fork', 'pin', 'skewer', 'mateIn1', 'mateIn2', 'discoveredAttack',
  'hangingPiece', 'deflection', 'backRankMate', 'sacrifice',
];
const DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Apply one UCI move to a FEN, returning the resulting position. */
function positionAfter(fen, uci) {
  try {
    const c = new Chess(fen);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion });
    return { fen: c.fen() };
  } catch {
    return null;
  }
}

/**
 * Replay a game PGN to `initialPly` (0-indexed ply of the setup move) to get
 * the puzzle's starting position. Mirrors src/chess/fen-from-pgn.ts.
 */
function positionFromPgn(pgn, initialPly) {
  if (!pgn || !Number.isInteger(initialPly) || initialPly < 0) return null;
  try {
    const full = new Chess();
    full.loadPgn(pgn);
    const history = full.history({ verbose: true });
    if (initialPly >= history.length) return null;

    const board = new Chess();
    for (let i = 0; i <= initialPly; i++) board.move(history[i].san);
    return { fen: board.fen(), lastMove: history[initialPly].lan };
  } catch {
    return null;
  }
}

async function fetchFromApi(count) {
  const puzzles = [];
  const seen = new Set();
  let consecutiveFailures = 0;

  for (let i = 0; puzzles.length < count && i < count * 3; i++) {
    const angle = ANGLES[i % ANGLES.length];
    const difficulty = DIFFICULTIES[Math.floor(i / ANGLES.length) % DIFFICULTIES.length];
    const url = `https://lichess.org/api/puzzle/next?angle=${angle}&difficulty=${difficulty}`;

    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429) {
        console.log('\n  rate limited — pausing 30s');
        await sleep(30_000);
        consecutiveFailures = 0;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { puzzle, game } = await res.json();
      if (!puzzle?.id || seen.has(puzzle.id)) {
        await sleep(DELAY_MS);
        continue;
      }

      // /puzzle/next does NOT return `fen` — only /puzzle/daily does. The
      // position has to be replayed from the game PGN up to initialPly.
      const position = puzzle.fen
        ? { fen: puzzle.fen, lastMove: puzzle.lastMove }
        : positionFromPgn(game?.pgn, puzzle.initialPly);

      // One ply earlier, for the opening animation.
      const before = positionFromPgn(game?.pgn, puzzle.initialPly - 1);

      if (!position) {
        console.log(`\n  skipping ${puzzle.id}: no derivable position`);
        await sleep(DELAY_MS);
        continue;
      }

      seen.add(puzzle.id);
      puzzles.push({
        id: puzzle.id,
        fen: position.fen,
        setupFen: before?.fen,
        solution: puzzle.solution,
        rating: puzzle.rating,
        themes: puzzle.themes ?? [],
        lastMove: puzzle.lastMove ?? position.lastMove,
      });
      consecutiveFailures = 0;
      process.stdout.write(`\r  collected ${puzzles.length}/${count}`);
    } catch (err) {
      if (++consecutiveFailures >= 8) {
        console.log(`\n  giving up after 8 consecutive failures: ${err.message}`);
        break;
      }
      // Network hiccup or soft throttle — back off progressively.
      await sleep(5_000 * consecutiveFailures);
    }
    await sleep(DELAY_MS);
  }

  process.stdout.write('\n');
  return puzzles;
}

async function fetchFromDb(count) {
  const { spawn } = await import('node:child_process');
  const readline = await import('node:readline');

  console.log('Streaming lichess_db_puzzle.csv.zst (304 MB)…');
  const res = await fetch('https://database.lichess.org/lichess_db_puzzle.csv.zst');
  if (!res.ok) throw new Error(`Database download failed: HTTP ${res.status}`);

  // zstd -d reads the compressed stream on stdin, writes CSV on stdout.
  const zstd = spawn('zstd', ['-d', '-c'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const { Readable } = await import('node:stream');
  const download = Readable.fromWeb(res.body);

  // We stop reading as soon as the rating buckets fill, long before the 304 MB
  // file is exhausted. Tearing down mid-stream makes the still-running download
  // write into a closed pipe, so EPIPE here is expected, not a failure.
  const ignoreTeardownError = (err) => {
    if (err && err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error(`\n  stream error: ${err.message}`);
    }
  };
  zstd.stdin.on('error', ignoreTeardownError);
  download.on('error', ignoreTeardownError);
  zstd.on('error', ignoreTeardownError);

  download.pipe(zstd.stdin);

  // Even coverage across the ratings people actually play at.
  const bands = [
    [400, 700], [700, 900], [900, 1100], [1100, 1300], [1300, 1500],
    [1500, 1700], [1700, 1900], [1900, 2100], [2100, 2300], [2300, 2600],
  ];
  const perBand = Math.ceil(count / bands.length);
  const buckets = bands.map(() => []);

  const rl = readline.createInterface({ input: zstd.stdout, crlfDelay: Infinity });
  let first = true;

  for await (const line of rl) {
    if (first) { first = false; continue; } // header
    const [id, fen, moves, ratingStr, , , , themes] = line.split(',');
    const rating = Number(ratingStr);
    if (!id || !fen || !moves || !Number.isFinite(rating)) continue;

    const bandIdx = bands.findIndex(([lo, hi]) => rating >= lo && rating < hi);
    if (bandIdx === -1 || buckets[bandIdx].length >= perBand) continue;

    // CRITICAL: the bulk CSV and the API disagree on move semantics.
    // In the CSV, `FEN` is the position BEFORE the opponent's setup move, and
    // Moves[0] IS that setup move — the player's line starts at Moves[1].
    // The API's /puzzle/daily `fen`, by contrast, already has the solver to
    // move. Importing the CSV as-is would ask the player to play the
    // opponent's move, and every legality check would still pass.
    const allMoves = moves.split(' ');
    if (allMoves.length < 2) continue;

    const setup = positionAfter(fen, allMoves[0]);
    if (!setup) continue;

    buckets[bandIdx].push({
      id,
      fen: setup.fen,
      // The CSV's own FEN column is the position BEFORE the setup move, which
      // is exactly what the opening animation needs.
      setupFen: fen,
      solution: allMoves.slice(1),
      rating,
      themes: themes ? themes.split(' ') : [],
      lastMove: allMoves[0],
    });

    const total = buckets.reduce((n, b) => n + b.length, 0);
    process.stdout.write(`\r  collected ${total}/${count}`);
    if (buckets.every((b, i) => b.length >= perBand)) break;
  }

  rl.close();
  download.destroy();
  zstd.stdin.destroy();
  zstd.kill('SIGKILL');
  process.stdout.write('\n');
  return buckets.flat();
}

async function main() {
  const puzzles = FROM_DB ? await fetchFromDb(COUNT) : await fetchFromApi(COUNT);

  if (puzzles.length === 0) {
    console.error('No puzzles collected — leaving the existing seed file alone.');
    process.exit(1);
  }

  // Merge with whatever we already have — Lichess throttles hard, so a run
  // that only collects a handful should still add to the set, not replace it.
  let existing = [];
  if (!FRESH && existsSync(OUT)) {
    try { existing = JSON.parse(readFileSync(OUT, 'utf8')); } catch { existing = []; }
  }
  const byId = new Map(existing.map((p) => [p.id, p]));
  let added = 0;
  for (const p of puzzles) if (!byId.has(p.id)) { byId.set(p.id, p); added++; }
  const merged = [...byId.values()];
  console.log(`  ${added} new, ${existing.length} already had -> ${merged.length} total`);

  merged.sort((a, b) => a.rating - b.rating);
  puzzles.length = 0;
  puzzles.push(...merged);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(puzzles, null, 0), 'utf8');

  const ratings = puzzles.map((p) => p.rating);
  console.log(`\nWrote ${puzzles.length} puzzles to ${OUT}`);
  console.log(`  rating range : ${Math.min(...ratings)} – ${Math.max(...ratings)}`);
  console.log(`  median       : ${ratings[Math.floor(ratings.length / 2)]}`);
  console.log(`  file size    : ${(JSON.stringify(puzzles).length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
