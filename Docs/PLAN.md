# Chess Puzzle App — Implementation Plan

**Status:** active · **Written:** 2026-08-07 · **Supersedes:** the AI-generated plan set (kept in `original-ai-plan-backup.zip`)

Every external claim in this document was verified by running the request or querying the
registry. Where something is unverified, it says so explicitly. Nothing here is marked
"ready" on the basis of it sounding plausible.

---

## 1. What we are building

A single-player chess tactics trainer for Android and iOS. You open it, you get a position
appropriate to your strength, you play the winning line, your rating moves. That is the whole
product.

**Scope discipline:** this is a personal hobby project for one developer. There is no team, no
stakeholder board, no beta cohort, no app-store deadline. The plan is sized accordingly —
roughly **two weeks of evenings** to a genuinely usable app, not ten weeks of phases.

### In scope for v1

- Interactive board, tap-to-move, legal-move highlighting
- Puzzles served at your rating, from Lichess
- Solve/fail detection across multi-move lines, with the opponent replying automatically
- Local Elo rating that adapts what you're served
- Offline play from a bundled seed set plus a cached queue
- Progress stats: solved count, accuracy, current and best streak
- Light/dark theme

### Explicitly deferred

| Deferred | Why |
|---|---|
| Stockfish engine | Genuinely hard on React Native (see §3.3). Not needed — Lichess puzzles ship their solutions. |
| Custom puzzle generation | Depends on Stockfish. |
| Puzzle editor | No user demand for a solo app. |
| Accounts, cloud sync, social | Local-only is the stated goal. |
| Sound effects | Nice-to-have; add once the core loop is fun. |
| Drag-to-move | Tap-to-move first. Drag is an enhancement, not a requirement. |

---

## 2. Verified ground truth

This section is the part the previous plan got wrong. Everything below was checked on
2026-08-07.

### 2.1 Puzzle source — `GET /api/puzzle/next`

**This is the endpoint we build on.** Unauthenticated, no API key, supports difficulty
selection. Verified responses:

| Request | Result |
|---|---|
| `/api/puzzle/next` | `200` — puzzle `BKPbj`, rating 1396 |
| `/api/puzzle/next?difficulty=easiest` | `200` — puzzle `Ysaaa`, rating 1062 |
| `/api/puzzle/next?angle=fork&difficulty=harder` | `200` — puzzle `FqxCV`, rating 1597 |

`difficulty` accepts `easiest | easier | normal | harder | hardest`. `angle` accepts a theme
name (`fork`, `pin`, `mateIn2`, …). Difficulty is relative to a baseline, not an absolute
rating filter — so we filter client-side against our own rating too (§4.3).

**Endpoints that do NOT exist** — the old plan depended on both:

- `GET /api/puzzle/batch?max=10` → **`404`**. There is no public batch endpoint.
- `GET /api/puzzle/daily?max=N&minRating=R` → returns `200` but **ignores both parameters**
  and returns exactly one puzzle. A batch fetcher built on it silently returns 1 item forever.

`GET /api/puzzle/daily` (no params) and `GET /api/puzzle/{id}` both work and are useful for a
daily-puzzle feature and for re-fetching a known puzzle.

### 2.2 The actual response shape

Fetched live. This is what the code must model — not the invented shape in the old plan:

```jsonc
{
  "game": { "id": "kV8W7ax0", "pgn": "e4 g6 d4 Nf6 …", "players": [ … ] },
  "puzzle": {
    "id": "hXKWW",
    "rating": 2066,                    // plain number — NOT a glicko2 object
    "plays": 1234,
    "themes": ["long","mateIn3","sacrifice","master","middlegame",
               "kingsideAttack","smotheredMate"],   // ARRAY, often 5-7 entries
    "fen": "r1br3k/pp2pQ1p/1qn3p1/8/2BbN3/1P6/P4PPP/3R1RK1 w - - 1 1",
    "solution": ["e4g5","d4g7","f7g8","d8g8","g5f7"],  // UCI strings, NOT SAN
    "lastMove": "b8c6",
    "initialPly": 33
  }
}
```

Four things the old plan modelled wrongly, each of which would have broken at runtime:

1. `themes` is a **string array**, not a single `theme` enum.
2. `rating` is a **number**, not `{glicko2, deviation, volatility}`. Deviation and volatility
   are not exposed.
3. `solution` is **UCI** (`e4g5`), not SAN (`Ng5`). `chess.js` accepts UCI via
   `{from, to, promotion}` — you must slice the string, not pass it whole.
4. There are **no alternative lines**. The API gives exactly one solution. Any UI promising
   "explore other winning moves" has no data behind it.

**Solution semantics (important, and easy to get wrong):** `fen` is the position with the
solver to move, and `solution[0]` is *the solver's first move*. Even indices are yours, odd
indices are the opponent's forced reply, which we play automatically. Verified against puzzle
`hXKWW`: FEN says `w` to move, `solution[0] = e4g5` is White's knight to g5, and the themes
include `mateIn3` — consistent with a 5-ply line where White plays plies 0, 2, 4.

> **Correction (found during implementation).** The payload above is `/api/puzzle/daily`.
> **`/api/puzzle/next` — our primary source — does not include `fen` at all.** It returns the
> full game PGN plus `initialPly`, and the position must be replayed out of them. This was
> caught only because the first generated seed file contained 12 puzzles with no position;
> the shape had been assumed to carry over from the endpoint that *was* inspected.
>
> `initialPly` is the **0-indexed ply of the last move played** — the move that sets up the
> puzzle — so the position is the result of replaying plies `0..initialPly` inclusive.
> Validated against `hXKWW`, which uniquely carries `pgn`, `initialPly` *and* `fen`: the
> replayed position matches Lichess's `fen` exactly on piece placement, side to move, castling
> rights and en-passant square. Only the halfmove/fullmove counters differ — Lichess normalises
> those to `1 1` — and nothing in a puzzle depends on them.
>
> Implemented in `src/chess/fen-from-pgn.ts`, applied as a fallback in `src/data/lichess.ts`,
> and locked down by `src/chess/fen-from-pgn.test.ts` plus a `src/data/seed-puzzles.test.ts`
> guard that replays every bundled puzzle's whole solution line for legality.

### 2.3 Bulk database (for the offline seed set)

`https://database.lichess.org/lichess_db_puzzle.csv.zst` → `206`, **304 MB compressed**,
last modified 2026-08-02. ~5M puzzles, columns: `PuzzleId,FEN,Moves,Rating,RatingDeviation,
Popularity,NbPlays,Themes,GameUrl,OpeningTags`.

Far too large to bundle. We use it **at build time only**, via a script that samples N puzzles
per rating band into a small committed JSON file. Because ratings are distributed randomly
through the file, the buckets fill within the first few thousand rows and the stream is
aborted — so the full 304 MB is never actually transferred.

> **This is now the primary seed path**, not the fallback. `/api/puzzle/next` turns out to be
> throttled hard for unauthenticated clients: a paced run at one request per 2.5–4 s was
> `429`-ed within a couple of dozen requests and, across two attempts, collected 12 puzzles
> and then 0. The bulk DB produced 120 puzzles spanning 607–2391 in one run.
>
> **Move semantics differ between the CSV and the API, and the difference is silent.** In the
> CSV, the `FEN` column is the position *before* the opponent's setup move and `Moves[0]` *is*
> that setup move — the player's line begins at `Moves[1]`. The API's `fen` already has the
> solver to move. Importing the CSV without dropping the first move leaves every line fully
> legal while asking the player to move for the wrong side, so a legality check passes.
> `src/data/seed-puzzles.test.ts` closes this by asserting every `mateInN` puzzle ends in
> checkmate *delivered by the solver*; 38 of the 120 seeds are mates, and all 38 fail that
> assertion under the off-by-one.

### 2.4 Package reality check

Every version the old checklist listed was wrong. Verified against the npm registry:

| Package | Old plan claimed | Actual | Decision |
|---|---|---|---|
| `react-native-stockfish` | "1.0+ ✅ Ready" | **404 — does not exist** | Dropped with Stockfish |
| `stockfish.js` | "16+" | latest `10.0.2`, untouched since 2022 | Not used |
| `@types/chess.js` | "1.0+" | latest `0.13.7` (for chess.js 0.13) | **Never install** — chess.js 1.x ships its own types; this would break them |
| `victory-native` | "36.x" | `41.26.0` (v40+ is a Skia rewrite) | Not needed for v1 stats |
| `react-chessboard` | not mentioned | `5.8.3`, installed | **Remove** — see §3.1 |
| `react-native-chessboard` | not mentioned | `0.2.0`, MIT, published 2026-06-06 | Considered, rejected — see §3.1 |

---

## 3. Key decisions

### 3.1 The board: hand-rolled, not a library

The board is the product. It needs puzzle-specific behaviour that general-purpose board
components resist: flashing a square red on a wrong move, highlighting a hint square,
animating the opponent's forced reply, replaying the solution, and locking input while the
opponent moves.

**`react-chessboard@5.8.3` — the one currently installed — cannot run on native at all.**
Its resolved dependency block in `pnpm-lock.yaml:8646` shows `@dnd-kit/core`,
`@dnd-kit/modifiers`, and a `react-dom` peer. `@dnd-kit` is DOM drag-and-drop; it needs
`document` and HTML pointer events. It works only under `expo start --web`. It is being
removed.

**`react-native-chessboard@0.2.0`** is a real, MIT-licensed, recently published alternative and
was seriously considered. Rejected for two reasons: it peer-depends on
`@shopify/react-native-skia`, a heavy native dependency we otherwise have no use for; and at
`0.2.0` its API is young and gives limited control over exactly the puzzle-specific
highlighting listed above.

**Decision: render the board ourselves.** An 8×8 grid of `Pressable` squares with tap-select →
tap-destination. Zero drag complexity, ~300 lines, total control over highlight states. The
only new dependency is `react-native-svg` for the pieces — a standard, well-supported Expo
package, far lighter than Skia.

### 3.2 Pieces: Cburnett SVGs, inlined at build time

The classic Lichess piece set, fetched from `lichess-org/lila` (each file verified reachable,
590–910 bytes). A script downloads all 12 and inlines them into a single generated TypeScript
module, so there is no runtime file IO and no asset-bundling configuration.

> **Attribution:** the Cburnett set is licensed **CC BY-SA 3.0**. If this app is ever
> distributed publicly, credit must appear in an about/licenses screen. Tracked as a release
> blocker in §6.

Unicode chess glyphs were rejected — they render inconsistently across Android and iOS system
fonts, and often fall back to hollow outlines that make white and black pieces hard to tell
apart.

### 3.3 Why Stockfish is out

The old plan gave Stockfish 6 days and a "✅ Compatible" certification resting on a package
that does not exist. Reality: getting a WASM engine running under React Native means dealing
with an absent `WebAssembly` global on some JS engines, no `Worker` API, and either a
`WebView` bridge or a native module you compile yourself. That is a multi-week research spike
with an uncertain outcome.

It is also **unnecessary**. Lichess puzzles arrive with their solution lines already computed.
The engine buys us custom puzzle generation and nothing else, and custom generation is the
least valuable feature in the backlog. Cut.

### 3.4 Architecture: shallow, not layered

No `/core` + `/adapters` split, no `Repository<T>`, no factories, no event bus. That structure
made sense in the old plan's telling but in practice it would mean hand-wrapping `chess.js` —
a library that is *already* pure, framework-free, and dependency-free — in `Position.ts`,
`Move.ts`, `Board.ts`, and `Piece.ts`. That is an abstraction over an abstraction, and about a
week of Phase 1 spent on it.

What we actually need is a clean split between **logic that can be unit-tested without
React** and **components**. That is one boundary, and a directory is enough to express it:

```
src/
├── chess/                    # pure TS, no React, no react-native imports
│   ├── types.ts              # Puzzle, PuzzleAttempt, Square, PieceCode
│   ├── uci.ts                # UCI <-> chess.js move conversion
│   ├── puzzle-session.ts     # the solve state machine (the heart of the app)
│   └── rating.ts             # Elo
│
├── data/
│   ├── lichess.ts            # API client — /api/puzzle/next + /{id}
│   ├── storage.ts            # AsyncStorage: progress, settings, puzzle queue
│   └── seed-puzzles.json     # bundled offline set (generated)
│
├── components/
│   ├── board/
│   │   ├── Board.tsx         # 8x8 grid, tap handling
│   │   ├── Square.tsx        # one square + highlight states
│   │   ├── Piece.tsx         # SVG piece renderer
│   │   └── pieces.generated.ts   # inlined Cburnett SVGs (generated)
│   └── ...                   # stat tiles, buttons
│
└── state/
    └── PuzzleContext.tsx     # useReducer over puzzle-session
```

`app/` keeps expo-router file-based routing — the repo already uses it and it works.

### 3.5 App flow

The first build dropped you straight onto a board with no entry point, no result step and
no way back. The flow now follows `UI_UX_Flow_MVP.md`:

```
    (tabs)/index          puzzle              (tabs)/progress
  ┌──────────────┐   ┌──────────────┐      ┌──────────────────┐
  │     Home     │──▶│    Puzzle    │      │  Progress + set- │
  │  rating,     │   │  board +     │      │  tings, offline  │
  │  streak,     │◀──│  panel       │      │  coverage, about │
  │  progress    │   │              │      └──────────────────┘
  └──────┬───────┘   └──────┬───────┘               ▲
         │                  │ solved/failed         │
         └──────────────────┴───────────────────────┘
                    result banner → Next / Home
```

Home is the tab entry point; the puzzle is a pushed stack route, so the platform back
gesture works and there is always a way out. The result is an inline banner swap rather than
a separate route — a full screen transition for a two-line outcome is friction, and staying
on the board lets you see the final position.

**One subtlety:** the puzzle screen loads a fresh puzzle on *mount only*, guarded by a ref.
Keying it off "is the session finished" instead would fire a new load the instant you solved
one, wiping the result before it could be read.

### 3.6 Web and responsive layout

One set of screens, not a separate web UI. A `useLayout()` hook exposes a single
`WIDE_BREAKPOINT` (900px); above it the puzzle screen puts the board and the info panel side
by side, below it they stack. `Screen` caps content width and centres it, which is what fixes
the real desktop problem — react-native-web stretches every control to the full window, so
buttons ran the entire width of a monitor.

Board size is fitted against *both* width and height budgets. Height matters: on a short
laptop window a width-only calculation pushes the board off the bottom of the screen.

A separate `.web.tsx` screen set was considered and rejected — it doubles the screens to keep
in sync for a layout difference a breakpoint already expresses.

### 3.7 Colour and contrast

The template ships only `text`/`background`/`tint`, which is why the first pass hardcoded hex
values in the puzzle screen — and those rendered near-black on the dark background. Every
colour now lives in `src/theme/colors.ts` as a semantic token defined for both schemes.

Contrast is asserted, not eyeballed: `colors.test.ts` implements the WCAG ratio and checks
every foreground against the surfaces it is drawn on. This caught a live bug during the
rewrite — in dark mode the accent is a *light* green, so white-on-accent measured 2.15:1. The
test also asserts that the original bad pairing (`#1a1a1a` on the dark surface) *fails*, so
the check is proven capable of catching the defect it exists to prevent.

### 3.8 Animation

Reanimated 4 (`react-native-worklets` plugin is auto-wired by `babel-preset-expo` — verified,
since a missing plugin fails silently).

| Motion | Where | Why |
|---|---|---|
| Piece slide, 190 ms | `MovingPiece` overlay | Pieces travel rather than teleport |
| Board shake | wrong move | The red flash alone is easy to miss |
| Highlight cross-fade | square overlays | Keyed by colour so tints don't snap |
| Legal-dot zoom-in | selection | Makes the affordance feel responsive |
| Banner cross-fade / result rise | result panel | Marks the state change |

The sliding piece is drawn on an overlay above the grid while its destination square renders
empty. Its position comes from `squareToXY`, unit-tested as the *exact inverse* of the grid's
own `cellCoords` mapping — if those two ever disagreed, pieces would land off-square.

Move detection lives entirely in the view layer (`use-move-animation.ts`), derived from
watching the FEN. The solve machine stays pure, and animation has no path to affect game logic.

### 3.9 State management

`useReducer` inside a context, wrapping the `puzzle-session` state machine. No Redux, no
Zustand. The app has one screen with meaningful state; a reducer covers it. TanStack Query
(already installed) handles the network cache for puzzle fetching. AsyncStorage handles
persistence.

---

## 4. The solve engine

This is the only genuinely subtle piece of logic in the app, so it gets specified properly.

### 4.1 State machine

```
                 ┌────────────────────────────────────────┐
                 ▼                                        │
  loading ──▶ awaiting-move ──(correct, line continues)──▶ opponent-replying
                 │  │                                     (300ms delay)
                 │  │
                 │  └──(correct, line exhausted)──▶ solved
                 │
                 └──(wrong)──▶ wrong (flash red, revert) ──▶ awaiting-move
                                    │
                              (3rd wrong / give-up)
                                    ▼
                                 failed
```

### 4.2 Rules

- Load `fen` into `chess.js`. The side to move is the solver; the board orients to them.
- Maintain `plyIndex`, starting at 0. Even = solver, odd = opponent.
- A user move is **correct** if its UCI string equals `solution[plyIndex]`.
- **Underpromotion caveat:** UCI encodes promotion as a 5th character (`e7e8q`). Compare full
  UCI strings, never just `from`+`to`, or a puzzle whose solution is `=N` will accept `=Q`.
- **Alternative-mate caveat:** if a different move also delivers mate, Lichess still counts
  only its own line. We accept `solution[plyIndex]` only. Correct behaviour, but the UI should
  say "not the puzzle's line" rather than "wrong" when the played move is itself a mate.
- On correct + `plyIndex+1 < solution.length`: play the opponent's `solution[plyIndex+1]` after
  a 300 ms delay, advance `plyIndex` by 2. Input is locked during the delay.
- On correct + line exhausted: **solved**.
- On wrong: increment `wrongAttempts`, flash the square, revert the move. Three wrong attempts
  or an explicit give-up → **failed**.
- Hints are progressive: 1st tap highlights the piece to move; 2nd shows the destination; 3rd
  plays the move (and marks the puzzle unrated).

### 4.3 Rating

Standard Elo, user vs. puzzle:

```
expected = 1 / (1 + 10^((puzzleRating - userRating) / 400))
userRating += K * (score - expected)      // score 1 solved, 0 failed
```

`K = 32` below 50 solved puzzles, then `K = 16`. Solving with hints scores 0.5 and does not
raise the rating above the puzzle's.

Glicko-2 was in the old plan; it is overkill for a single-player local rating and needs
rating-period bookkeeping we have no use for.

**Difficulty selection:** map our rating delta onto the `difficulty` parameter, then filter
client-side — fetch, and if the returned puzzle is more than ±300 from our rating, keep it in
the queue for later rather than discarding it.

---

## 5. Build order

Each step ends with something runnable. No step depends on a later one.

### Step 1 — Dependencies (30 min)

- Remove `react-chessboard` (DOM-only), `@react-navigation/stack` (redundant under
  expo-router), `react-native-vector-icons` (duplicates `@expo/vector-icons`, needs native
  font linking).
- Add `react-native-svg` via `npx expo install` so the version matches SDK 54.
- Keep `react-native-paper`? **No** for v1 — the template's `ThemedText`/`ThemedView`/`Colors`
  system already exists and Paper would mean maintaining two palettes. Remove it. Revisit if we
  want Material components later.

### Step 2 — Chess core (2–3 h)

`types.ts`, `uci.ts`, `rating.ts`, `puzzle-session.ts`. Pure TypeScript, no React. This is the
part worth testing properly.

### Step 3 — Piece assets + board (3–4 h)

`scripts/fetch-pieces.mjs` → `pieces.generated.ts`. Then `Board`, `Square`, `Piece`. Renders a
FEN, highlights selection and legal moves, emits moves.

### Step 4 — Puzzle screen (3–4 h)

Wire board to session. Header with rating and progress, info panel with themes, hint/reset/
give-up actions, solved/failed result card. Follows the layouts in `UI_UX_Flow_MVP.md`, which
is the one document from the original set worth building from.

### Step 5 — Data layer (2–3 h)

`lichess.ts` client, `storage.ts` persistence, seed puzzle script, offline fallback and a
prefetch queue so there is always a next puzzle.

### Step 6 — Stats & polish (2–3 h)

Home screen tiles, stats screen, theme toggle, streak tracking.

### Testing

Jest with `jest-expo`, focused on `src/chess/` — the solve state machine and the Elo maths are
where correctness actually matters and where tests are cheap because there is no React
involved. Specifically: multi-move lines, underpromotion comparison, wrong-move revert, hint
scoring, rating convergence.

No Detox, no 90% coverage gate, no three-workflow CI pipeline. Those were team ceremony in a
solo project. A `pnpm typecheck && pnpm lint && pnpm test` script is the quality gate.

---

## 6. Known risks

| Risk | Assessment | Response |
|---|---|---|
| `/api/puzzle/next` rate-limiting | **Confirmed, and more aggressive than expected.** Not a hypothetical: paced build-time runs were `429`-ed within a couple of dozen requests. The old plan's "100 req/min" figure was invented; the real allowance for unauthenticated clients is far lower. | Bundled seed set means the app works with zero network. Prefetch queue keeps 20 puzzles ahead and refills opportunistically. Back off on `429`. A hard-coded fallback puzzle in `puzzle-source.ts` guarantees `nextPuzzleFor` can never fail. Regenerate seeds via `--from-db`, not the API. |
| Board performance | 64 `Pressable`s with SVG children, re-rendered per move | Memoize `Square`, key by square name, only re-render changed squares. Measure before optimising further. |
| `react-native-svg` + SDK 54 / RN 0.81 | Not yet verified in this project | Install via `npx expo install` (SDK-matched), verify render on device in Step 3. If it fails, fall back to bundled PNGs via `expo-image`. |
| Cburnett CC BY-SA attribution | Required if distributed | Licenses screen before any public release. Not a blocker for personal use. |
| Rating cold-start feels wrong | Everyone starts at 1200 regardless of actual strength | K=32 early converges within ~20 puzzles. Optionally offer a "roughly how strong are you?" prompt on first run. |

---

## 7. What success looks like

Not "99.9% crash-free sessions" or ">4.5 stars" — this app will never be in a store with
enough users to measure either. The real bar:

- You can open it on a plane and solve puzzles.
- A wrong move feels instant; a solve feels good.
- After 30 puzzles the difficulty is noticeably tuned to you.
- The chess logic has tests, so a refactor doesn't silently break underpromotion.

---

## Appendix: what changed from the original plan and why

| Original | Now | Reason |
|---|---|---|
| Batch-fetch by rating from `/api/puzzle/batch` | `/api/puzzle/next` + client-side filtering | The batch endpoint returns 404 |
| `/api/puzzle/daily?max=N&minRating=R` | `/api/puzzle/daily` for a daily-puzzle feature only | Params are silently ignored; returns 1 puzzle |
| Stockfish via `react-native-stockfish` | Cut entirely | Package does not exist; feature is unnecessary |
| `/core` + `/adapters`, Repository, factories, event bus | `src/chess` (pure) + `src/components` | Re-wrapping chess.js, which is already framework-agnostic |
| Glicko-2 | Elo | No opponent pool; rating periods unused |
| `theme: PuzzleTheme` | `themes: string[]` | Matches the actual payload |
| `alternativeLines: AlternativeLine[]` | Removed | API provides no such data |
| `solution: Move[]` (SAN assumed) | UCI strings, converted explicitly | Payload is UCI |
| 10 weeks, 5 phases, governance, ADRs, beta cohort | ~2 weeks, 6 steps | Solo hobby project |
| Detox E2E, >90% coverage gate, 3 CI workflows | Jest on `src/chess/`, one gate script | Proportion |
| React 18 / RN 0.74 / Expo 50 | React 19 / RN 0.81.5 / Expo 54 | Matches the actual repo |
