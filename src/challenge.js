// Seeded challenge links.
//
// A challenge link encodes a seed. The same seed always produces the same
// clue order and the same voice, so two players can be compared honestly —
// which matters here, because the score is a word count and word counts differ
// per clue. Comparing runs over different clue sets would be meaningless.

import { CLUES } from './clues.js';
import { ALLOWED_VOICES } from './copyRules.js';

// Mulberry32. Small, deterministic, and identical in node and the browser.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  return seedFromString(String(seed ?? 'buzz-in'));
}

export const CLUES_PER_ROUND = 3;

export function buildRound(seed, count = CLUES_PER_ROUND) {
  const rng = makeRng(normalizeSeed(seed));
  const pool = [...CLUES];
  // Fisher-Yates with the seeded rng.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const voice = ALLOWED_VOICES[Math.floor(rng() * ALLOWED_VOICES.length)];
  return { seed: normalizeSeed(seed), voice, clues: pool.slice(0, count) };
}

export function challengePath(seed) {
  return `/?c=${normalizeSeed(seed).toString(36)}`;
}

export function seedFromChallengeParam(param) {
  if (!param) return null;
  const parsed = parseInt(String(param), 36);
  return Number.isFinite(parsed) ? parsed >>> 0 : null;
}
