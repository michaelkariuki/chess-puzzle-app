/**
 * Sound playback.
 *
 * expo-audio players are created once and reused — creating one per move would
 * add latency to the exact moment that needs to feel instant, and leak native
 * resources.
 *
 * Every call is best-effort: if audio is unavailable (a locked device, a web
 * browser that hasn't seen a user gesture yet, a codec failure) the app must
 * carry on silently rather than throw into the move handler.
 */

import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { SoundName } from './sound-for-move';

const SOURCES: Record<SoundName, number> = {
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  check: require('../../assets/sounds/check.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  solved: require('../../assets/sounds/solved.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  failed: require('../../assets/sounds/failed.wav'),
};

export type PlaySound = (name: SoundName) => void;

export function useSounds(enabled: boolean): PlaySound {
  const players = useRef<Partial<Record<SoundName, AudioPlayer>>>({});

  useEffect(() => {
    if (!enabled) return;

    // Don't take over the audio session — a chess tap should never stop
    // someone's music.
    setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {
      // Non-fatal; playback still works with the platform default.
    });
  }, [enabled]);

  // Release native players on unmount.
  useEffect(() => {
    const active = players.current;
    return () => {
      for (const player of Object.values(active)) {
        try {
          player?.remove();
        } catch {
          // Already gone.
        }
      }
      players.current = {};
    };
  }, []);

  return useCallback(
    (name: SoundName) => {
      if (!enabled) return;
      try {
        let player = players.current[name];
        if (!player) {
          player = createAudioPlayer(SOURCES[name]);
          players.current[name] = player;
        }
        // Rewind so rapid repeats retrigger instead of being ignored.
        player.seekTo(0);
        player.play();
      } catch {
        // Audio is a nicety — never let it break the move handler.
      }
    },
    [enabled],
  );
}
