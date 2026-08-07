import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayout } from '@/src/theme/layout';
import { useAppTheme } from '@/src/theme/use-app-theme';

interface Props {
  children: React.ReactNode;
  /** Constrain to a narrow reading column rather than the full content width. */
  narrow?: boolean;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

/**
 * Page shell: themed background, safe-area aware, and — the part that matters
 * on web — a centred, max-width content column. Without the cap, every screen
 * stretches edge to edge on a desktop monitor.
 */
export function Screen({ children, narrow = false, scroll = true, contentStyle }: Props) {
  const c = useAppTheme();
  const { gutter, contentWidth, columnWidth } = useLayout();

  const inner = (
    <View
      style={[
        styles.column,
        { width: narrow ? columnWidth : contentWidth, paddingHorizontal: gutter },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.staticContent}>{inner}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 32, flexGrow: 1 },
  staticContent: { flex: 1, alignItems: 'center' },
  column: { flex: 1 },
});
