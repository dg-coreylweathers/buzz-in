// The simulator: a full buzz loop that runs with no API key.
//
// It stands in for the speech session by rendering a clue word by word into
// the same offset ledger the real playback path feeds, and by emitting the
// same SpeechInterrupted message shape the server emits. That is what makes
// the headless three-clue run meaningful rather than decorative — the code
// under test is the real code, only the transport is fake.
//
// Deliberately NOT simulated: voice quality, real network timing, and mobile
// audio behaviour. Those need a human with ears and a device. See FLAGS.md.

import { OffsetLedger } from './offsetLedger.js';

const SAMPLE_RATE = 48000;
// Normal speaking pace, ~150 wpm => 400ms per word. Close enough for a
// deterministic harness; it is not a claim about real timing.
const MS_PER_WORD = 400;
// Measured gap between speech onset and keyword confirmation (PRD 5.1).
// The offset is captured at onset and held across this gap — never re-read at
// the far end of it.
export const ONSET_TO_CONFIRMATION_MS = 360;

export class SimulatedSpeech {
  constructor({ ledger, sampleRate = SAMPLE_RATE } = {}) {
    this.sampleRate = sampleRate;
    this.ledger = ledger || new OffsetLedger({ sampleRate });
    this.sent = [];
  }

  framesForMs(ms) {
    return Math.round((ms / 1000) * this.sampleRate);
  }

  // Render `wordCount` words of audio into the ledger, as the device would.
  renderWords(wordCount) {
    this.ledger.recordRenderedSamples(this.framesForMs(wordCount * MS_PER_WORD));
  }

  renderMs(ms) {
    this.ledger.recordRenderedSamples(this.framesForMs(ms));
  }

  // Speak a clue, optionally with the player buzzing after `buzzAtWord` words.
  //
  // The ordering here is the product. Onset first, capture immediately, keep
  // rendering audio across the confirmation gap, and only then decide whether
  // the buzz was real. If the offset were read after the gap it would include
  // that extra audio — about one word — and every score would be inflated.
  speak(clueText, { buzzAtWord = null, confirms = true } = {}) {
    const allWords = String(clueText).trim().split(/\s+/).filter(Boolean);

    if (buzzAtWord === null || buzzAtWord >= allWords.length) {
      this.renderWords(allWords.length);
      this.ledger.endTurn();
      return { interrupted: false, message: null, offsetMs: null };
    }

    // Audio the player actually heard before opening their mouth.
    this.renderWords(buzzAtWord);

    // 1. Speech onset. Capture and hold. This is the whole decision.
    const heldOffsetMs = this.ledger.captureAtOnset();

    // 2. Audio keeps playing while the transcript catches up.
    this.renderMs(ONSET_TO_CONFIRMATION_MS);

    if (!confirms) {
      // Not a real buzz — someone coughed. Drop the hold, keep the counter.
      this.ledger.discardOnset();
      this.renderWords(allWords.length - buzzAtWord);
      this.ledger.endTurn();
      return { interrupted: false, message: null, offsetMs: null };
    }

    // 3. Confirmed. Use the HELD value, never the current one.
    const offsetMs = this.ledger.offsetForConfirmedBuzz();

    const spoken = allWords.slice(0, buzzAtWord);
    const remaining = allWords.slice(buzzAtWord);

    const message = {
      type: 'SpeechInterrupted',
      text_spoken: spoken.join(' '),
      text_remaining: remaining.join(' '),
      speech_id: `sim-${this.sent.length + 1}`,
    };
    this.sent.push(message);
    return { interrupted: true, message, offsetMs, heldOffsetMs };
  }
}
