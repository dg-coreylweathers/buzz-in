// The offset ledger.
//
// Three properties, all from PRD 5.1, none of them open for revisiting:
//
//   1. The offset is CAPTURED AT SPEECH ONSET, held, and only used if the
//      transcript later confirms a real buzz. Reading it at keyword
//      confirmation instead inflates every score by roughly a word (~360ms
//      measured gap), and the player can hear that it is wrong.
//
//   2. The offset is a SINGLE MONOTONIC COUNTER FOR THE SESSION, not a
//      per-turn timer. A per-turn counter resets at turn boundaries while the
//      session counter has moved on, producing a backwards offset the server
//      rejects — which presents as every clue after the first buzzing
//      instantly and scoring a perfect run.
//
//   3. The offset is MEASURED AT THE AUDIO DEVICE — samples actually rendered
//      by the output worklet — never with a wall clock. A wall clock includes
//      buffered-but-unheard audio and silent underruns, always overcounting in
//      the direction of telling the player they heard more than they did.
//
// Nothing in this file may call Date.now() or performance.now(). That is
// asserted by scripts/check-offset.js.

export class OffsetLedger {
  constructor({ sampleRate = 48000 } = {}) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error(`sampleRate must be a positive number — got ${sampleRate}`);
    }
    this.sampleRate = sampleRate;
    // Cumulative samples rendered by the output device across the whole
    // session. Never reset at a turn boundary. Property 2.
    this._renderedSamples = 0;
    // The held onset capture, if a buzz onset is currently pending. Property 1.
    this._heldOffsetMs = null;
    // null until the first confirmed buzz, so that a legitimate buzz at
    // offset zero is not mistaken for a backwards one.
    this._highWaterMs = null;
  }

  // Called by the playback worklet with the count of frames it just rendered.
  // "Rendered" means the device actually played them. Property 3.
  recordRenderedSamples(frames) {
    if (!Number.isFinite(frames) || frames < 0) {
      throw new Error(`rendered frames must be a non-negative number — got ${frames}`);
    }
    this._renderedSamples += frames;
    return this.currentOffsetMs();
  }

  currentOffsetMs() {
    return (this._renderedSamples / this.sampleRate) * 1000;
  }

  // Speech onset detected. Capture the offset NOW and hold it. This is the
  // single decision the product's honesty rests on.
  captureAtOnset() {
    if (this._heldOffsetMs === null) {
      this._heldOffsetMs = this.currentOffsetMs();
    }
    return this._heldOffsetMs;
  }

  get hasHeldOffset() {
    return this._heldOffsetMs !== null;
  }

  get heldOffsetMs() {
    return this._heldOffsetMs;
  }

  // The transcript confirmed a real buzz. Use the HELD onset value — never
  // re-read the current offset here. Re-reading at this point is exactly the
  // bug that inflates every score by about a word.
  offsetForConfirmedBuzz() {
    if (this._heldOffsetMs === null) {
      throw new Error(
        'No offset was captured at onset. Refusing to read the offset at ' +
          'confirmation — that would inflate the score by about a word. ' +
          'See PRD 5.1.'
      );
    }
    const offset = this._heldOffsetMs;
    if (this._highWaterMs !== null && offset <= this._highWaterMs) {
      // Property 2: the session counter only ever moves forward. A backwards
      // offset is rejected by the server; an identical one means no audio was
      // rendered between two buzzes, which is the same bug wearing a hat.
      // Catch both here, with a message that names the actual cause.
      throw new Error(
        `Offset did not advance (${offset.toFixed(1)}ms vs ${this._highWaterMs.toFixed(1)}ms). ` +
          'This means a per-turn timer leaked in somewhere; the ledger is ' +
          'session-scoped and monotonic by design.'
      );
    }
    this._highWaterMs = offset;
    this._heldOffsetMs = null;
    return offset;
  }

  // Onset fired but the transcript never confirmed a buzz — drop the hold.
  // The counter itself is untouched: it is session-scoped, not per-turn.
  discardOnset() {
    this._heldOffsetMs = null;
  }

  // Turn boundary. Deliberately does NOT reset the counter. Property 2.
  endTurn() {
    this._heldOffsetMs = null;
  }
}
