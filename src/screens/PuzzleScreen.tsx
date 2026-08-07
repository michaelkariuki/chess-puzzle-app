import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { attemptsRemaining, movesRemaining, type SessionState } from '@/src/chess/puzzle-session';
import { Board } from '@/src/components/board/Board';
import { Banner, type BannerTone } from '@/src/components/ui/Banner';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { StatTile } from '@/src/components/ui/StatTile';
import { usePuzzle } from '@/src/state/PuzzleContext';
import { useLayout } from '@/src/theme/layout';
import { useAppTheme } from '@/src/theme/use-app-theme';

/** Swallows input during a transition without changing Board's contract. */
const noop = () => {};

interface Props {
  /** Called when the player leaves the puzzle (back to home). */
  onExit?: () => void;
  /** Open this specific puzzle instead of picking one by rating. */
  puzzleId?: string;
}

export function PuzzleScreen({ onExit, puzzleId }: Props) {
  const {
    session,
    progress,
    settings,
    hint,
    loading,
    error,
    orientation,
    hydrated,
    loadNextPuzzle,
    loadPuzzleById,
    move,
    requestHint,
    giveUp,
    retry,
  } = usePuzzle();

  const c = useAppTheme();
  const { isWide, boardSize, gutter } = useLayout();

  // Load a puzzle when the screen is entered — but only once per mount. Without
  // the ref, "finished" would immediately trigger a fresh load the instant you
  // solve one, blowing away the result before you could read it.
  const didRequestOnMount = React.useRef(false);
  useEffect(() => {
    if (!hydrated || loading || error || didRequestOnMount.current) return;

    // An explicit id always wins — arriving from the browse list must open
    // that puzzle, even if another one is mid-solve.
    if (puzzleId) {
      if (session?.puzzle.id !== puzzleId) {
        didRequestOnMount.current = true;
        void loadPuzzleById(puzzleId);
        return;
      }
      didRequestOnMount.current = true;
      return;
    }

    const finished = session?.status === 'solved' || session?.status === 'failed';
    didRequestOnMount.current = true;
    if (!session || finished) void loadNextPuzzle();
  }, [hydrated, session, loading, error, loadNextPuzzle, loadPuzzleById, puzzleId]);

  // Only take the board down when there's nothing to show. Once a session
  // exists, keep it mounted through the transition: loading from the queue or
  // the bundled set is effectively instant, so swapping in a spinner produced
  // a jarring flash — and unmounting the board was what orphaned the exiting
  // highlight animations in the first place.
  if (!session) {
    return (
      <Screen narrow scroll={false}>
        <View style={styles.centered}>
          {error ? (
            <>
              <Text style={[styles.errorText, { color: c.textMuted }]}>{error}</Text>
              <Button label="Try again" variant="primary" onPress={() => void loadNextPuzzle()} />
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={c.accent} />
              <Text style={[styles.loadingText, { color: c.textMuted }]}>Finding a puzzle…</Text>
            </>
          )}
        </View>
      </Screen>
    );
  }

  const board = (
    <Board
      session={session}
      orientation={orientation}
      size={boardSize}
      showLegalMoves={settings.showLegalMoves && !loading}
      hintSquares={
        hint?.kind === 'piece'
          ? { from: hint.square }
          : hint?.kind === 'destination'
            ? { from: hint.from, to: hint.to }
            : null
      }
      onMove={loading ? noop : move}
    />
  );

  const panel = (
    <PuzzlePanel
      session={session}
      rating={progress.rating}
      streak={progress.currentStreak}
      orientation={orientation}
      isWide={isWide}
      onHint={requestHint}
      onRetry={retry}
      onGiveUp={giveUp}
      onNext={() => void loadNextPuzzle()}
      onExit={onExit}
      loadingNext={loading}
    />
  );

  return (
    <Screen scroll={!isWide}>
      {isWide ? (
        <View style={[styles.wide, { gap: gutter }]}>
          <View style={styles.boardColumn}>{board}</View>
          <View style={styles.panelColumn}>{panel}</View>
        </View>
      ) : (
        <View style={styles.stacked}>
          <View style={styles.boardCentered}>{board}</View>
          {panel}
        </View>
      )}
    </Screen>
  );
}

interface PanelProps {
  session: SessionState;
  rating: number;
  streak: number;
  orientation: 'w' | 'b';
  isWide: boolean;
  onHint: () => void;
  onRetry: () => void;
  onGiveUp: () => void;
  onNext: () => void;
  onExit?: () => void;
  loadingNext: boolean;
}

function PuzzlePanel({
  session,
  rating,
  streak,
  orientation,
  isWide,
  onHint,
  onRetry,
  onGiveUp,
  onNext,
  onExit,
  loadingNext,
}: PanelProps) {
  const { status, puzzle, hintsUsed } = session;
  const finished = status === 'solved' || status === 'failed';
  const remaining = movesRemaining(session);

  const banner = loadingNext
    ? ({ tone: 'neutral', title: 'Loading next puzzle…', subtitle: '' } as const)
    : bannerFor(
        status,
        puzzle.rating,
        puzzle.themes,
        attemptsRemaining(session),
        hintsUsed,
      );

  return (
    <Animated.View
      layout={LinearTransition.duration(200)}
      style={[styles.panel, isWide && styles.panelWide]}
    >
      <View style={styles.headerRow}>
        <StatTile inline label="Your rating" value={String(rating)} />
        <StatTile
          inline
          label={orientation === 'w' ? 'White to play' : 'Black to play'}
          value={finished ? '—' : `${remaining} move${remaining === 1 ? '' : 's'}`}
          style={styles.headerCenter}
        />
        <StatTile
          inline
          label="Streak"
          value={streak > 0 ? `🔥 ${streak}` : '—'}
          style={styles.headerEnd}
        />
      </View>

      <Banner tone={banner.tone} title={banner.title} subtitle={banner.subtitle} />

      {finished ? (
        <Animated.View
          key="finished"
          entering={FadeInDown.duration(260).springify().damping(18)}
          style={styles.actions}
        >
          <Button
            label="Next puzzle"
            variant="primary"
            onPress={onNext}
            disabled={loadingNext}
            style={styles.flex}
          />
          {onExit ? <Button label="Home" variant="ghost" onPress={onExit} /> : null}
        </Animated.View>
      ) : (
        <Animated.View key="playing" entering={FadeIn.duration(180)} style={styles.actionStack}>
          <View style={styles.actions}>
            <Button label="💡 Hint" onPress={onHint} style={styles.flex} />
            <Button label="↻ Restart" onPress={onRetry} style={styles.flex} />
          </View>
          <View style={styles.actions}>
            <Button label="Give up" variant="ghost" onPress={onGiveUp} style={styles.flex} />
            {onExit ? <Button label="Home" variant="ghost" onPress={onExit} /> : null}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function bannerFor(
  status: string,
  rating: number,
  themes: string[],
  triesLeft: number | null,
  hintsUsed: number,
): { tone: BannerTone; title: string; subtitle: string } {
  const motifs = themes.slice(0, 3).join(' · ') || 'tactic';

  if (status === 'solved') {
    return {
      tone: 'success',
      title: hintsUsed > 0 ? '✓ Solved (with a hint)' : '✓ Solved!',
      subtitle: `${motifs} · rated ${rating}`,
    };
  }
  if (status === 'failed') {
    return { tone: 'danger', title: '✗ Not this time', subtitle: `${motifs} · rated ${rating}` };
  }
  if (status === 'intro') {
    return {
      tone: 'neutral',
      title: 'Your opponent moves…',
      subtitle: `Rated ${rating}`,
    };
  }
  if (status === 'wrong') {
    return {
      tone: 'warning',
      title: 'Not the move',
      subtitle:
        triesLeft === null
          ? 'Try again — unlimited tries'
          : `${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left`,
    };
  }
  // Themes stay hidden while solving — naming the motif gives the puzzle away.
  return {
    tone: 'neutral',
    title: 'Find the best move',
    subtitle: `Rated ${rating}${hintsUsed > 0 ? ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} used` : ''}`,
  };
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14 },
  errorText: { textAlign: 'center', fontSize: 14, marginBottom: 4 },

  wide: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 20 },
  boardColumn: { alignItems: 'flex-end' },
  panelColumn: { flex: 1, justifyContent: 'center' },

  stacked: { flex: 1, paddingTop: 8 },
  boardCentered: { alignItems: 'center' },

  panel: { gap: 12, paddingTop: 14 },
  panelWide: { paddingTop: 0 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCenter: { alignItems: 'center' },
  headerEnd: { alignItems: 'flex-end' },

  actions: { flexDirection: 'row', gap: 10 },
  actionStack: { gap: 10 },
  flex: { flex: 1 },
});
