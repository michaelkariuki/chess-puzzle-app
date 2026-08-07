/**
 * Local persistence over AsyncStorage.
 *
 * Everything is namespaced and versioned so a future shape change can migrate
 * rather than crash on stale JSON.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SETTINGS,
  INITIAL_PROGRESS,
  type Puzzle,
  type Settings,
  type UserProgress,
} from '@/src/chess/types';

const V = 'v1';
const KEYS = {
  progress: `chesspuzzle:${V}:progress`,
  settings: `chesspuzzle:${V}:settings`,
  queue: `chesspuzzle:${V}:queue`,
} as const;

/** Cap `seen` so it can't grow without bound. */
const MAX_SEEN = 500;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    // Corrupt or unreadable — fall back rather than crash on launch.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; the in-memory state is still correct.
  }
}

export async function loadProgress(): Promise<UserProgress> {
  return readJson(KEYS.progress, INITIAL_PROGRESS);
}

export async function saveProgress(progress: UserProgress): Promise<void> {
  const trimmed: UserProgress = {
    ...progress,
    seen: progress.seen.slice(-MAX_SEEN),
  };
  await writeJson(KEYS.progress, trimmed);
}

export async function loadSettings(): Promise<Settings> {
  return readJson(KEYS.settings, DEFAULT_SETTINGS);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJson(KEYS.settings, settings);
}

/** Puzzles prefetched while online, so there's always a next one offline. */
export async function loadQueue(): Promise<Puzzle[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.queue);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Puzzle[]) : [];
  } catch {
    return [];
  }
}

export async function saveQueue(queue: Puzzle[]): Promise<void> {
  await writeJson(KEYS.queue, queue);
}

/** Wipe everything — used by a "reset progress" action in settings. */
export async function resetAll(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEYS.progress, KEYS.settings, KEYS.queue]);
  } catch {
    // Nothing useful to do if this fails.
  }
}
