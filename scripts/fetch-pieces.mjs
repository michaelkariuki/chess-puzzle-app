/**
 * Downloads the Cburnett chess piece set and inlines it into a TypeScript
 * module, so the app has no runtime file IO and no asset-bundler config.
 *
 * Source: lichess-org/lila, public/piece/cburnett
 * Licence: CC BY-SA 3.0 — attribution is required if this app is distributed.
 *          See Docs/PLAN.md §3.2.
 *
 * Usage: pnpm fetch-pieces
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/components/board/pieces.generated.ts');

const BASE =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett';

const CODES = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
];

async function fetchPiece(code) {
  const url = `${BASE}/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status} from ${url}`);
  const svg = (await res.text()).trim();
  if (!svg.startsWith('<svg')) throw new Error(`${code}: response is not an SVG`);
  return svg;
}

async function main() {
  console.log(`Fetching ${CODES.length} pieces from lichess-org/lila…`);

  const entries = [];
  for (const code of CODES) {
    const svg = await fetchPiece(code);
    entries.push([code, svg]);
    console.log(`  ${code}  ${svg.length} bytes`);
  }

  const body = entries
    .map(([code, svg]) => `  ${code}: ${JSON.stringify(svg)},`)
    .join('\n');

  const file = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: pnpm fetch-pieces
 *
 * Cburnett chess pieces from lichess-org/lila.
 * Licensed CC BY-SA 3.0 — attribution required if this app is distributed.
 */

import type { PieceCode } from '@/src/chess/types';

export const PIECE_SVG: Record<PieceCode, string> = {
${body}
};
`;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, file, 'utf8');
  console.log(`\nWrote ${OUT} (${file.length} bytes)`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
