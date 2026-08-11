---
title: "Onset capture and monotonic offsets inside Pipecat's barge-in handling"
slug: onset-capture-in-pipecat
type: blog
persona: Partner dev
status: draft, one [verify] blocking publish (issue link)
word_target: 900
keyword_lane: "framework-specific integration"
seo_title: "Onset capture and monotonic offsets inside Pipecat's barge-in handling"
seo_description: "If you're already inside Pipecat's abstractions, here's where the onset-capture and monotonic-offset patterns go, and which layer owns each piece."
author: Corey Weathers
image_brief: >
  A single instrument panel with one module slid partway out of the rack
  exposing the connector behind it. Amber key light, matte surfaces, no logos.
  The point of the image is "this part plugs into something else."
---

# Onset capture and monotonic offsets inside Pipecat's barge-in handling

A generic post about handling interruption correctly doesn't reach you if
you're already working inside a framework's abstractions. The advice is right
and the code doesn't fit, the framework already owns your audio output, your
transcript stream, and your turn boundaries, which are exactly the three
places the pattern needs to touch.

This is the Pipecat-specific version.

> **There is an open issue in Pipecat describing this exact bug class.**
> <!-- [verify] Issue link/number. FLAGS.md F-11. This piece should reference
>      the actual open issue, do not paraphrase it from memory, and do not
>      publish without the link. -->

## What the framework already does for you

Pipecat's pipeline gives you the pieces in roughly the right shape: audio
moves through the pipeline as frames, interruption is a first-class event
rather than something you detect yourself, and turn boundaries are explicit.

That means you are not building barge-in from scratch. You are making sure the
number that reaches the speech service is measured at the right moment and
never goes backwards, two properties the framework does not enforce for you
because it has no way to know you care.

## The three placements

### 1. Onset capture belongs at the interruption event, not the transcript handler

The instinct is to do the work where you learn the interruption was real 
where the transcript confirms it. That is the single most common way to get
this wrong, and it costs you about one word every time, because audio kept
playing while the transcript caught up.

Capture the playback position when the user-started-speaking event fires, and
hold it. Confirm afterwards. If the confirmation never comes, discard the held
value, the counter itself is untouched.

Concretely: the capture goes in your handler for speech *start*, not in your
handler for a confirmed transcript. If your code reads the offset in the same
function that decides "yes, this was a real interruption," it is already
wrong.

### 2. The offset counter belongs to the session, above the turn

Pipecat's turn boundaries are helpful and, here, a trap. It is natural to
attach a counter to the thing that has a lifecycle matching the turn, and
that produces a counter that resets while the conversation continues.

The symptom is distinctive: turns after the first appear to be interrupted
immediately. In my own build this presented as every clue after the first
scoring a perfect run, which looked like a generous game rather than a broken
harness. It is the same shape in any framework, the second turn's offset is
smaller than the first turn's, the report is rejected, and what you observe is
not an error but implausibly good behavior.

Put the counter on whatever object lives for the whole connection, and let
turn boundaries clear the *held onset value* only, never the counter.

### 3. Measure at the output transport, not at the pipeline stage

The offset must reflect audio the caller actually heard. Inside a pipeline
frames pass through several stages before anything reaches a speaker or a
carrier, and each stage is a place where audio exists but has not been played.

Measure as close to the output transport as you can get, and count what was
rendered rather than what was handed along. A frame that entered the output
stage during a network stall was not heard, and counting it tells the caller
they heard more than they did.

## A checklist for a Pipecat integration

- [ ] The playback offset is read in the speech-start handler, not the
      transcript-confirmation handler.
- [ ] The value is held, and used only if the interruption is confirmed.
- [ ] An unconfirmed interruption discards the held value and leaves the
      counter alone.
- [ ] The counter lives on the session/connection object, not on a turn.
- [ ] Turn boundaries clear the held value but never reset the counter.
- [ ] The counter is asserted non-decreasing, with a loud failure if it
      regresses, this catches the per-turn mistake at the point it happens
      rather than at the point behavior gets strange.
- [ ] The offset is derived from rendered output, not from elapsed time and
      not from frames handed to a downstream stage.
- [ ] The offset is sent as `playback_offset: {"type":"time_ms","value":N}`
      measured from the start of the session's audio. Omitting it returns a
      report with no text split and no error.
- [ ] No extra fields on `Interrupt`. It rejects unknown fields, and
      `speech_id` is server-assigned.
- [ ] The next turn is decided from the returned text split rather than from a
      client-side estimate.

## Why this is worth the trouble

The framework gets you an interruption event. What it cannot get you is an
accurate answer to "how much did they hear," because that depends on where in
your specific pipeline the audio actually became sound.

Get it right and the agent picks up naturally. Get it wrong and you have an
agent that repeats itself slightly too often, the failure that doesn't show
up in logs and does show up in whether people stay on the call.

A full working reference, with the counter, the onset hold, and the
non-decreasing assertion all under test, is at
`github.com/dg-coreylweathers/buzz-in`, it isn't a Pipecat project, but the
three placements above map onto it directly.

---

<!-- Persona: Partner dev. Journey shape is set by the partner surface, a
     generic post doesn't reach someone already inside the framework's
     abstractions. BLOCKING on the issue link [verify] above. -->
