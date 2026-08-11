// What did the player mean?
//
// The mic gives us a transcript. Most of the time a literal phrase match is
// enough and costs nothing. For everything else — "let's try that again",
// "wait, no", "give me another shot" — a tiny model call classifies the
// intent, so the game understands what people actually say instead of only
// the one phrase printed on screen.
//
// Cost discipline, in order:
//   1. Literal match first. Free, instant, handles the common case.
//   2. Obvious non-speech is discarded before any call.
//   3. Only genuinely ambiguous transcripts reach the model.
//   4. Results are cached per transcript, so repeats are free.
//
// Model: claude-haiku-4-5, the cheapest current model, with a tiny token
// budget. Classification is exactly the single-call, no-tools shape it suits.

import Anthropic from '@anthropic-ai/sdk';
import { BUZZ_PHRASES } from './copyRules.js';

export const INTENT = {
  BUZZ: 'buzz',      // "I know it" — cut the host off
  RETRY: 'retry',    // "let me try again" — another go at the same clue
  SKIP: 'skip',      // "pass", "next" — give up on this clue
  NONE: 'none',      // background noise, thinking aloud, anything else
};

const MODEL = 'claude-haiku-4-5';

// Literal matches, checked before any model call.
const RETRY_PHRASES = ['try again', 'another try', 'one more', 'let me retry', 'again'];
const SKIP_PHRASES = ['pass', 'skip', 'next one', 'give up', 'no idea'];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The free path. Returns an intent, or null when it cannot tell.
export function matchLiterally(transcript, phrases = BUZZ_PHRASES) {
  const clean = normalize(transcript);
  if (!clean) return INTENT.NONE;
  if (phrases.some((p) => clean.includes(p))) return INTENT.BUZZ;
  if (RETRY_PHRASES.some((p) => clean.includes(p))) return INTENT.RETRY;
  if (SKIP_PHRASES.some((p) => clean.includes(p))) return INTENT.SKIP;
  // One or two words that matched nothing is almost always noise, not intent.
  if (clean.split(' ').length <= 2) return INTENT.NONE;
  return null;
}

const SYSTEM = `You label short speech transcripts from a player of a trivia game.

The player listens to a host reading a clue aloud and interrupts when they know the answer.

Labels:
- buzz: the player is cutting in because they know the answer ("I know it", "got it", "oh I know this one")
- retry: the player wants another attempt at the clue they just got wrong ("let me try again", "one more shot", "wait, no")
- skip: the player is giving up on this clue ("pass", "next", "no idea")
- none: anything else, including thinking aloud, background speech, or an actual answer to the clue

Label what the player is doing, not what the clue is about. When unsure, use none.`;

const SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: [INTENT.BUZZ, INTENT.RETRY, INTENT.SKIP, INTENT.NONE] },
  },
  required: ['intent'],
  additionalProperties: false,
};

export class IntentClassifier {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, phrases = BUZZ_PHRASES } = {}) {
    this.phrases = phrases;
    this.cache = new Map();
    this.calls = 0;
    // No key is not an error. The literal matcher still works, so the game
    // stays playable and simply understands fewer ways of saying things.
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get enabled() {
    return Boolean(this.client);
  }

  async classify(transcript) {
    const literal = matchLiterally(transcript, this.phrases);
    if (literal !== null) return { intent: literal, source: 'literal' };
    if (!this.client) return { intent: INTENT.NONE, source: 'no-key' };

    const key = normalize(transcript);
    if (this.cache.has(key)) return { intent: this.cache.get(key), source: 'cache' };

    try {
      this.calls += 1;
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 64,          // one short JSON object; classification is the
                                 // documented case for a small budget
        system: SYSTEM,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: `Transcript: "${transcript}"` }],
      });

      const text = response.content.find((b) => b.type === 'text')?.text ?? '';
      const intent = JSON.parse(text).intent;
      const valid = Object.values(INTENT).includes(intent) ? intent : INTENT.NONE;
      this.cache.set(key, valid);
      return { intent: valid, source: 'model' };
    } catch (err) {
      // A classifier failure must never break the game. Fall back to "heard
      // nothing", which just means the player buzzes with the space bar.
      return { intent: INTENT.NONE, source: 'error', error: err.message };
    }
  }
}
