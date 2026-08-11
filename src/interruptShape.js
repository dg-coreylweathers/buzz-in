// The interrupt-shape adapter.
//
// The Interrupt message shape changed Jul 30: the client message dropped
// speech_id, and the playback offset became cumulative-and-monotonic instead
// of resettable. Rather than writing the resolved shape into game logic, it
// is isolated behind a two-method interface — build the message, parse the
// report — with GA and EA shapes as swappable implementations.
//
// This adapter is a tracked, deliberate hand-roll around an SDK gap.
// See SDK_WATCH.md before deleting any of it.
//
// Open question, NOT resolved here: whether speech_id survived as an accepted
// CLIENT field. The Jul 30 thread restores it as a server-emitted diagnostic
// but never confirms or denies it as a client input. This build assumes it did
// not. See FLAGS.md F-04. Flipping that assumption is a default change on one
// line, which is the entire point of the adapter.

const SHAPES = {};

// --- GA (post Jul 30) — the default -----------------------------------------
SHAPES.ga = {
  name: 'ga',
  // speech_id is NOT sent by the client in this shape.
  sendsSpeechIdFromClient: false,
  // The offset is cumulative across the session and must never decrease.
  offsetIsCumulative: true,

  // Corrected 2026-08-11 against deepgram-docs PR #1092 (branch
  // docs/flux-tts-ga), which is the GA contract. Three things this build had
  // wrong before that check — see FLAGS.md F-16:
  //   - the field is `playback_offset`, NOT `playback_offset_ms`
  //   - it is an OBJECT, {type:'time_ms', value:N}, not a bare number
  //   - it is optional, but WITHOUT it the server omits text_spoken and
  //     text_remaining entirely — i.e. omitting it silently disables the one
  //     thing this product is built on
  buildInterrupt({ offsetMs }) {
    assertOffset(offsetMs);
    return {
      type: 'Interrupt',
      playback_offset: { type: 'time_ms', value: Math.round(offsetMs) },
    };
  },

  parseReport(message) {
    if (!message || message.type !== 'SpeechInterrupted') return null;
    return {
      // Both are OPTIONAL and are omitted when the Interrupt carried no
      // playback_offset. Absent is not the same as empty, so it is worth
      // knowing which happened.
      textSpoken: typeof message.text_spoken === 'string' ? message.text_spoken : '',
      textRemaining:
        typeof message.text_remaining === 'string' ? message.text_remaining : '',
      hasTextSplit:
        typeof message.text_spoken === 'string' && typeof message.text_remaining === 'string',
      // Echoes Interrupt.playback_offset when one was supplied; otherwise the
      // server's own count of audio GENERATED. Session-cumulative, not
      // turn-relative.
      audioPlayedMs: typeof message.audio_played_ms === 'number' ? message.audio_played_ms : null,
      // Server-emitted diagnostic, nested under metadata at GA. Never sent by
      // the client — unknown fields on Interrupt are rejected outright.
      speechId: message.metadata?.speech_id ?? message.speech_id ?? null,
    };
  },
};

// --- EA (pre Jul 30) — retained as a swappable implementation ----------------
SHAPES.ea = {
  name: 'ea',
  sendsSpeechIdFromClient: true,
  // Resettable per-turn offset. This is why the EA shape reintroduces the
  // backwards-offset bug if paired with a session-scoped ledger — see
  // PRD 5.1 and SDK_WATCH.md Entry 1.
  offsetIsCumulative: false,

  buildInterrupt({ offsetMs, speechId }) {
    assertOffset(offsetMs);
    const msg = {
      type: 'Interrupt',
      playback_offset_ms: Math.round(offsetMs),
    };
    if (speechId) msg.speech_id = speechId;
    return msg;
  },

  parseReport(message) {
    if (!message || message.type !== 'SpeechInterrupted') return null;
    return {
      textSpoken: typeof message.text_spoken === 'string' ? message.text_spoken : '',
      textRemaining:
        typeof message.text_remaining === 'string' ? message.text_remaining : '',
      speechId: message.speech_id ?? null,
    };
  },
};

// --- STAGING-OBSERVED (measured live 2026-08-11) -----------------------------
// This is NOT a design. It is what staging /v2/speak actually accepts and
// returns today, discovered by probing it. It is kept as its own
// implementation precisely so the difference from the GA shape is visible and
// testable rather than buried.
//
// Two findings, both material — see FLAGS.md F-15:
//   1. Interrupt accepts NO fields. Bare {type:'Interrupt'} is accepted; adding
//      playback_offset_ms, speech_id, playback_offset, or offset_ms all return
//      Error MESSAGE-0000 "The message could not be parsed."
//   2. SpeechInterrupted carries NO text_spoken and NO text_remaining. It
//      reports audio_played_ms plus metadata.speech_id.
//
// Consequence: canScoreInterruption(staging) is FALSE, and the game refuses to
// claim a server-authoritative score against this shape. That predicate was
// written for exactly this situation and it earned its keep.
SHAPES.staging = {
  name: 'staging',
  sendsSpeechIdFromClient: false,
  offsetIsCumulative: false,
  // The client cannot report a playback position to this shape at all.
  acceptsPlaybackOffset: false,

  buildInterrupt() {
    // Deliberately field-free. Adding anything here is rejected by the server.
    return { type: 'Interrupt' };
  },

  parseReport(message) {
    if (!message || message.type !== 'SpeechInterrupted') return null;
    return {
      // Not reported by this shape. Empty strings, never fabricated values.
      textSpoken: '',
      textRemaining: '',
      // What the server DID generate — not what the listener heard.
      audioPlayedMs: typeof message.audio_played_ms === 'number' ? message.audio_played_ms : null,
      speechId: message.metadata?.speech_id ?? null,
    };
  },
};

function assertOffset(offsetMs) {
  if (!Number.isFinite(offsetMs) || offsetMs < 0) {
    throw new Error(`playback offset must be a non-negative number — got ${offsetMs}`);
  }
}

export const AVAILABLE_SHAPES = Object.keys(SHAPES);

// This module is loaded by BOTH node and the browser, so it must never touch
// `process` unguarded. `process.env.X` in a default parameter throws
// ReferenceError in the browser the moment the argument is omitted, which is
// the common call. scripts/check-surface.js guards against this returning.
function shapeFromEnv() {
  if (typeof process === 'undefined') return undefined;
  return process.env?.BUZZ_IN_INTERRUPT_SHAPE;
}

export function getInterruptShape(name = shapeFromEnv()) {
  const key = (name || 'ga').toLowerCase();
  const shape = SHAPES[key];
  if (!shape) {
    throw new Error(
      `Unknown BUZZ_IN_INTERRUPT_SHAPE "${name}". Available: ${AVAILABLE_SHAPES.join(', ')}`
    );
  }
  return shape;
}

// A testable claim rather than a rhetorical one: does this message shape
// actually let us score a buzz honestly? Scoring requires the server to tell
// us what it did NOT say. Keep this predicate even after the SDK closes the
// gap — it asserts the property the product needs, not an SDK version.
// See SDK_WATCH.md Entry 3.
export function canScoreInterruption(shape) {
  if (!shape || typeof shape.parseReport !== 'function') return false;
  const probe = shape.parseReport({
    type: 'SpeechInterrupted',
    text_spoken: 'the first two',
    text_remaining: 'words of the clue',
  });
  return Boolean(probe) && typeof probe.textRemaining === 'string' && probe.textRemaining.length > 0;
}
