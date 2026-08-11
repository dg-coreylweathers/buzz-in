// The six confirmed spoken-copy defects, as machine-checkable rules.
//
// These are HARD CONSTRAINTS from GOAL.md and PRD 3. They are never a
// judgment call, so they live in code and fail the build, not in a style doc.
//
// Shared by scripts/check-copy.js, scripts/check-clues.js, and the assertion
// suite so there is exactly one definition of each rule.

// The phrase a player says to buzz in.
//
// Measured against staging Flux STT on 2026-08-11: single plosive words do not
// survive recognition. "Buzz!" came back as "But", "Buzzer!" as an empty
// transcript. Short phrases do: "I know it!" transcribed cleanly.
//
// Accepting a mis-hearing like "but" instead would false-trigger on ordinary
// clue words, so the trigger is the phrase.
export const BUZZ_WORD = 'I know it';

// What counts as the player saying it. Kept deliberately tight: every variant
// here must be something a host would never say mid-clue, because a false
// trigger scores the player for words they did hear.
export const BUZZ_PHRASES = ['i know it', 'i know this', 'i know'];

// Voice roster: the confirmed cutlist only. brittany and marcus are banned.
// The parent launch page's meghan/conor/wes recommendation is NOT followed —
// those names do not appear in the confirmed cutlist. See FLAGS.md F-06.
export const ALLOWED_VOICES = ['rufus', 'jack', 'cole', 'haley'];
export const BANNED_VOICES = ['brittany', 'marcus'];

// No vendor name, logo, or competitor reference anywhere.
export const BANNED_VENDOR_TERMS = [
  'deepgram', 'flux', 'aura', 'nova',
  'openai', 'elevenlabs', 'eleven labs', 'cartesia', 'playht', 'play.ht',
  'azure', 'google cloud', 'amazon polly', 'aws', 'assemblyai', 'rev.ai',
  'whisper', 'resemble', 'murf', 'speechify', 'wellsaid',
];

// Product or API terminology has no place in a spoken line. The blog names
// the mechanism; the game performs it.
export const PRODUCT_TERMS = [
  'api', 'sdk', 'endpoint', 'websocket', 'payload', 'token', 'latency',
  'text_spoken', 'text_remaining', 'speech_id', 'playback offset',
  'tts', 'asr', 'stt', 'model', 'inference', 'streaming', 'server',
  'client', 'request', 'response', 'json', 'schema', 'parameter',
];

// A score expressed in units of time. The score is a word count. Always.
const TIME_UNIT_SCORE = /\b\d+(\.\d+)?\s*(ms|milliseconds?|seconds?|secs?|minutes?|mins?)\b/i;

// Approximate ceiling for the five-minute degradation risk. Normal speaking
// pace is ~150 wpm, so a five-minute turn is ~750 words; a spoken line here
// has no business being anywhere near that. See DECISIONS.md D-12.
export const MAX_SPOKEN_WORDS = 60;

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean);
}

function hasWholeWord(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

// Every rule returns an array of violation strings. Empty means clean.
export const RULES = {
  // Defect 1 — the plural of "interruption".
  pluralInterruption(text) {
    return /interruptions/i.test(text)
      ? ['contains the plural of "interruption"']
      : [];
  },

  // Defect 2 — a score expressed in units of time.
  scoreInTimeUnits(text) {
    return TIME_UNIT_SCORE.test(text)
      ? ['expresses a value in units of time; the score is a word count']
      : [];
  },

  // Defect 3 — product or API terminology.
  productTerminology(text) {
    return PRODUCT_TERMS.filter((t) => hasWholeWord(text, t)).map(
      (t) => `contains product/API terminology: "${t}"`
    );
  },

  // Defect 4 — a banned voice name.
  bannedVoiceName(text) {
    return BANNED_VOICES.filter((v) => hasWholeWord(text, v)).map(
      (v) => `contains a banned voice name: "${v}"`
    );
  },

  // Defect 5 — a turn long enough to risk the five-minute degradation.
  turnLength(text) {
    const n = words(text).length;
    return n > MAX_SPOKEN_WORDS
      ? [`is ${n} words, over the ${MAX_SPOKEN_WORDS}-word ceiling for turn-length risk`]
      : [];
  },

  // Defect 6 — the buzz word inside clue text. This is the actual
  // echo-cancellation mitigation, not a rules nicety: the host must never
  // speak the word the player says to buzz in.
  buzzWordInClue(text) {
    return new RegExp(BUZZ_WORD, 'i').test(text)
      ? [`contains the buzz word "${BUZZ_WORD}"`]
      : [];
  },

  // Launch-wide: no vendor name, logo, or competitor reference anywhere.
  vendorReference(text) {
    return BANNED_VENDOR_TERMS.filter((t) => hasWholeWord(text, t)).map(
      (t) => `contains a vendor or competitor reference: "${t}"`
    );
  },
};

export function checkSpokenLine(text) {
  return Object.values(RULES).flatMap((rule) => rule(text));
}

// On-screen copy has one extra prohibition and one relaxation: no
// instrumentation may be visible (no millisecond readout, no field names, no
// product name in the interface), but length is not a turn-risk concern.
export function checkScreenCopy(text) {
  const violations = [
    ...RULES.pluralInterruption(text),
    ...RULES.scoreInTimeUnits(text),
    ...RULES.productTerminology(text),
    ...RULES.bannedVoiceName(text),
    ...RULES.vendorReference(text),
  ];
  if (/\b\d+\s*ms\b/i.test(text)) {
    violations.push('shows a millisecond readout on screen');
  }
  return violations;
}
