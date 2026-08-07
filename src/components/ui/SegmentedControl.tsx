import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/src/theme/use-app-theme';

export interface Segment<T> {
  value: T;
  label: string;
}

interface Props<T> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string | number>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const c = useAppTheme();

  return (
    <View
      style={[styles.track, { backgroundColor: c.surface, borderColor: c.border }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={String(segment.value)}
            onPress={() => onChange(segment.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: c.accent },
              !selected && pressed && { backgroundColor: c.surfaceStrong },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? c.textOnAccent : c.text, fontWeight: selected ? '700' : '600' },
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  label: { fontSize: 13 },
});
