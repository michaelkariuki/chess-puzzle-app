import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { accuracy, difficultyFor } from '@/src/chess/rating';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { StatTile } from '@/src/components/ui/StatTile';
import { UNLIMITED_ATTEMPTS } from '@/src/chess/types';
import { usePuzzle } from '@/src/state/PuzzleContext';
import { useLayout } from '@/src/theme/layout';
import { useAppTheme } from '@/src/theme/use-app-theme';

interface Props {
  onStartPuzzle: () => void;
  onViewProgress: () => void;
  onBrowse: () => void;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easiest: 'Gentle',
  easier: 'Easier',
  normal: 'Balanced',
  harder: 'Harder',
  hardest: 'Brutal',
};

/**
 * The entry point. Previously the app dropped you straight into a puzzle with
 * no context and no way back — you couldn't see your rating before committing,
 * and there was nowhere to return to after finishing one.
 */
export function HomeScreen({ onStartPuzzle, onViewProgress, onBrowse }: Props) {
  const { progress, hydrated, settings } = usePuzzle();
  const c = useAppTheme();
  const { isWide } = useLayout();

  const difficulty = DIFFICULTY_LABEL[difficultyFor(progress)] ?? 'Balanced';
  const resuming = progress.attempted > 0;

  return (
    <Screen narrow>
      <View style={[styles.hero, isWide && styles.heroWide]}>
        <Text style={[styles.logo, { color: c.text }]}>♟</Text>
        <Text style={[styles.title, { color: c.text }]}>Chess Puzzles</Text>
        <Text style={[styles.tagline, { color: c.textMuted }]}>
          {resuming ? 'Pick up where you left off' : 'Tactics training that adapts to you'}
        </Text>
      </View>

      <View style={[styles.ratingCard, { backgroundColor: c.surface }]}>
        <Text style={[styles.ratingLabel, { color: c.textMuted }]}>YOUR RATING</Text>
        <Text style={[styles.ratingValue, { color: c.text }]}>
          {hydrated ? progress.rating : '—'}
        </Text>
        <Text style={[styles.ratingMeta, { color: c.textMuted }]}>
          {progress.currentStreak > 0 ? `🔥 ${progress.currentStreak} in a row · ` : ''}
          Next up: {difficulty}
        </Text>
      </View>

      <Button
        label={resuming ? 'Continue solving' : 'Start solving'}
        variant="primary"
        onPress={onStartPuzzle}
        style={styles.cta}
        accessibilityHint="Opens a puzzle matched to your rating"
      />

      <Button
        label="Browse puzzles"
        onPress={onBrowse}
        style={styles.browse}
        accessibilityHint="Pick a specific puzzle by theme or rating"
      />

      <Pressable
        onPress={onViewProgress}
        style={({ pressed }) => [
          styles.statsCard,
          { backgroundColor: pressed ? c.surfaceStrong : c.surface },
        ]}
        accessibilityRole="button"
        accessibilityLabel="View your progress"
      >
        <View style={styles.statsHeader}>
          <Text style={[styles.statsTitle, { color: c.text }]}>Your progress</Text>
          <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
        </View>
        <View style={styles.statsRow}>
          <StatTile inline label="Solved" value={String(progress.solved)} />
          <StatTile inline label="Accuracy" value={`${accuracy(progress)}%`} />
          <StatTile inline label="Best streak" value={String(progress.bestStreak)} />
        </View>
      </Pressable>

      {progress.attempted === 0 ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Tap a piece, then tap where it should go.{' '}
          {settings.maxAttempts === UNLIMITED_ATTEMPTS
            ? 'You have unlimited tries — take your time.'
            : `${settings.maxAttempts} wrong ${settings.maxAttempts === 1 ? 'try' : 'tries'} ends the puzzle — use a hint if you get stuck.`}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 36, paddingBottom: 24 },
  heroWide: { paddingTop: 56 },
  logo: { fontSize: 52, lineHeight: 60 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 4 },
  tagline: { fontSize: 14, marginTop: 6, textAlign: 'center' },

  ratingCard: { borderRadius: 16, padding: 20, alignItems: 'center' },
  ratingLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  ratingValue: { fontSize: 44, fontWeight: '800', lineHeight: 52, marginVertical: 2 },
  ratingMeta: { fontSize: 13 },

  cta: { marginTop: 20 },
  browse: { marginTop: 10 },

  statsCard: { borderRadius: 16, padding: 18, marginTop: 14 },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statsTitle: { fontSize: 16, fontWeight: '700' },
  chevron: { fontSize: 24, lineHeight: 24 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },

  hint: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 22 },
});
