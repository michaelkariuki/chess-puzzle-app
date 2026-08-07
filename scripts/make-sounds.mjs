/**
 * Generates the app's sound effects as WAV files.
 *
 * Why synthesise rather than download: Lichess's own sound files are listed
 * under "Exceptions (NON-FREE)" in lila's COPYING.md, so they cannot be
 * bundled here. Rather than hunt for third-party assets with their own licence
 * terms, these are built from scratch — a few oscillators and a noise burst.
 * The output is original work with no attribution obligation.
 *
 * Deterministic: the noise uses a seeded PRNG, so regenerating produces
 * byte-identical files and won't churn the repo.
 *
 * Usage: pnpm make-sounds
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../assets/sounds');

const RATE = 44100;

/** Mulberry32 — small, seeded, reproducible. */
function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v) => Math.max(-1, Math.min(1, v));
/** Exponential decay envelope, 1 -> ~0 over the sample. */
const decay = (t, rate) => Math.exp(-t * rate);
/** Short fade-in so the attack doesn't click from a discontinuity. */
const attack = (t, ms) => Math.min(1, t / (ms / 1000));

function sine(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

/**
 * Render a mono 16-bit WAV.
 * `fn(t, rand)` returns a sample in [-1, 1] for time t seconds.
 */
function render(durationSec, fn, seed = 1) {
  const rand = prng(seed);
  const n = Math.floor(RATE * durationSec);
  const pcm = Buffer.alloc(n * 2);

  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // Global 4ms tail fade so every clip ends at zero — otherwise the cut
    // itself is audible as a pop.
    const tail = Math.min(1, (n - i) / (RATE * 0.004));
    const v = clamp(fn(t, rand)) * tail;
    pcm.writeInt16LE(Math.round(v * 32767 * 0.85), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

const SOUNDS = {
  /** Piece set down: a soft wooden tap. */
  move: () =>
    render(0.09, (t, rand) => {
      const body = sine(220, t) * decay(t, 55) * 0.55;
      const knock = (rand() * 2 - 1) * decay(t, 190) * 0.35;
      return (body + knock) * attack(t, 1);
    }, 11),

  /** Capture: lower and blunter than a move, with more transient. */
  capture: () =>
    render(0.13, (t, rand) => {
      const body = (sine(150, t) * 0.6 + sine(96, t) * 0.4) * decay(t, 38) * 0.6;
      const crack = (rand() * 2 - 1) * decay(t, 130) * 0.45;
      return (body + crack) * attack(t, 1);
    }, 23),

  /** Check: two quick rising blips — distinct from a normal move. */
  check: () =>
    render(0.2, (t) => {
      const first = t < 0.075 ? sine(660, t) * decay(t, 30) : 0;
      const second = t >= 0.075 ? sine(880, t - 0.075) * decay(t - 0.075, 26) : 0;
      return (first + second) * 0.45 * attack(t, 2);
    }, 31),

  /** Correct move in a multi-move line: a small affirmative tick. */
  correct: () =>
    render(0.12, (t) => sine(720, t) * decay(t, 34) * 0.4 * attack(t, 2), 41),

  /** Puzzle solved: rising major triad. */
  solved: () =>
    render(0.55, (t) => {
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      let v = 0;
      notes.forEach((f, i) => {
        const start = i * 0.09;
        if (t >= start) {
          const u = t - start;
          v += (sine(f, u) * 0.7 + sine(f * 2, u) * 0.15) * decay(u, 6.5);
        }
      });
      return v * 0.32 * attack(t, 3);
    }, 53),

  /** Wrong move: short flat buzz, unpleasant but not harsh. */
  wrong: () =>
    render(0.17, (t) => {
      const wobble = sine(196, t) * 0.55 + sine(185, t) * 0.45;
      return wobble * decay(t, 17) * 0.42 * attack(t, 3);
    }, 67),

  /** Puzzle failed: descending pair. */
  failed: () =>
    render(0.42, (t) => {
      const first = t < 0.16 ? sine(392, t) * decay(t, 9) : 0;
      const second = t >= 0.16 ? sine(294, t - 0.16) * decay(t - 0.16, 7) : 0;
      return (first + second) * 0.38 * attack(t, 3);
    }, 71),
};

mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const [name, build] of Object.entries(SOUNDS)) {
  const wav = build();
  writeFileSync(resolve(OUT_DIR, `${name}.wav`), wav);
  total += wav.length;
  const ms = Math.round(((wav.length - 44) / 2 / RATE) * 1000);
  console.log(`  ${name.padEnd(9)} ${String(ms).padStart(4)}ms  ${(wav.length / 1024).toFixed(1)} KB`);
}

console.log(`\nWrote ${Object.keys(SOUNDS).length} sounds to ${OUT_DIR} (${(total / 1024).toFixed(1)} KB total)`);
