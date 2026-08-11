// Deterministic scoring.
//
// The score IS the number of words the host never got to say — the word count
// of text_remaining as reported by the server. Never a client-side
// reconstruction: reconstructing it client-side is the exact mistake this
// whole cluster exists to point at, and it fails in a predictable direction
// (always an overcount). See DECISIONS.md D-07.

export function countWords(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Split a clue into the word strip the UI renders: spoken words lit,
// unreached words dim and struck through, a hard rule where the cut landed.
export function buildWordStrip(clueText, textSpoken) {
  const all = String(clueText).trim().split(/\s+/).filter(Boolean);
  const spokenCount = countWords(textSpoken);
  return all.map((word, i) => ({
    word,
    spoken: i < spokenCount,
    cutHere: i === spokenCount,
  }));
}

export const OUTCOME = {
  CORRECT: 'correct',
  WRONG: 'wrong',
  NO_BUZZ: 'no_buzz',
};

// A buzz that was never confirmed by the transcript scores nothing. A buzz
// confirmed but answered wrong scores nothing either — the gamble is real,
// which is what the reversal clues are built around.
export function scoreBuzz({ textRemaining, outcome }) {
  const wordsUnsaid = countWords(textRemaining);
  if (outcome === OUTCOME.CORRECT) {
    return { points: wordsUnsaid, wordsUnsaid, outcome };
  }
  return { points: 0, wordsUnsaid, outcome };
}

export function scoreSession(results) {
  const total = results.reduce((sum, r) => sum + (r.points || 0), 0);
  const buzzed = results.filter((r) => r.outcome !== OUTCOME.NO_BUZZ).length;
  const correct = results.filter((r) => r.outcome === OUTCOME.CORRECT).length;
  return { total, clues: results.length, buzzed, correct };
}

// Answer matching is deliberately forgiving about case, articles, and
// punctuation, and deliberately strict about everything else.
export function answerMatches(given, accepted) {
  const normalize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/^(the|a|an)\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  const g = normalize(given);
  if (!g) return false;
  return accepted.some((a) => normalize(a) === g);
}
