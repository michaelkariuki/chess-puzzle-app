# Chess Puzzles ♟️

A single-player chess tactics trainer. Puzzles are served at your rating, the rating
adapts as you solve, and everything works offline.

**One codebase, three targets** — Android, iOS and web — via Expo SDK 54 / React Native
0.81 / React 19 / TypeScript / expo-router. It is not "a web app": web is one of the
three outputs, and the same screens run natively on a phone. See
[Running it on your phone](#running-it-on-your-phone).

## Quick start

```bash
pnpm install
pnpm start          # then press 'a' (Android), 'i' (iOS), or 'w' (web)
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm start` | Expo dev server |
| `pnpm android` / `pnpm ios` / `pnpm web` | Launch on a target |
| `pnpm test` | Jest — chess core, theme, catalogue, puzzle data |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint via Expo |
| `pnpm check` | typecheck + lint + test — the quality gate |
| `pnpm fetch-pieces` | Regenerate the inlined piece SVGs |
| `pnpm seed-puzzles` | Regenerate puzzle data (see [Puzzle data](#puzzle-data)) |
| `pnpm make-sounds` | Regenerate the synthesised sound effects |

## What's in it

- Tap-to-move board with legal-move dots, last-move highlight and underpromotion
- The opponent's setup move animates in, so you see what you're answering
- Multi-move solution lines with the opponent replying automatically
- Progressive hints (piece → destination → played), which halve the rating gain
- Local Elo rating that steers which puzzles you're served
- Browse: 2,000 bundled puzzles, filterable by rating band and theme, searchable
- Configurable tries per puzzle (1 / 2 / 3 / 5 / unlimited)
- Sound for moves, captures, checks, solves and failures — toggleable
- Full offline play; light and dark themes; responsive phone → desktop layout

## Running it on your phone

Three routes, cheapest first.

### 1. Expo Go — fastest, no build

```bash
pnpm start
```

Install **Expo Go** from the App Store / Play Store, then scan the QR code. Phone and
computer must be on the same network; add `--tunnel` if they aren't.

Good for day-to-day development. Every library here is supported by Expo Go.

### 2. Standalone APK — a real installable app (Android)

```bash
npm install -g eas-cli
eas login                                    # free Expo account
eas build --platform android --profile preview
```

EAS builds it in the cloud and hands back a download link. Install the APK directly on
your phone (you'll need to allow install from unknown sources). No Play Store account, no
$25 fee. The `preview` profile in `eas.json` is configured to emit an APK rather than an
app bundle for exactly this.

For iOS the equivalent needs an **Apple Developer account ($99/year)** to install on a
physical device — Apple has no sideloading equivalent. Without one you're limited to the
iOS Simulator on a Mac.

### 3. App stores

```bash
eas build --platform android --profile production   # .aab for Play Store
eas build --platform ios --profile production
eas submit --platform android
```

Needs Google Play Console ($25 one-time) and/or Apple Developer ($99/year). Also needs
the Cburnett piece attribution shown in-app first — see [Attribution](#attribution).

### Web

```bash
pnpm web                                      # dev
npx expo export --platform web                # static build in dist/
```

The web build is a static site — deployable to any static host.

## Layout

```
app/                        expo-router routes
  (tabs)/index.tsx          Home
  (tabs)/browse.tsx         Browse the catalogue
  (tabs)/progress.tsx       Stats + settings
  puzzle.tsx                Puzzle screen (accepts ?id=)

src/
  chess/                    pure TypeScript — no React, no react-native
    types.ts                domain types
    uci.ts                  UCI <-> chess.js move conversion
    board-geometry.ts       square colours, orientation, pixel positions
    fen-from-pgn.ts         replays a game PGN to a puzzle's start position
    puzzle-session.ts       the solve state machine
    rating.ts               Elo + difficulty selection
  data/
    lichess.ts              Lichess API client
    puzzle-source.ts        queue -> network -> bundled seed resolution
    storage.ts              AsyncStorage persistence
    seed-puzzles.json       150 puzzles for offline play (generated)
    catalogue.json          2,000 browsable puzzles (generated)
  components/
    board/                  hand-rolled board, SVG pieces, move animation
    ui/                     Button, Banner, StatTile, SegmentedControl, Screen
  audio/                    sound selection (pure) + expo-audio playback
  screens/                  Home, Puzzle, Browse, Progress
  state/PuzzleContext.tsx   reducer over the solve machine
  theme/                    colour tokens, contrast checks, layout breakpoints

scripts/
  fetch-pieces.mjs          downloads + inlines the Cburnett piece set
  seed-puzzles.mjs          builds the puzzle data files
  make-sounds.mjs           synthesises the sound effects

assets/sounds/              7 generated WAVs (~145 KB)
```

Everything in `src/chess/` is framework-free and directly unit-tested — that's where
correctness actually matters.

## Your data

There is **no account and no server**. Everything lives on the device in AsyncStorage:

| Key | Holds |
|---|---|
| `chesspuzzle:v1:progress` | rating, solved, attempted, streaks, seen puzzle ids |
| `chesspuzzle:v1:settings` | theme, show-legal-moves, tries per puzzle, sound |
| `chesspuzzle:v1:queue` | prefetched puzzles for offline play |

Scope: on web that's `localStorage` (per-browser, cleared with site data); on native it's
per-install (lost on uninstall). No cloud sync, no cross-device. The only network traffic
is puzzle requests to Lichess. **Progress → Reset progress** erases everything.

*Known limitation:* `seen` is capped at 500 ids, so past 500 solved puzzles the oldest
lose their SOLVED badge in Browse. Rating and counts are unaffected.

## How puzzles are chosen

Your rating starts at 1200 and moves by standard Elo against each puzzle's rating:

```
expected = 1 / (1 + 10^((puzzleRating - userRating) / 400))
userRating += K * (score - expected)
```

`K = 32` for your first 50 puzzles, then 16. A hinted solve scores 0.5 and is capped at
the puzzle's own rating — you can't climb past a puzzle you needed help with.

Difficulty steering: first 5 puzzles → easier; streak ≥ 5 → harder; streak ≥ 3 → normal;
after a failure → easier. Candidates outside ±300 of your rating are skipped in favour of
a closer one.

Resolution order for the next puzzle: **prefetched queue → live Lichess fetch → bundled
seed set**. Each step prefers the closest rating match, and the last can never fail.

## Puzzle data

Two generated files, both committed:

- `src/data/seed-puzzles.json` — 150 puzzles, the offline guarantee
- `src/data/catalogue.json` — 2,000 puzzles, the browsable set (lazily `require`d, so
  the puzzle screen never pays for parsing it)

Regenerate:

```bash
# recommended — streams the Lichess bulk database, needs `zstd` on PATH
node ./scripts/seed-puzzles.mjs --from-db --count 2000 --fresh --out src/data/catalogue.json
node ./scripts/seed-puzzles.mjs --from-db --count 150  --fresh

# API mode — heavily rate-limited, collects very little in practice
pnpm seed-puzzles --count 60 --delay 4000
```

`--from-db` stops as soon as its rating buckets fill, so it does **not** download the
whole 304 MB file.

### Two things that will bite you if you touch this

**`/api/puzzle/next` does not return a `fen`.** Only `/api/puzzle/daily` does. The `next`
endpoint gives the game PGN plus `initialPly`, and the position must be replayed from
them — see `src/chess/fen-from-pgn.ts`. Assuming `fen` is present yields puzzle records
with no position, which typechecks fine and fails only at render time.

**The bulk CSV and the API disagree on move semantics.** In `lichess_db_puzzle.csv`, the
`FEN` column is the position *before* the opponent's setup move and `Moves[0]` *is* that
setup move — the player's line starts at `Moves[1]`. The API's `fen` already has the
solver to move. Import the CSV without dropping that first move and every line is still
perfectly legal while asking the player to move for the wrong side.
`seed-puzzles.test.ts` catches this by asserting every `mateInN` puzzle ends in checkmate
*delivered by the solver* — a plain legality check does not.

There is **no public Lichess endpoint that lists or searches puzzles** (`/api/puzzle/search`,
`/api/puzzle/list`, `/api/puzzles` all 404, verified 2026-08-07). That is why the browse
catalogue is bundled rather than paginated from the network.

## Sound

Seven effects — move, capture, check, correct, solved, wrong, failed — **synthesised from
scratch** by `scripts/make-sounds.mjs` (oscillators plus a seeded noise burst, written
straight to WAV). ~145 KB total.

They are generated rather than downloaded for a specific reason: Lichess's own sound files
are listed under **"Exceptions (non-free)"** in lila's `COPYING.md`, so they can't be
bundled. Generating avoids third-party assets entirely — the output is original work with
no attribution or licence obligation.

The generator is deterministic (seeded PRNG), so re-running produces byte-identical files
and won't churn the repo.

Which sound plays is decided by `src/audio/sound-for-move.ts`, a pure function that is
unit-tested: terminal puzzle states beat check, check beats capture, capture beats a quiet
move. Playback never throws into the move handler — if audio is unavailable the app carries
on silently. Toggle in Progress → Settings → Sound.

## Testing

```bash
pnpm check
```

161 tests, concentrated where correctness is checkable rather than spread for coverage:

- **Solve machine** — multi-move lines, underpromotion, wrong-move revert, hints,
  attempt limits, the intro phase
- **Rating** — Elo direction and magnitude, hint capping, convergence
- **Board geometry** — all 64 square colours against `chess.js` as ground truth, and
  `squareToXY` as the exact inverse of the grid's own mapping
- **Colour tokens** — WCAG contrast for every foreground/surface pairing, in both
  schemes, including a test asserting the original bad pairing *fails*
- **Puzzle data** — every bundled puzzle's solution replayed for legality, mate parity,
  and setup positions

## Attribution

Chess pieces are the **Cburnett** set by Colin M.L. Burnett, from
[lichess-org/lila](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett),
licensed **GPLv2+** (per lila's `COPYING.md`, "Exceptions (free)").

> **GPL is copyleft, not just attribution.** For personal use this is a non-issue. Before
> distributing publicly, decide deliberately: either license this project GPL-compatible,
> or swap the piece set for a permissively-licensed one. Attribution alone is not
> sufficient compliance. Attribution currently appears in Progress → About.

Puzzles from [Lichess](https://lichess.org), CC0.

**Sounds are generated, not sourced.** Lichess's own sound files are listed under
"Exceptions (**non-free**)" in the same `COPYING.md`, so they are not used here. See
[Sound](#sound).

## Planning

`Docs/PLAN.md` is the live plan — scope, verified API behaviour, decisions and their
reasons. `Docs/UI_UX_Flow_MVP.md` holds the original screen designs. The superseded
AI-generated plan set is preserved in `Docs/original-ai-plan-backup.zip`.
