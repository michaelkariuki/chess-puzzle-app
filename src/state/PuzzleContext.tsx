/**
 * App-wide puzzle state.
 *
 * A reducer over the pure state machine in src/chess/puzzle-session.ts. The
 * machine holds the chess rules; this holds the surrounding app concerns —
 * where the next puzzle comes from, persistence, and the hint overlay.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import {
  applyOpponentReply,
  beginPuzzle,
  clearWrongMove,
  createSession,
  INTRO_DELAY_MS,
  giveUp as giveUpSession,
  OPPONENT_REPLY_DELAY_MS,
  outcomeOf,
  playMove,
  restart,
  solverColor,
  takeHint,
  type Hint,
  type SessionState,
} from '@/src/chess/puzzle-session';
import { applyOutcome, difficultyFor } from '@/src/chess/rating';
import {
  INITIAL_PROGRESS,
  DEFAULT_SETTINGS,
  type Puzzle,
  type Settings,
  type Square,
  type UserProgress,
} from '@/src/chess/types';
import { loadCatalogue } from '@/src/data/catalogue';
import { fetchPuzzleById } from '@/src/data/lichess';
import { nextPuzzleFor, primeQueue } from '@/src/data/puzzle-source';
import {
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
} from '@/src/data/storage';

interface State {
  session: SessionState | null;
  progress: UserProgress;
  settings: Settings;
  hint: Hint | null;
  loading: boolean;
  error: string | null;
  /** True once persisted state has been read, so we don't save over it. */
  hydrated: boolean;
}

type Action =
  | { type: 'hydrated'; progress: UserProgress; settings: Settings }
  | { type: 'loading' }
  | { type: 'loaded'; puzzle: Puzzle; now: number; maxAttempts: number }
  | { type: 'load-failed'; message: string }
  | { type: 'session'; session: SessionState }
  | { type: 'hint'; session: SessionState; hint: Hint | null }
  | { type: 'clear-hint' }
  | { type: 'progress'; progress: UserProgress }
  | { type: 'settings'; settings: Settings };

const initialState: State = {
  session: null,
  progress: INITIAL_PROGRESS,
  settings: DEFAULT_SETTINGS,
  hint: null,
  loading: false,
  error: null,
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrated':
      return {
        ...state,
        progress: action.progress,
        settings: action.settings,
        hydrated: true,
      };
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return {
        ...state,
        loading: false,
        error: null,
        hint: null,
        session: createSession(action.puzzle, action.now, action.maxAttempts),
      };
    case 'load-failed':
      return { ...state, loading: false, error: action.message };
    case 'session':
      return { ...state, session: action.session };
    case 'hint':
      return { ...state, session: action.session, hint: action.hint };
    case 'clear-hint':
      return { ...state, hint: null };
    case 'progress':
      return { ...state, progress: action.progress };
    case 'settings':
      return { ...state, settings: action.settings };
  }
}

interface PuzzleContextValue extends State {
  orientation: 'w' | 'b';
  loadNextPuzzle: () => Promise<void>;
  loadPuzzleById: (id: string) => Promise<void>;
  move: (from: Square, to: Square, promotion?: string) => void;
  requestHint: () => void;
  giveUp: () => void;
  retry: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const PuzzleContext = createContext<PuzzleContextValue | null>(null);

export function PuzzleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Timers must be cancelled on unmount or a fast "next puzzle" tap fires a
  // reply into a session that no longer exists.
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    if (introTimer.current) clearTimeout(introTimer.current);
    replyTimer.current = null;
    wrongTimer.current = null;
    introTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Hydrate persisted state once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [progress, settings] = await Promise.all([loadProgress(), loadSettings()]);
      if (!cancelled) dispatch({ type: 'hydrated', progress, settings });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist progress after hydration (never before, or we'd clobber it).
  useEffect(() => {
    if (state.hydrated) void saveProgress(state.progress);
  }, [state.progress, state.hydrated]);

  useEffect(() => {
    if (state.hydrated) void saveSettings(state.settings);
  }, [state.settings, state.hydrated]);

  // Play the opponent's setup move shortly after a puzzle appears, so you see
  // the move you're answering rather than being dropped in cold.
  useEffect(() => {
    if (state.session?.status !== 'intro') return;

    const sessionAtSchedule = state.session;
    introTimer.current = setTimeout(() => {
      dispatch({ type: 'session', session: beginPuzzle(sessionAtSchedule) });
    }, INTRO_DELAY_MS);

    return () => {
      if (introTimer.current) clearTimeout(introTimer.current);
      introTimer.current = null;
    };
  }, [state.session]);

  // Keep the offline queue topped up in the background.
  useEffect(() => {
    if (state.hydrated) void primeQueue(state.progress);
  }, [state.hydrated, state.progress.attempted]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNextPuzzle = useCallback(async () => {
    clearTimers();
    dispatch({ type: 'loading' });
    try {
      const puzzle = await nextPuzzleFor(state.progress, {
        difficulty: difficultyFor(state.progress),
      });
      dispatch({
        type: 'loaded',
        puzzle,
        now: Date.now(),
        maxAttempts: state.settings.maxAttempts,
      });
    } catch (err) {
      dispatch({
        type: 'load-failed',
        message: err instanceof Error ? err.message : 'Could not load a puzzle',
      });
    }
  }, [state.progress, state.settings.maxAttempts, clearTimers]);

  /**
   * Open one specific puzzle, chosen from the browse list.
   *
   * Catalogue first — it's local, instant, and the only place the browsable
   * ids come from. The network lookup is a fallback for a shared or bookmarked
   * id that isn't in the bundled set.
   */
  const loadPuzzleById = useCallback(
    async (id: string) => {
      clearTimers();

      const local = loadCatalogue().find((p) => p.id === id);
      if (local) {
        dispatch({
          type: 'loaded',
          puzzle: local,
          now: Date.now(),
          maxAttempts: state.settings.maxAttempts,
        });
        return;
      }

      dispatch({ type: 'loading' });
      try {
        const puzzle = await fetchPuzzleById(id);
        dispatch({
          type: 'loaded',
          puzzle,
          now: Date.now(),
          maxAttempts: state.settings.maxAttempts,
        });
      } catch (err) {
        dispatch({
          type: 'load-failed',
          message: err instanceof Error ? err.message : `Could not load puzzle ${id}`,
        });
      }
    },
    [state.settings.maxAttempts, clearTimers],
  );

  /** Record a finished puzzle against the stored progress exactly once. */
  const settle = useCallback((session: SessionState, progress: UserProgress) => {
    const outcome = outcomeOf(session);
    if (!outcome) return;
    dispatch({
      type: 'progress',
      progress: applyOutcome(progress, session.puzzle.id, session.puzzle.rating, outcome),
    });
  }, []);

  const move = useCallback(
    (from: Square, to: Square, promotion?: string) => {
      const current = state.session;
      if (!current) return;

      const { state: next, pendingOpponentReply } = playMove(
        current,
        from,
        to,
        promotion,
        Date.now(),
      );
      if (next === current) return; // illegal move — nothing happened

      dispatch({ type: 'session', session: next });
      dispatch({ type: 'clear-hint' });

      if (pendingOpponentReply) {
        replyTimer.current = setTimeout(() => {
          dispatch({ type: 'session', session: applyOpponentReply(next) });
        }, OPPONENT_REPLY_DELAY_MS);
        return;
      }

      if (next.status === 'wrong') {
        wrongTimer.current = setTimeout(() => {
          dispatch({ type: 'session', session: clearWrongMove(next) });
        }, 600);
        return;
      }

      if (next.status === 'solved' || next.status === 'failed') {
        settle(next, state.progress);
      }
    },
    [state.session, state.progress, settle],
  );

  const requestHint = useCallback(() => {
    if (!state.session) return;
    const { state: next, hint } = takeHint(state.session);
    dispatch({ type: 'hint', session: next, hint });

    // Third hint plays the move for you.
    if (hint?.kind === 'played') {
      const expected = next.puzzle.solution[next.plyIndex];
      if (expected) {
        const from = expected.slice(0, 2) as Square;
        const to = expected.slice(2, 4) as Square;
        const promotion = expected.length > 4 ? expected[4] : undefined;
        setTimeout(() => move(from, to, promotion), 150);
      }
    }
  }, [state.session, move]);

  const giveUp = useCallback(() => {
    if (!state.session) return;
    clearTimers();
    const next = giveUpSession(state.session, Date.now());
    dispatch({ type: 'session', session: next });
    settle(next, state.progress);
  }, [state.session, state.progress, settle, clearTimers]);

  const retry = useCallback(() => {
    if (!state.session) return;
    clearTimers();
    dispatch({ type: 'session', session: restart(state.session) });
    dispatch({ type: 'clear-hint' });
  }, [state.session, clearTimers]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      dispatch({ type: 'settings', settings: { ...state.settings, ...patch } });
    },
    [state.settings],
  );

  const orientation = useMemo(
    () => (state.session ? solverColor(state.session.puzzle) : 'w'),
    [state.session],
  );

  const value = useMemo<PuzzleContextValue>(
    () => ({
      ...state,
      orientation,
      loadNextPuzzle,
      loadPuzzleById,
      move,
      requestHint,
      giveUp,
      retry,
      updateSettings,
    }),
    [
      state,
      orientation,
      loadNextPuzzle,
      loadPuzzleById,
      move,
      requestHint,
      giveUp,
      retry,
      updateSettings,
    ],
  );

  return <PuzzleContext.Provider value={value}>{children}</PuzzleContext.Provider>;
}

export function usePuzzle(): PuzzleContextValue {
  const ctx = useContext(PuzzleContext);
  if (!ctx) throw new Error('usePuzzle must be used inside a PuzzleProvider');
  return ctx;
}
