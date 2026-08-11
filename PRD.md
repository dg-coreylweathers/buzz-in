# PRD: Buzz-In Quiz — build + persona content

> **Owner:** Corey Weathers (DevRel) · **Target ship:** GA+2, Aug 19 · **Status inherited from cluster page:** built, unblocked, ready for review
> **Purpose:** build-ready restatement of this cluster, meant to be handed to Claude as a goal to navigate unattended. Adds persona-mapped content coverage and formalizes the staging/SDK/visual policies used across the launch cluster PRDs.
> **Supersedes:** treat this PRD as authoritative over the earlier "Interrupt Me If You Can" PRD, same as the cluster page does.

---

## 1. One-line goal

Finish, verify, and ship Buzz-In Quiz — a trivia game where the score is the exact number of words the host never got to say — plus its four content units, plus new content covering the personas this cluster doesn't already reach.

## 2. Why this exists

When a caller talks over a voice agent, the agent needs to know how much of its sentence the person actually heard, or the next turn breaks: it either repeats itself or loses its place. Flux TTS reports this directly via `text_spoken` and `text_remaining` on `Interrupt`. Competing services don't, which forces developers to reconstruct it client-side and get it wrong in a predictable direction (always an overcount). This game turns that field into the entire scoring mechanism, which makes "you cannot build this on a competitor's API" a testable claim instead of a marketing line.

> **This is further along than a typical cluster PRD.** A working build already exists: the buzz loop, the cumulative-offset ledger, deterministic scoring, a 30-clue bank, seeded challenge links, and a simulator that runs with no API key. 47 assertions pass, both constraint checkers (`check:copy`, `check:clues`) pass, a full three-clue run completes headless. What's NOT done: anything that needs ears or a real device — voice quality, audio timing against the live API, and mobile Safari behavior are all unverified. This PRD's build section is about closing that gap and the several outstanding spec questions, not building from zero.

## 3. Non-negotiable constraints

Carry these into every artifact.

**Inherited from the launch-wide rules:**

- No vendor name, logo, or competitor reference anywhere — UI, copy, image alt text, spoken lines.
- Never expose the Deepgram API key client-side. The `/v2/speak` session is held server-side; the browser never opens it directly.
- **Build and test against staging only.** Every automated test, every manual verification pass, and the CI suite point at the Deepgram staging environment. Production is a deliberate, separate go-live step, never a side effect of finishing the build.
- **Use the SDK where it covers the need; hand-roll only the gap, and track it.** This cluster already does the hard part of this right — see Section 5.2, the existing two-method adapter (build message / parse report) with swappable GA and EA implementations. Extend that discipline with a maintained `SDK_WATCH.md` rather than reinventing the pattern.
- **Visual direction: informed by talk.deepgram.com, without losing the game's own identity.** See Section 5.4 — this cluster already has a strong, specific design intent (broadcast typography, tape-reel clue view) that should absorb talk.deepgram.com's token language (dark theme, ambient glow, glass surfaces, one accent color) rather than being replaced by it.

**Specific to this build, from the cluster's own machine-checked constraints — do not relax these:**

- No spoken line may contain the plural of "interruption," any score expressed in units of time, product or API terminology, a banned voice name (currently `brittany`, `marcus` — reconfirm against the GA roster before shipping, see Section 8), or a turn long enough to risk the five-minute quality degradation.
- The buzz word must never appear inside a clue's text (checked by `check:clues`, and it's the actual echo-cancellation mitigation, not just a rules nicety).
- No instrumentation visible on screen: no millisecond readout, no field names, no product name anywhere in the interface. The blog names the mechanism; the game performs it.
- The playback offset is captured at speech onset, never at keyword confirmation. This is the single decision the whole product's honesty rests on — see Section 5.1.

## 4. Scope

### In scope

1. Close the verification gap in Section 5: real-device audio, mobile Safari, and the open spec questions in Section 8, to the extent they can be closed without a live human listening.
2. Finalize and ship the four drafted content units (Section 6): close their `[verify]` items, get the research-gated benchmark post through its reviewer, get the docs guide's spec pass done.
3. Produce new persona-mapped content for the personas this cluster doesn't already cover well (Section 7) — unlike BYOM, most personas already have a home here; the gap is narrower.
4. Surface every item in Section 8 to its actual owner. This cluster has more open spec risk than BYOM did — don't let volume make any one of them feel less urgent.

### Out of scope

- Actually listening to the game and judging voice quality. No agent can do this — flag it, don't fake it. See Section 5.3.
- Resolving the `/v2/speak` spec doc's Jul 28/Jul 30 discrepancy, the `speech_id`-as-client-field question, or the `Warning` code casing. These are Product's calls.
- Reopening the Aura→Flux migration guide for the speed-range change. Separate ticket, flagged here, not fixed here.
- The Playground overlap decision. Same open question as the BYOM cluster; this demo is lower-risk since it's conversational rather than a second "try it" link, but it's still not this PRD's call.

## 5. Build spec

### 5.1 What's already correct — don't relitigate these

Three hard-won decisions are already implemented and tested. Preserve them exactly:

- **The offset is captured at speech onset, held, and only used if the transcript confirms a real buzz.** Measured gap between onset and keyword confirmation: ~360ms, about one word at normal speaking pace. Scoring at confirmation instead of onset inflates every score by about a word, and the player can hear that it's wrong — the reveal is the whole demo.
- **The offset is a single monotonic counter for the session, not a per-turn timer.** A per-turn counter resets at turn boundaries while the session counter has moved on, producing a backwards offset the server rejects. The build's own test harness hit this: every clue after the first buzzed instantly and scored a perfect run, which looked like a generous game rather than a broken harness.
- **The offset is measured at the audio device (samples actually rendered by the output worklet), never with a wall clock.** A wall clock overcounts by including buffered-but-unheard audio and silent underruns — tens of ms on a good connection, hundreds on a bad one, always in the direction of telling the player they heard more than they did.

### 5.2 The adapter pattern — this is your SDK_WATCH mechanism

The `Interrupt` message shape changed Jul 30 (dropped `speech_id` from the client message; the offset became cumulative-and-monotonic instead of resettable). Rather than writing the resolved shape into game logic, the build already isolates it behind a two-method interface — build the message, parse the report — with GA and EA shapes as swappable implementations selected by `BUZZ_IN_INTERRUPT_SHAPE`.

**Extend this instead of duplicating it:**

- Add `SDK_WATCH.md` documenting: which parts of this adapter would disappear if the official SDK added native support for `Interrupt`/`SpeechInterrupted`, and what to check in the SDK's release notes before removing the hand-rolled path.
- The existing `canScoreInterruption(shape)` predicate is exactly the right instinct — a testable claim instead of a rhetorical one. Keep using that pattern for any new SDK-gap tracking.
- Before assuming the hand-rolled path is still necessary, check whether the current SDK version has closed the gap.

### 5.3 What cannot be verified unattended — flag, don't fake

> **An agent has no ears and no microphone.** Voice quality, real audio timing against the live staging API, and mobile Safari touch/audio behavior all require a human with headphones and a real device. Do not attempt to simulate or infer a pass on these. Run everything that can be checked headless — `scripts/smoke.js --buzz-at`, the constraint checkers, the assertion suite — against staging, and log the rest as an explicit, itemized human-verification checklist in `FLAGS.md`. "Ran the smoke script and it didn't error" is not the same claim as "a human confirmed the audio sounds right," and `STATUS.md` needs to keep those separate.

### 5.4 Visual design direction

The cluster's own design intent is already specific and good: **studio equipment running a game show** — dark, matte, instrument-grade chassis, broadcast typography with the word count as by far the largest thing on screen, no framework, no utility classes, a 16px-multiple spacing scale. The clue renders as a strip of individual words: spoken words lit, unreached words dim and struck through, with a hard rule in the strike color where the cut landed.

> **Bring in talk.deepgram.com's token language without losing the game's identity.** Pull the dark background treatment, ambient glow, and single accent color from talk.deepgram.com's actual tokens where they're compatible with "broadcast game show" rather than "glassy voice picker" — e.g. the ambient glow behind the chassis, one accent color used sparingly for the live/active state, generous negative space around the word count. Do NOT import their glassy gradient-orb motif wholesale; this game's focal object is the word strip and the count, not a voice orb, and forcing that motif in would fight the "instrument, not toy" read this design already has. Where the two directions conflict, this cluster's own design intent wins — it's more specific to this product and was written by someone who'd already built the thing.

### 5.5 Sound design — lean into it

> The game show framing (Section 5.4) is currently visual-only. This product should sound like the thing it's pretending to be. A buzz-in quiz with no buzzer sound, no sting on a correct answer, and no tension under a reversal clue is undercutting its own premise. Where a moment calls for a sound effect or a music cue, use one — don't leave it flat because audio felt like a stretch goal.

**What needs a sound, at minimum:**

- The buzz itself — a real buzzer or bell sound at the moment of a confirmed interrupt, distinct from any voice audio.
- A correct-answer sting and a wrong-answer sting, short and game-show-flavored, timed to land right as the score updates.
- A tension cue under `reversal` clues, since the format is a genuine gamble and the audio should telegraph that a straight-sounding statement might flip.
- A drumroll or rising tension riser for a clue that's about to run out (the host is close to finishing without a buzz).
- A small, satisfying UI tick for the word-strike animation, so the visual count-up (Section 5.4) has an audio partner rather than playing silently.

**How to build this unattended, without needing a sound library or a composer:**

- Generate short sound effects programmatically with the Web Audio API (oscillators, noise bursts, simple envelopes) rather than sourcing external audio files. A buzzer, a ding, a riser, and a UI tick are all well within reach of synthesized tones and don't require any licensed or downloaded asset. This also sidesteps any copyright question entirely, since nothing is being reproduced from an existing recording.
- Do not pull in a royalty-free SFX or music pack from an unverified source, and do not attempt to reproduce a recognizable game-show jingle (Jeopardy, etc.) even loosely — that's someone else's IP, not a public convention to imitate.
- If genuinely composed music (not just synthesized SFX) would meaningfully improve the LiveStream or the shorts, that's real production work for a human, not something to fake with synthesis and call finished. Flag it in `FLAGS.md` as a nice-to-have for whoever produces those assets, rather than shipping a synthesized placeholder as if it were the final music bed.
- Respect the existing "no instrumentation on screen" rule — sound is a chance to add personality without adding a field name or a product name to anything spoken or displayed.
- All sound effects respect `prefers-reduced-motion`-adjacent good sense: provide a mute toggle, and never autoplay audio the player didn't trigger.

### 5.6 Acceptance criteria

- [ ] All 47 existing assertions still pass, plus both constraint checkers (`check:copy`, `check:clues`)
- [ ] Full three-clue run completes headless via `scripts/smoke.js`
- [ ] Every test and verification pass runs against staging, never production
- [ ] `SDK_WATCH.md` exists, documents the `Interrupt`/`SpeechInterrupted` adapter as a tracked gap, and states what to check on the SDK's next release
- [ ] No spoken line trips the six confirmed defects (plural "interruption," score-in-time-units, product/API terminology, banned voice name, turn-length risk, buzz word inside a clue)
- [ ] Playback offset is held at onset and never read at confirmation — covered by an existing or new automated assertion, not just code review
- [ ] Voice list uses only the confirmed cutlist (`rufus`, `jack`, `cole`, `haley`, and others per Section 8's reconciliation), excludes `brittany` and `marcus`
- [ ] A human-verification checklist exists in `FLAGS.md` for everything Section 5.3 says can't be checked unattended (voice quality, live-API audio timing, mobile Safari)
- [ ] Visual surface follows Section 5.4 — the game's own design intent, informed by but not replaced by talk.deepgram.com's tokens

## 6. Content units to finalize

All four have full drafts. The work here is closing gaps, not drafting from scratch — note two of these are gated on people other than Corey.

| # | Unit | Type | Status | Remaining work |
|---|---|---|---|---|
| 1 | What the server knows that your client doesn't | Blog, ~1,750 words | Full draft, ready for review | **Repo path resolved:** `github.com/dg-coreylweathers/buzz-in` — no `deepgram-devs` repo exists for this project, so it lives under Corey's personal account, same as BYOM. Update the `git clone` line in the draft to match. Close remaining [verify]s: Pipecat issue link/number, current signup offer terms; confirm whether `speech_id` survived as a client field before letting review add it back |
| 2 | How we know what you heard | Blog, ~1,400 words | Structure complete, every figure is [verify] pending research sign-off | **Gated on Tim or David, not Corey.** Do not publish any figure until signed off; if a figure lands weaker than hoped, reframe the section rather than soften the wording. Three judgment calls flagged on the page itself need a reviewer, not an agent: does the headline survive the tail (p95), should the long-turn finding get promoted to its own section, which voice set was actually measured |
| 3 | Docs guide: Handling interruption | Docs guide, ~750 words | Full draft, ready for review | **Full spec pass required before publish** — every field/message name in the doc is written from the Jul 30 thread, not a current spec revision. Confirm the `Warning` code name (proposed `playback_offset_missing` is lowercase where every other code is SCREAMING_CASE) and whether `speech_id` survived as a client field |
| 4 | LiveStream run-of-show and shorts scripts | Video + Short | Run of show and five shorts scripted | Reconfirm the six voice names against the current GA roster the week of the stream (not now — the roster was still being finalized as of Aug 3). Reconfirm leading-silence and normalize-before-export figures before cutting any clip |

**Keyword lanes stay separated** — unit 1 owns *why you want this server-side*, unit 2 owns *how accurate it is*. Don't let either bleed into the other's territory.

## 7. Persona-mapped content

Unlike BYOM, this cluster already reaches most of the six archetypes reasonably well through its four existing units. The gap is narrower — don't manufacture new pieces where an existing unit already does the job.

> **Agent operator is included below as a proposed seventh row**, same caveat as the BYOM PRD: this is an open question in the Developer Journey Archetypes working notes, not a settled archetype. Treat it as a content angle to validate, and flag it in that same open-question thread.

| Persona | Already covered by | Gap / new content | Why |
|---|---|---|---|
| Curious dev | The "One word in" flagship short — already the wow-clip, no explanation needed, sells the idea in 15 seconds | None needed. Confirm its caption ends on a CTA an agent can act on, matching the BYOM pattern | Agentic shift collapses awareness to first code; the short already does the hard part |
| Explorer | "How we know what you heard" (the benchmark post) IS this persona's post already — research-fronted, structured to be cited rather than just ranked | None needed once it clears research sign-off. Don't duplicate it | Explorer forms a performance opinion before testing; a rigorous benchmark with real figures is exactly the content type this archetype needs |
| Builder | "What the server knows that your client doesn't" (build post) + the docs guide | None needed | — |
| Scaler | Not covered | New: an ops-angle piece on running interrupt handling across many concurrent live sessions in production — what changes about the monotonic-ledger and onset-capture patterns when it's not one browser tab but hundreds of concurrent calls, and what to monitor for drift once it's live | Scaler's failure mode is a cost/latency/reliability wall post-migration, not the initial build decision. Nothing in this cluster currently addresses production-scale operation |
| Champion | The LiveStream is a partial fit (live rebuild format) but it's an event, not a durable artifact people can find later | New: package the cluster page's own "three iterations" narrative (score off the API shape vs. the risk; word count vs. a formula; hold at onset vs. confirmation) as a written build-teardown people can fork from, separate from and more durable than the stream | Champions want a recipe to build on top of, and want it available after the stream ends. The iteration narrative already exists almost verbatim in the cluster page — this is packaging, not fresh writing |
| Partner dev | The build post name-checks an open Pipecat issue describing this exact bug class but doesn't resolve it for Pipecat users specifically | New: a short, framework-specific note (starting with Pipecat, given the live issue reference) showing the onset-capture and monotonic-offset pattern inside that framework's barge-in handling | Partner dev's journey shape is set by the partner surface; a generic post doesn't reach someone already inside Pipecat's abstractions |
| Agent operator (proposed) | Not covered | New: llms.txt / examples-corpus entry for the interrupt-handling pattern — capture offset at onset, hold it, never let it decrease, read `text_remaining` for what to do next. Make the repo itself excellent agent context: the adapter pattern (Section 5.2) is already a clean, well-isolated example of exactly the kind of code an agent should generate for this problem | This persona doesn't read content, an agent retrieves it on their behalf. The activation surface is retrieval quality, not prose — same logic as the BYOM PRD's agent-operator row |

**Acceptance for this section:**

- [ ] No new piece duplicates an existing unit's job — check the "already covered by" column before drafting anything
- [ ] Scaler and Partner-dev pieces are the priority new work; Champion packaging is lower-effort (it's mostly extraction from the cluster page); agent-operator is flagged as validating an open question, not shipped as settled
- [ ] Partner-dev piece references the actual open Pipecat issue once its link is confirmed (Section 6, unit 1's [verify] item)

## 8. Flag, don't resolve: route these to the right owner

This cluster carries more open spec risk than BYOM did. Route each of these, don't attempt to close any of them yourself.

- **Repo home is resolved:** `github.com/dg-coreylweathers/buzz-in`. No repo exists under `deepgram-devs` for this project — don't search for one or wait on it. This isn't a flag-and-route item, it's decided; listed here only so it isn't mistaken for one of the open questions below.
- **The `/v2/speak` spec doc is stale and contradicts the implemented behavior.** Last edited Jul 28, still documents `Interrupt.speech_id` as a client field. Its Approvals property reads "Pending (ajsyp)" with no approval from ajsyp anywhere in the record. Route to Product — the doc or the docs guide is wrong in public, and it should not be the docs guide.
- **Whether `speech_id` survived as an accepted client field on `Interrupt` is genuinely unresolved.** The Jul 30 thread clearly restores it as a server-emitted diagnostic but never explicitly re-confirms (or denies) it as a client input. The build and the docs guide currently assume it did not survive as a client field — correct if wrong, don't let a reviewer add it back without checking first.
- **The `Warning` code for a missing offset is unconfirmed.** `playback_offset_missing` was proposed, lowercase, where every other code in the spec is SCREAMING_CASE. Route to Product.
- **Voice-name reconciliation.** The parent launch page recommends `meghan`, `conor`, `wes` and lists `rufus`, `brittany`, `marcus` to avoid. The confirmed EA Launch-12 cutlist is entirely different names, and `meghan`/`conor`/`wes` don't appear in it at all. The build already uses cutlist-only names (`rufus`, `jack`, `cole`, `haley`) and excludes `brittany`/`marcus` — but the parent page itself needs reconciling, and the GA roster is larger than the EA twelve with 17 new voice names still outstanding as of Aug 3. This is the same voice-guidance discrepancy flagged in the BYOM PRD — one fix serves both clusters.
- **Playground overlap**, same open question as BYOM's cluster. Lower risk here since this demo is conversational rather than a second "try it" link, but still Product's call.
- **Pause control unreliable in staging as of Aug 5.** Not a blocker for this build (it uses no pause control) but it's live and affects anyone else scripting audio for launch — worth flagging even though it's not this cluster's problem.
- **The Aura→Flux migration guide predates the Jul 23 speed-range narrowing**, same gate identified in the BYOM PRD. Don't fix it here; confirm it's tracked once, not per-cluster.

## 9. Sequencing

| When | Do | Depends on |
|---|---|---|
| Day 1 | Run the full existing test suite and both constraint checkers against staging; stand up `SDK_WATCH.md`; file the Section 8 items with their owners | Nothing — do this first |
| Day 1–2 | Docs guide (unit 3) spec pass; close [verify]s on unit 1 (build post) | Section 8 answers on `speech_id` and the `Warning` code, where available |
| Day 2–3 | Draft the Scaler and Partner-dev persona pieces (Section 7) — fastest new-content wins since the underlying material already exists in the build and the cluster's own narrative | Repo/adapter pattern documented per 5.2 |
| Day 3 | Package the Champion teardown from the cluster page's "three iterations" section | Nothing new — mostly extraction |
| Ongoing, off critical path | Benchmark post (unit 2) waits on Tim/David's research sign-off — don't block anything else on it | Research reviewer, not this build |
| Week of Aug 19 | Reconfirm voice names, leading-silence figure, and normalize-before-export figure against the current state before the LiveStream and shorts capture — not earlier, since these are explicitly moving targets | Current GA roster finalized |
| GA+2, Aug 19 | Ship: repo verified (headless + flagged human-verification checklist), build post + docs guide live, benchmark post live if signed off (else clearly deferred, not blocking), LiveStream run, at least the Scaler and Partner-dev persona pieces live | All of the above |

## 10. Definition of done

- All headless verification (Section 5.6) passes against staging; the human-verification checklist for voice quality, live-API audio timing, and mobile Safari is written and handed off, not skipped or faked
- `SDK_WATCH.md` documents the `Interrupt`/`SpeechInterrupted` adapter as a tracked gap
- Units 1 and 3 published with zero open [verify] items; unit 2 either signed off and published or explicitly deferred without blocking the rest of the cluster
- At least the Scaler and Partner-dev persona pieces (Section 7) published; Champion teardown and agent-operator entry scoped even if not yet live
- Every item in Section 8 has been routed to its actual owner, not silently resolved
- No vendor names, logos, or the six confirmed spoken-copy defects anywhere in any shipped artifact
- Visual surface follows Section 5.4: the game's own broadcast-instrument identity, informed by but not replaced by talk.deepgram.com's token language
