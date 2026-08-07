import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/use-app-theme';

interface Props {
  label: string;
  value: string;
  style?: ViewStyle;
  /** Compact variant used in the puzzle screen header. */
  inline?: boolean;
}

export function StatTile({ label, value, style, inline = false }: Props) {
  const c = useAppTheme();

  if (inline) {
    return (
      <View style={style}>
        <Text style={[styles.inlineLabel, { color: c.textMuted }]}>{label}</Text>
        <Text style={[styles.inlineValue, { color: c.text }]}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.tile, { backgroundColor: c.surface }, style]}>
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 100,
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  value: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  label: { fontSize: 12, marginTop: 2 },

  inlineLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  inlineValue: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
});
