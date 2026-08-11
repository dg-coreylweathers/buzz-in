---
title: "How we know what you heard"
slug: how-we-know-what-you-heard
type: blog
status: GATED, research sign-off required (Tim or David). NOT ready for review.
word_target: 1400
keyword_lane: "how accurate it is"
author: Corey Weathers
---

> # ⛔ DO NOT PUBLISH, GATED ON RESEARCH SIGN-OFF
>
> **Owner of the gate: Tim or David. Not Corey, and not an agent.**
>
> **The 2026-08-11 unattended run filled in ZERO figures and changed ZERO
> numbers in this document.** Every `[verify]` below is exactly as it was
> found. This is deliberate, the structure is complete and the figures are
> the entire contribution, so a plausible-looking placeholder here is worse
> than a blank.
>
> If a figure lands weaker than hoped: **reframe the section rather than
> soften the wording.** A hedged sentence around a weak number reads as
> spin; a narrower claim around the same number reads as rigor.
>
> See FLAGS.md F-12.

---

# How we know what you heard

## Section 1, The claim under test

The claim: an interruption report from the speech service gives you an exact
split of what the caller heard and what they didn't, and a client-side
reconstruction of the same quantity is systematically wrong in one direction.

"Systematically" is the load-bearing word, and it is what the measurements are
for. A method that is sometimes high and sometimes low averages out across a
conversation. A method that is *always* high does not.

## Section 2, Method

- Corpus: [verify] number and kind of utterances
- Voice set measured: **[verify]**, see the open judgment call below; this
  must name the actual set, not a representative one
- Interruption points per utterance: [verify]
- Network conditions simulated: [verify]
- Ground truth established by: [verify]
- Runs per condition: [verify]

Every measurement was taken against staging.

## Section 3, Client-side reconstruction, measured

Error of the wall-clock reconstruction against ground truth:

| Condition | Mean error (words) | p50 | p95 |
|---|---|---|---|
| Good connection | [verify] | [verify] | [verify] |
| Degraded connection | [verify] | [verify] | [verify] |
| With induced underruns | [verify] | [verify] | [verify] |

Direction of error: [verify], the claim is that it is one-directional
(overcount). **If the data does not support one-directionality, that is the
finding, and this post says so.**

## Section 4, The onset-versus-confirmation gap

Measured gap between speech onset and transcript confirmation: [verify]
(the build's working figure is ~360ms, roughly one word at normal speaking
pace, **[verify] against the measured corpus, do not carry the build's
number into a research post**).

Error introduced by reading the offset at confirmation instead of onset:
[verify]

## Section 5, Device-measured versus wall-clock offset

| Method | Mean error | p95 | Worst case |
|---|---|---|---|
| Wall clock | [verify] | [verify] | [verify] |
| Device-measured (rendered samples) | [verify] | [verify] | [verify] |

## Section 6, Long turns

[verify], findings on longer turns.

**Open judgment call: should this be promoted to its own section?** See below.

## Section 7, What this means for your integration

[verify], write this only after the figures are signed off. The
recommendations must follow from the measurements, not the other way round.

---

## Three judgment calls that need a reviewer, not an agent

These are flagged on the page itself and are **not** for Corey or for an agent
to decide:

1. **Does the headline survive the tail?** The claim is built on central
   tendency. If p95 tells a materially different story, the headline changes.
   [verify]

2. **Should the long-turn finding be promoted to its own section?** It is
   currently Section 6. If it is the strongest result, it is buried; if it is
   the weakest, promoting it invites scrutiny the data may not support.
   [verify]

3. **Which voice set was actually measured?** Section 2 must name it exactly.
   This interacts with the unresolved voice-name reconciliation (FLAGS.md
   F-06), the GA roster is larger than the EA twelve, with names still
   outstanding. **Do not name a voice set from memory.** [verify]

---

## Lane discipline

This unit owns **how accurate it is**. Unit 1 owns **why you want this
server-side**. Do not let this post argue the server-side case at length, link
it. Do not let unit 1 quote figures from here before sign-off.
