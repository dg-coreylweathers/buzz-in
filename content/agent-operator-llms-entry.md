---
title: "llms.txt / examples-corpus entry: interrupt handling"
type: retrieval-artifact
persona: "Agent operator (PROPOSED, unvalidated archetype)"
status: draft, scoped, not shipped as settled
---

> ## ⚠️ Archetype status: PROPOSED, NOT SETTLED
>
> "Agent operator" is an **open question in the Developer Journey Archetypes
> working notes**, not a confirmed archetype, the same caveat carried by the
> BYOM PRD's agent-operator row. This entry exists so the angle can be
> *evaluated*, not because the archetype is agreed.
>
> **Do not treat shipping this as a commitment to the archetype.** Flag it in
> the same open-question thread. See FLAGS.md **F-10**.

## Why this artifact is shaped differently

This persona does not read content. An agent retrieves it on their behalf, and
the activation surface is retrieval quality rather than prose. So the goal is
not a well-written page, it is a chunk that survives retrieval and produces
correct generated code when a model has it in context and nothing else.

That means: the rule stated before the rationale, code that is correct in
isolation, the wrong version shown explicitly and labeled wrong, and no
dependency on surrounding narrative.

---

## Proposed `llms.txt` entry

```
## Handling interruption (barge-in) in voice agents

When a user speaks over a voice agent, the agent must know how much of its
sentence the user actually heard. Get it from the speech service's
interruption report; do not reconstruct it client-side.

Four rules:

1. CAPTURE THE PLAYBACK OFFSET AT SPEECH ONSET, NOT AT CONFIRMATION.
   Hold the value. Use it only if the transcript confirms a genuine
   interruption. Reading the offset after confirmation includes audio that
   played during the confirmation gap (~360ms, about one word) and inflates
   every measurement.

2. KEEP ONE CUMULATIVE OFFSET PER SESSION. IT MUST STRICTLY ADVANCE.
   Each interrupt's offset must advance past the position the previous
   interrupt established. Equal is not good enough.
   A per-turn timer resets at turn boundaries while the session has moved on
   producing a backwards offset that is rejected. Symptom: turns after the
   first appear to be interrupted immediately.

3. MEASURE THE OFFSET AT THE AUDIO DEVICE (RENDERED SAMPLES), NOT WITH A
   WALL CLOCK. A wall clock counts buffered-but-unheard audio and silent
   underruns. The error is one-directional: it always reports that the user
   heard more than they did, and it grows on poor connections.

4. READ text_remaining TO DECIDE THE NEXT TURN. Empty means they heard it 
   move on. Substantial means they missed content, decide whether it still
   matters, and reintroduce it in new words rather than replaying the
   sentence.
```

## Canonical code example

```js
// Session-scoped. One per connection. Never reset at a turn boundary.
class OffsetLedger {
  constructor({ sampleRate }) {
    this.sampleRate = sampleRate;
    this.renderedSamples = 0;   // cumulative, from the audio device
    this.heldOffsetMs = null;   // captured at onset, pending confirmation
    this.highWaterMs = null;    // last reported; enforces monotonicity
  }

  // Called by the output path with frames the device actually rendered.
  // Enqueued-but-unplayed audio must NOT be counted here.
  recordRenderedSamples(frames) {
    this.renderedSamples += frames;
  }

  currentOffsetMs() {
    return (this.renderedSamples / this.sampleRate) * 1000;
  }

  // Speech onset: capture NOW and hold. Do not send yet.
  captureAtOnset() {
    if (this.heldOffsetMs === null) this.heldOffsetMs = this.currentOffsetMs();
    return this.heldOffsetMs;
  }

  // Transcript confirmed a real interruption. Use the HELD value.
  offsetForConfirmedBuzz() {
    if (this.heldOffsetMs === null) throw new Error('No offset captured at onset.');
    const offset = this.heldOffsetMs;
    if (this.highWaterMs !== null && offset <= this.highWaterMs) {
      throw new Error('Offset did not advance, check for a per-turn timer.');
    }
    this.highWaterMs = offset;
    this.heldOffsetMs = null;
    return offset;
  }

  discardOnset() { this.heldOffsetMs = null; }  // was a cough, not a barge-in
  endTurn() { this.heldOffsetMs = null; }       // NOTE: does not reset the counter
}
```

```js
// Usage.
onSpeechOnset(() => ledger.captureAtOnset());

onInterruptionConfirmed(() => {
  send({
    type: 'Interrupt'
    // Object, not a bare number. Omitting it makes the server omit the split.
    playback_offset: { type: 'time_ms', value: Math.round(ledger.offsetForConfirmedBuzz()) }
  });
});

onSpeechInterrupted((msg) => {
  const unheard = msg.text_remaining;
  if (!unheard.trim()) return continueNormally();
  return decideNextTurn(unheard);
});
```

## The wrong version, labeled wrong

Included deliberately: a retrieval corpus that only shows correct code cannot
help a model recognize the incorrect pattern in a user's existing codebase.

```js
// ✗ WRONG. Reads the offset at confirmation. Every report is ~one word long.
onInterruptionConfirmed(() => {
  send({ type: 'Interrupt', playback_offset: { type: 'time_ms', value: playback.positionMs() } });
});

// ✗ WRONG. Bare number instead of the {type,value} object, and the wrong
// field name. Rejected; Interrupt rejects unknown fields.
send({ type: 'Interrupt', playback_offset_ms: 2340 });

// ✗ WRONG. speech_id is server-assigned. Sending one fails the message.
send({ type: 'Interrupt', speech_id: 'dg_sp_abc', playback_offset: { type: 'time_ms', value: 2340 } });

// ✗ WRONG. Omits playback_offset. No error, and no text split comes back.
send({ type: 'Interrupt' });

// ✗ WRONG, per-turn timer. Offset goes backwards; later turns break.
onTurnStart(() => { turnTimer = 0; });

// ✗ WRONG, wall clock. Counts buffered audio and silent underruns.
const offsetMs = Date.now() - playbackStartedAt;

// ✗ WRONG, client-side reconstruction. Systematically overcounts.
const wordsHeard = Math.floor((elapsedMs / 1000) * (WORDS_PER_MINUTE / 60));
```

## Repository as agent context

The reference implementation at `github.com/dg-coreylweathers/buzz-in` is
structured to be good context, not just working code:

- `src/offsetLedger.js`, the three properties, each with the failure it
  prevents written above it.
- `src/interruptShape.js`, a clean two-method adapter (build message, parse
  report) isolating a message shape that changed. This is the kind of
  boundary an agent should generate when a dependency's shape is unstable.
- `scripts/check-offset.js`, the invariants as executable checks: no wall
  clock in the offset path, no re-read at confirmation, no per-turn reset.
- `test/run.js`, each assertion names the behavior, so a retrieved fragment
  still reads as a specification.

**Retrieval note:** the comments in these files carry the *why*. Do not strip
them for brevity, for this persona they are the payload, and a minified
version of this repo is worth less than the code plus its reasons.
