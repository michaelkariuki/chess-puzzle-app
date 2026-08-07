import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useAppTheme } from '@/src/theme/use-app-theme';

export type BannerTone = 'neutral' | 'success' | 'danger' | 'warning';

interface Props {
  tone: BannerTone;
  title: string;
  subtitle?: string;
  animate?: boolean;
}

export function Banner({ tone, title, subtitle, animate = true }: Props) {
  const c = useAppTheme();

  const { background, foreground } = {
    neutral: { background: c.surface, foreground: c.text },
    success: { background: c.successSurface, foreground: c.success },
    danger: { background: c.dangerSurface, foreground: c.danger },
    warning: { background: c.warningSurface, foreground: c.warning },
  }[tone];

  return (
    <Animated.View
      // Keyed by tone: a change of state should cross-fade to the new banner
      // rather than silently swapping its text.
      key={tone}
      entering={animate ? FadeIn.duration(200) : undefined}
      exiting={animate ? FadeOut.duration(120) : undefined}
      layout={animate ? LinearTransition.duration(180) : undefined}
      style={[styles.banner, { backgroundColor: background }]}
    >
      <Text style={[styles.title, { color: foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: tone === 'neutral' ? c.textMuted : foreground }]}>
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 3, opacity: 0.9 },
});
