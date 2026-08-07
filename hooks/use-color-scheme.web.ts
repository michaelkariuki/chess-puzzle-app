import { useEffect, useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import {
  isHydrated,
  isHydratedOnServer,
  markHydrated,
  subscribeToHydration,
} from '@/src/theme/hydration-store';

/**
 * Colour scheme on web.
 *
 * Static rendering can't know the user's preference, so the first paint uses
 * the light palette and corrects once the client hydrates. The hydration flag
 * is app-wide (see hydration-store) rather than per-component: with per-
 * component state, every element mounted later — a list row appearing after a
 * filter change — repeated the light-then-dark correction and flashed white.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    isHydrated,
    isHydratedOnServer,
  );

  useEffect(markHydrated, []);

  const colorScheme = useRNColorScheme();
  return hydrated ? colorScheme : 'light';
}
