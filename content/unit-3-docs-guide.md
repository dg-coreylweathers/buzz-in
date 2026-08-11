---
title: "Handling interruption"
slug: handling-interruption
type: docs-guide
status: ready-for-review — FULL SPEC PASS REQUIRED BEFORE PUBLISH
word_target: 750
seo_title: "Handling interruption | Guide"
seo_description: "Report an interruption accurately: capture the playback offset at speech onset, keep one cumulative offset per session, and use the returned split to decide the next turn."
author: Corey Weathers
---

# Handling interruption

When a caller speaks over your agent, you need to know how much of the
sentence they actually heard before you can decide what to say next. This
guide covers reporting an interruption accurately and using what comes back.

> **Every field and message name in this guide was written from the Jul 30
> thread, not from a current spec revision. A full spec pass is required
> before publish.** See the open items at the bottom.

## The short version

1. Capture the playback offset **at speech onset**, and hold it.
2. Only send the interruption if your transcript confirms a genuine
   interruption rather than a cough or background noise — and send the **held**
   offset, not a fresh reading.
3. Read the returned split to decide your next turn.

## Capture the offset at onset

The offset you report is how far into the audio the caller was when they
started speaking. Two things about *when* and *how* you measure it decide
whether it is correct.

**Measure at the audio device, not with a clock.** Count the samples your
output has actually rendered. Audio you have enqueued but not yet played was
never heard, and a wall clock keeps counting through silent underruns. Both
errors run the same way — they report that the caller heard more than they
did — and both get worse as the connection gets worse.

**Capture at onset, not at confirmation.** There is a real gap between the
caller starting to speak and your transcript being confident enough to call it
an interruption. Audio keeps playing across that gap. If you read the offset
after confirmation, every report is long by roughly the length of that gap —
about one word at normal speaking pace.

The pattern that gets both right:

```js
// Speech onset: capture immediately and hold. Do not send yet.
const heldOffsetMs = playback.renderedPositionMs();

// ... transcript catches up ...

if (confirmedInterruption) {
  send({ type: 'Interrupt', playback_offset_ms: Math.round(heldOffsetMs) });
} else {
  // Not a real interruption. Discard the held value; nothing else changes.
}
```

## Keep one cumulative offset per session

The offset is cumulative across the session and must never decrease.

A per-turn timer will reset at a turn boundary while the session has moved on,
which produces an offset that goes backwards. That report is rejected, and the
symptom is confusing: turns after the first appear to be interrupted
immediately. Keep a single counter for the connection and never reset it at a
turn boundary.

If you keep a high-water mark alongside it, you can catch the mistake at the
point it happens rather than at the point it becomes strange behavior:

```js
if (offsetMs <= lastReportedOffsetMs) {
  throw new Error('Playback offset did not advance — check for a per-turn timer.');
}
```

## Use what comes back

The interruption report tells you what was spoken and what was not:

| Field | What it is |
|---|---|
| `text_spoken` | The text the caller actually heard |
| `text_remaining` | The text that was never reached |

Use `text_remaining` to decide the next turn:

- **Empty or nearly empty** — the caller heard essentially all of it. Move on;
  repeating anything here is what makes an agent feel like it isn't listening.
- **Substantial** — the caller missed real content. Decide whether it still
  matters. Often it doesn't, because they interrupted precisely because they
  already had what they needed.
- **Carries something they must hear** — a confirmation, an amount, a warning
  — reintroduce that content in your next turn rather than replaying the
  original sentence.

The value of getting this from the report rather than reconstructing it is
that it is exact. A client-side estimate built from elapsed time and a
speaking rate will overcount, and it will overcount more on a worse
connection.

## If the offset is missing

If you send an interruption without a usable playback offset, the service
cannot produce an accurate split and will return a warning rather than
guessing.

<!-- [verify] Warning code name and casing. `playback_offset_missing` was
     proposed, lowercase, where every other code in the spec is
     SCREAMING_CASE. UNCONFIRMED — do not publish a code name until Product
     confirms. FLAGS.md F-05. -->

Treat that warning as a bug in your integration, not as a condition to handle
at runtime: it means the offset was never captured, and any turn decision made
without it is a guess.

## Common mistakes

| Mistake | What you see | Fix |
|---|---|---|
| Reading the offset at confirmation | Every report is long by about a word | Capture at onset, hold it |
| Measuring with a wall clock | Overcounts, worse on poor connections | Count rendered samples |
| Resetting the offset per turn | Later turns look interrupted instantly | One counter per session |
| Reconstructing the split client-side | Consistent overcount | Use the reported split |

---

## Open items — resolve before publish

<!-- [verify] Full spec pass. Every field and message name here comes from the
     Jul 30 thread. The /v2/speak spec doc is stale (last edited Jul 28, still
     documents Interrupt.speech_id as a client field) and contradicts
     implemented behavior. The doc or this guide is wrong in public and it
     should not be this guide. FLAGS.md F-03. -->

<!-- [verify] Does speech_id survive as a CLIENT field on Interrupt? The Jul 30
     thread restores it as a server-emitted diagnostic but never confirms or
     denies it as a client input. This guide assumes it did NOT survive as a
     client field. Correct if wrong — and do not let review add it back
     without checking first. FLAGS.md F-04. -->

<!-- [verify] Warning code name/casing — see inline above. FLAGS.md F-05. -->
