---
title: "Interrupt handling at scale: what changes when it's not one browser tab"
slug: interrupt-handling-at-scale
type: blog
persona: Scaler
status: draft — ready for review
word_target: 1400
keyword_lane: "operating this in production"
seo_title: "Interrupt handling at scale | Operating barge-in across concurrent sessions"
seo_description: "The onset-capture and monotonic-offset patterns work fine in one browser tab. Here's what changes across hundreds of concurrent live sessions, and what to monitor for drift."
author: Corey Weathers
image_brief: >
  A rack of identical matte instrument panels seen in perspective, receding
  into shadow — many of the same device rather than one. Each shows a small
  row of lit and dimmed marks. Amber key light, no logos, no faces, no
  product UI.
---

# Interrupt handling at scale: what changes when it's not one browser tab

The onset-capture and monotonic-offset patterns are easy to get right in a
demo. One tab, one session, one counter, and a test suite that proves it.

Production is a different problem, and not for the reason people expect. The
per-session logic doesn't get harder. What gets harder is that you now have
hundreds of these counters, each one is stateful, each one is attached to a
connection that can die in ways a browser tab never does, and a single one
going wrong produces a conversation that feels broken to exactly one caller —
who will not file a bug that says "the playback offset went backwards."

This is about what changes, and what to watch.

## The state you didn't think you had

The pattern is: one cumulative playback offset per session, captured at speech
onset, never decreasing. In a demo that's an integer on an object.

At scale that integer is **per-connection state that must survive everything
your infrastructure does to connections.**

That means:

**A reconnect is not a fresh session.** If a caller's connection drops and
re-establishes mid-call, and your new session starts its offset at zero while
the conversation continues, you have manufactured the exact backwards-offset
condition that gets rejected. Decide explicitly: does a reconnect continue the
ledger, or start a genuinely new session? Both are defensible. Silently doing
the first while your code assumes the second is not.

**A session pinned to a process is a session lost on deploy.** If the offset
lives only in the memory of the process handling the call, every rolling
restart severs it. You either drain properly, or you accept that in-flight
calls lose their ledger, or you move the state somewhere a restart doesn't
reach. Pick one deliberately.

**Load balancing has to respect the session.** The ledger only means anything
in the context of one connection. If turns for one call can land on different
workers, the counter has to follow the call, not the request.

None of this is exotic. All of it is the sort of thing that works in staging
with three concurrent calls and fails at 300.

## Onset capture under real load

Capturing at speech onset means doing something at a moment defined by audio,
not by your scheduler. Under load, that gets harder in a way that is worth
naming.

The capture itself is cheap — read the rendered-sample position, store it. The
risk is that it lands in a queue behind other work. If onset capture is
handled on the same path as transcript processing, and that path backs up
under load, your "onset" capture drifts later. It stops being onset and starts
being onset-plus-queue-depth, which is the confirmation-time bug reintroduced
by way of your own infrastructure.

Two consequences:

- **Keep onset capture off the busy path.** It should be as close to the audio
  callback as your architecture allows, doing nothing but reading a counter
  and storing it.
- **The error is invisible in aggregate.** Every measurement is slightly long,
  in the same direction, only under load. Averages across a day will look
  fine. This is why the monitoring below is by-percentile and by-load, not by
  mean.

## What to monitor

The failures here are quiet. None of them throw. Four signals worth having
from day one:

**1. Rejected or refused offset reports, as a rate.** A backwards or
non-advancing offset is a real bug every time it happens. It should be near
zero. A non-zero rate that correlates with deploys means your session state
isn't surviving restarts; one that correlates with load means something in the
capture path is queueing.

**2. Distribution of the unsaid-word count, not its average.** In healthy
traffic this has a shape — most interruptions land somewhere in the middle of
a turn. Watch for the shape moving, especially mass piling up at zero (callers
appear to hear everything — likely capturing too late) or at the full turn
length (callers appear to hear nothing — likely capturing too early or losing
the ledger).

**3. Onset-to-confirmation gap, p95 and p99.** Track it as its own quantity.
The mean will be stable and useless. The tail tells you when your transcript
path is falling behind, and the tail is where the error lives.

**4. Reconnect rate alongside session-continuation rate.** If reconnects are
common and continuations are rare, you are starting fresh ledgers mid-call
more often than you think.

## Drift, and why it's the one to worry about

The failure mode that survives longest in production is **drift**: nothing
errors, nothing alerts, and the numbers get gradually less true.

It happens when a small, one-directional error gets introduced somewhere in
the capture path — a queue, an extra hop, a buffer you added for good reasons.
Every measurement is a little long. Every agent turn decision is made on a
slightly wrong premise. Callers get sentences repeated to them slightly more
often than they should, which reads as an agent that is a bit annoying rather
than an agent that is broken.

Nobody pages you for a bit annoying.

The defense is to keep a ground truth you can compare against periodically —
a synthetic call, on a known utterance, with a scripted interruption at a
known word, run continuously and checked. Not a load test; a correctness
canary. If it ever reports a different count than it did last week for the
same input, something in the path changed.

That canary is roughly what the demo's headless smoke run is, pointed at
production traffic patterns instead of a test harness.

## What doesn't change

Worth saying plainly, because it's the useful part: the three decisions that
make this correct in one tab are the same three at scale.

Capture at onset. One cumulative counter per session, never decreasing.
Measure at the audio device rather than with a clock.

Scale doesn't require a different pattern. It requires the same pattern to
survive reconnects, deploys, load balancing, and queueing — and it requires
you to be able to tell when it hasn't.

---

<!-- Persona: Scaler. Failure mode is a cost/latency/reliability wall
     post-migration, not the initial build decision. Nothing else in this
     cluster addresses production-scale operation — check before adding
     anything that overlaps unit 1 (build decisions) or unit 2 (accuracy). -->
