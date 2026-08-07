import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Puzzle } from '@/src/chess/types';
import {
  FEATURED_THEMES,
  filterCatalogue,
  loadCatalogue,
  RATING_BANDS,
  themeCounts,
  themeLabel,
  type SortOrder,
} from '@/src/data/catalogue';
import { usePuzzle } from '@/src/state/PuzzleContext';
import { useLayout } from '@/src/theme/layout';
import { useAppTheme } from '@/src/theme/use-app-theme';

interface Props {
  onOpenPuzzle: (id: string) => void;
}

const ROW_HEIGHT = 76;

export function BrowseScreen({ onOpenPuzzle }: Props) {
  const c = useAppTheme();
  const { gutter, contentWidth, isWide } = useLayout();
  const { progress } = usePuzzle();

  const [bandIdx, setBandIdx] = useState(0);
  const [activeThemes, setActiveThemes] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('rating-asc');
  const [hideSolved, setHideSolved] = useState(false);
  // Collapsed by default. The list is the point of this screen, and a full
  // filter panel pinned to the top would eat most of a phone viewport.
  const [expanded, setExpanded] = useState(false);

  // Parsing the catalogue happens here, on first render of this screen only.
  const catalogue = useMemo(() => loadCatalogue(), []);
  const counts = useMemo(() => themeCounts(catalogue), [catalogue]);

  // Keep typing responsive: the list re-filters at a lower priority than input.
  const deferredQuery = useDeferredValue(query);
  const solvedIds = useMemo(() => new Set(progress.seen), [progress.seen]);

  const results = useMemo(() => {
    const band = RATING_BANDS[bandIdx];
    return filterCatalogue(
      catalogue,
      {
        minRating: band.min,
        maxRating: band.max,
        themes: activeThemes,
        query: deferredQuery,
        excludeIds: hideSolved ? solvedIds : undefined,
      },
      sort,
    );
  }, [catalogue, bandIdx, activeThemes, deferredQuery, sort, hideSolved, solvedIds]);

  const toggleTheme = useCallback(
    (theme: string) =>
      setActiveThemes((prev) =>
        prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme],
      ),
    [],
  );

  const clearFilters = useCallback(() => {
    setActiveThemes([]);
    setQuery('');
    setBandIdx(0);
    setHideSolved(false);
  }, []);

  // Stable identity: an inline arrow would give every row a new prop on every
  // keystroke, defeating React.memo and remounting the visible window.
  const renderItem = useCallback(
    ({ item }: { item: Puzzle }) => (
      <PuzzleRow
        puzzle={item}
        solved={solvedIds.has(item.id)}
        userRating={progress.rating}
        onOpen={onOpenPuzzle}
      />
    ),
    [solvedIds, progress.rating, onOpenPuzzle],
  );

  const activeCount = activeThemes.length + (bandIdx !== 0 ? 1 : 0) + (hideSolved ? 1 : 0);

  /** One-line description of what's filtering, shown while collapsed. */
  const summary = [
    bandIdx !== 0 ? RATING_BANDS[bandIdx].label : null,
    ...activeThemes.map(themeLabel),
    hideSolved ? 'Unsolved only' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Sticky: lives outside the FlatList, so it never scrolls away. */}
      <Animated.View
        layout={LinearTransition.duration(180)}
        style={[styles.stickyBar, { backgroundColor: c.background, borderBottomColor: c.border }]}
      >
        <View
          style={[
            styles.stickyInner,
            { width: isWide ? contentWidth : '100%', paddingHorizontal: gutter },
          ]}
        >
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search themes or id…"
              placeholderTextColor={c.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              style={[
                styles.search,
                { backgroundColor: c.surface, color: c.text, borderColor: c.border },
              ]}
              accessibilityLabel="Search puzzles"
            />
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={
                expanded
                  ? 'Hide filters'
                  : `Show filters${activeCount ? `, ${activeCount} active` : ''}`
              }
              style={({ pressed }) => [
                styles.filterToggle,
                {
                  backgroundColor:
                    activeCount > 0 ? c.accent : pressed ? c.surfaceStrong : c.surface,
                  borderColor: activeCount > 0 ? c.accent : c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterToggleText,
                  { color: activeCount > 0 ? c.textOnAccent : c.text },
                ]}
              >
                Filters{activeCount > 0 ? ` ${activeCount}` : ''} {expanded ? '▲' : '▼'}
              </Text>
            </Pressable>
          </View>

          {expanded ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(100)}
              style={styles.expanded}
            >
              <Text style={[styles.filterLabel, { color: c.textMuted }]}>RATING</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScroll}
              >
                {RATING_BANDS.map((band, i) => (
                  <Chip
                    key={band.label}
                    label={band.label}
                    active={bandIdx === i}
                    onPress={() => setBandIdx(i)}
                  />
                ))}
              </ScrollView>

              <Text style={[styles.filterLabel, { color: c.textMuted }]}>THEME</Text>
              <View style={styles.chipWrap}>
                {FEATURED_THEMES.filter((t) => (counts[t] ?? 0) > 0).map((theme) => (
                  <Chip
                    key={theme}
                    label={`${themeLabel(theme)} ${counts[theme]}`}
                    active={activeThemes.includes(theme)}
                    onPress={() => toggleTheme(theme)}
                  />
                ))}
              </View>

              <View style={styles.chipWrap}>
                <Chip
                  label={sort === 'rating-asc' ? '↑ Easiest first' : '↓ Hardest first'}
                  active
                  onPress={() => setSort(sort === 'rating-asc' ? 'rating-desc' : 'rating-asc')}
                />
                <Chip
                  label={hideSolved ? 'Unsolved only' : 'Showing all'}
                  active={hideSolved}
                  onPress={() => setHideSolved((v) => !v)}
                />
                {activeCount > 0 || query ? (
                  <Chip label="Clear filters" active={false} onPress={clearFilters} />
                ) : null}
              </View>

              <Text style={[styles.resultCount, { color: c.textMuted }]}>
                {results.length.toLocaleString()} of {catalogue.length.toLocaleString()} puzzles
              </Text>
            </Animated.View>
          ) : (
            /* Collapsed: one quiet line saying what's on and how many matched. */
            <Animated.View entering={FadeIn.duration(140)} style={styles.summaryRow}>
              <Text style={[styles.summaryText, { color: c.textMuted }]} numberOfLines={1}>
                {results.length.toLocaleString()} puzzle{results.length === 1 ? '' : 's'}
                {summary ? ` · ${summary}` : ''}
              </Text>
              {activeCount > 0 || query ? (
                <Pressable
                  onPress={clearFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Clear filters"
                >
                  <Text style={[styles.clearText, { color: c.accent }]}>Clear</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          )}
        </View>
      </Animated.View>

      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            Nothing matches those filters. Try clearing a theme or widening the rating band.
          </Text>
        }
        // Windowing: only visible rows mount, so 2,000 rows scroll like 20.
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: gutter, width: isWide ? contentWidth : '100%' },
        ]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.accent : pressed ? c.surfaceStrong : c.surface,
          borderColor: active ? c.accent : c.border,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? c.textOnAccent : c.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const PuzzleRow = React.memo(function PuzzleRow({
  puzzle,
  solved,
  userRating,
  onOpen,
}: {
  puzzle: Puzzle;
  solved: boolean;
  userRating: number;
  onOpen: (id: string) => void;
}) {
  const c = useAppTheme();
  const delta = puzzle.rating - userRating;
  const relative = delta > 200 ? 'harder' : delta < -200 ? 'easier' : 'well matched';
  const moves = Math.ceil(puzzle.solution.length / 2);

  // Solved rows get four cues at once — tinted fill, a success-coloured spine,
  // dimmed content and an explicit badge. A single tick reads as noise in a
  // long list; the point is to be scannable without stopping to look.
  return (
    <Pressable
      onPress={() => onOpen(puzzle.id)}
      accessibilityRole="button"
      accessibilityLabel={
        `${solved ? 'Solved. ' : ''}Puzzle rated ${puzzle.rating}, ` +
        `${puzzle.themes.slice(0, 2).map(themeLabel).join(', ')}, ${moves} move${moves === 1 ? '' : 's'}`
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.surfaceStrong : solved ? c.successSurface : c.surface,
          borderColor: solved ? c.success : c.border,
        },
      ]}
    >
      {solved ? <View style={[styles.spine, { backgroundColor: c.success }]} /> : null}

      <View style={[styles.rowRating, solved && styles.dimmed]}>
        <Text style={[styles.ratingValue, { color: c.text }]}>{puzzle.rating}</Text>
        <Text style={[styles.ratingRelative, { color: c.textMuted }]}>{relative}</Text>
      </View>

      <View style={[styles.rowMain, solved && styles.dimmed]}>
        <Text style={[styles.rowThemes, { color: c.text }]} numberOfLines={1}>
          {puzzle.themes.slice(0, 3).map(themeLabel).join(' · ') || 'Tactic'}
        </Text>
        <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
          {moves} move{moves === 1 ? '' : 's'} · {puzzle.id}
        </Text>
      </View>

      {solved ? (
        <View style={[styles.badge, { backgroundColor: c.success }]}>
          <Text style={[styles.badgeText, { color: c.successSurface }]}>✓ SOLVED</Text>
        </View>
      ) : (
        <Text style={[styles.chevron, { color: c.textMuted }]}>›</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 32, paddingTop: 10, alignSelf: 'center' },

  stickyBar: { borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  stickyInner: { paddingTop: 10, paddingBottom: 8 },

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    minHeight: 40,
  },
  filterToggle: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: 'center',
    minHeight: 40,
  },
  filterToggleText: { fontSize: 13, fontWeight: '700' },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
  },
  summaryText: { flex: 1, fontSize: 12 },
  clearText: { fontSize: 12, fontWeight: '700' },

  expanded: { paddingTop: 10 },
  filterLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 7 },
  chipScroll: { gap: 8, paddingRight: 8, paddingBottom: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  resultCount: { fontSize: 12, paddingBottom: 2 },

  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 12,
    marginBottom: 8,
    gap: 14,
    overflow: 'hidden',
  },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  dimmed: { opacity: 0.62 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  chevron: { fontSize: 22, lineHeight: 24 },
  rowRating: { width: 62 },
  ratingValue: { fontSize: 19, fontWeight: '700' },
  ratingRelative: { fontSize: 10, marginTop: 1 },
  rowMain: { flex: 1 },
  rowThemes: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 3 },

  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 40, lineHeight: 21 },
});
