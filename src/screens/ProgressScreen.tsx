import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { accuracy } from '@/src/chess/rating';
import { ATTEMPT_CHOICES, UNLIMITED_ATTEMPTS } from '@/src/chess/types';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { StatTile } from '@/src/components/ui/StatTile';
import { SEED_COUNT, seedCoverage } from '@/src/data/puzzle-source';
import { resetAll } from '@/src/data/storage';
import { usePuzzle } from '@/src/state/PuzzleContext';
import { useAppTheme } from '@/src/theme/use-app-theme';

interface Props {
  onStartPuzzle?: () => void;
}

export function ProgressScreen({ onStartPuzzle }: Props) {
  const { progress, settings, updateSettings } = usePuzzle();
  const c = useAppTheme();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const doReset = async () => {
    await resetAll();
    // Everything lives in AsyncStorage, so a reload is the honest way to get
    // a clean slate rather than hand-resetting each slice of in-memory state.
    if (Platform.OS === 'web' && typeof location !== 'undefined') location.reload();
    else Alert.alert('Progress cleared', 'Restart the app to see the change.');
  };

  return (
    <Screen narrow>
      <Text style={[styles.title, { color: c.text }]}>Your progress</Text>

      <View style={styles.grid}>
        <StatTile label="Rating" value={String(progress.rating)} />
        <StatTile label="Solved" value={String(progress.solved)} />
        <StatTile label="Accuracy" value={`${accuracy(progress)}%`} />
        <StatTile label="Attempted" value={String(progress.attempted)} />
        <StatTile
          label="Streak"
          value={progress.currentStreak > 0 ? `🔥 ${progress.currentStreak}` : '0'}
        />
        <StatTile label="Best streak" value={String(progress.bestStreak)} />
      </View>

      {onStartPuzzle ? (
        <Button
          label="Solve a puzzle"
          variant="primary"
          onPress={onStartPuzzle}
          style={styles.cta}
        />
      ) : null}

      <Text style={[styles.section, { color: c.text }]}>Settings</Text>

      <View style={[styles.settingRow, { borderBottomColor: c.border }]}>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: c.text }]}>Show legal moves</Text>
          <Text style={[styles.settingHint, { color: c.textMuted }]}>
            Dots mark where the selected piece can go
          </Text>
        </View>
        <Switch
          value={settings.showLegalMoves}
          onValueChange={(v) => updateSettings({ showLegalMoves: v })}
          trackColor={{ true: c.accent }}
        />
      </View>

      <View style={[styles.settingRow, { borderBottomColor: c.border }]}>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: c.text }]}>Sound</Text>
          <Text style={[styles.settingHint, { color: c.textMuted }]}>
            Move, capture, check and solve effects
          </Text>
        </View>
        <Switch
          value={settings.soundEnabled}
          onValueChange={(v) => updateSettings({ soundEnabled: v })}
          trackColor={{ true: c.accent }}
        />
      </View>

      <View style={styles.settingBlock}>
        <Text style={[styles.settingLabel, { color: c.text }]}>Tries per puzzle</Text>
        <Text style={[styles.settingHint, { color: c.textMuted, marginBottom: 10 }]}>
          {'Wrong moves allowed before a puzzle counts as failed. Takes effect on the next '}
          {"puzzle — changing it won't fail one you're partway through."}
        </Text>
        <SegmentedControl
          accessibilityLabel="Tries per puzzle"
          segments={ATTEMPT_CHOICES.map((n) => ({
            value: n,
            label: n === UNLIMITED_ATTEMPTS ? '∞' : String(n),
          }))}
          value={settings.maxAttempts}
          onChange={(maxAttempts) => updateSettings({ maxAttempts })}
        />
        {settings.maxAttempts === UNLIMITED_ATTEMPTS ? (
          <Text style={[styles.settingHint, { color: c.textMuted, marginTop: 8 }]}>
            Unlimited tries — puzzles only end when you solve them or give up.
          </Text>
        ) : null}
      </View>

      <Text style={[styles.section, { color: c.text }]}>Offline</Text>
      <Text style={[styles.note, { color: c.textMuted }]}>
        {SEED_COUNT} puzzles ship with the app, {seedCoverage(progress.rating)} of them near
        your current rating. These work with no connection at all.
      </Text>

      <Text style={[styles.section, { color: c.text }]}>Your data</Text>
      <Text style={[styles.note, { color: c.textMuted }]}>
        {'Everything is stored on this device only — no account, no server, nothing leaves '}
        {'the app except puzzle requests to Lichess. Clearing app data resets your rating.'}
      </Text>
      {confirmingReset ? (
        <View style={styles.resetRow}>
          <Button
            label="Yes, erase everything"
            onPress={() => void doReset()}
            style={styles.flex}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setConfirmingReset(false)} />
        </View>
      ) : (
        <Button
          label="Reset progress"
          variant="ghost"
          onPress={() => setConfirmingReset(true)}
          style={styles.resetButton}
        />
      )}

      <Text style={[styles.section, { color: c.text }]}>About</Text>
      <Text style={[styles.note, { color: c.textMuted }]}>
        {'Puzzles from Lichess (CC0). Chess pieces are the Cburnett set by Colin M.L. '}
        {'Burnett, from lichess-org/lila, licensed GPLv2+. Sounds are generated by this '}
        {'project and are not third-party assets.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', marginTop: 20, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cta: { marginTop: 18 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 30, marginBottom: 10 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  settingText: { flex: 1 },
  settingBlock: { paddingVertical: 14 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingHint: { fontSize: 12, marginTop: 2 },
  note: { fontSize: 13, lineHeight: 20 },
  resetButton: { marginTop: 12 },
  resetRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  flex: { flex: 1 },
});
