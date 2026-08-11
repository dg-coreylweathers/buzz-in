# SDK_WATCH — hand-rolled paths to retire when the SDK covers them

**Owner:** Corey Weathers · **Opened:** 2026-08-11
**Rule:** before assuming any gap below still exists, **check the current SDK
version first.** Every entry states what to look for.

---

## Why this file exists

The `Interrupt` / `SpeechInterrupted` message shape changed on Jul 30 — the
client message dropped `speech_id`, and the playback offset became cumulative
and monotonic rather than resettable per turn.

Rather than writing the resolved shape into game logic, this build isolates
it behind a **two-method interface** — *build the message*, *parse the
report* — with GA and EA shapes as swappable implementations selected by
`BUZZ_IN_INTERRUPT_SHAPE`. See `src/interruptShape.js`.

That adapter is the thing this file watches. It is a **deliberate, temporary
hand-roll around a gap**, not architecture worth keeping for its own sake.

---

## Entry 1 · `Interrupt` message construction

**Hand-rolled because:** the SDK has no typed constructor for the `Interrupt`
client message, so the field set is assembled by hand and the post-Jul-30
field set is asserted in tests rather than by a type.

**What the SDK might eventually cover natively:** a typed
`Interrupt`/`interrupt()` call that takes a playback offset and emits the
correct current-shape message, making shape selection an SDK version concern
instead of an application concern.

**Check in the release notes before removing:**

1. Does a typed `Interrupt` message or `interrupt()` method exist?
2. Does it take a **playback offset in the cumulative-monotonic form**, or
   still assume a resettable per-turn value? A resettable one is **not** a
   drop-in — it reintroduces the backwards-offset bug in PRD §5.1.
3. Does it send `speech_id` as a client field? If yes, that answers FLAGS.md
   **F-04**, and the answer arrived via the SDK rather than via Product.

**Retire when:** 1 and 2 are both yes. Delete `buildInterrupt` from both
implementations; keep the report parser until Entry 2 also clears.

---

## Entry 2 · `SpeechInterrupted` report parsing

**Hand-rolled because:** `text_spoken` and `text_remaining` are read off the
raw server message. This is the field pair the entire product depends on —
the score *is* the word count of `text_remaining` (DECISIONS.md D-07).

**What the SDK might eventually cover natively:** a typed
`SpeechInterrupted` event exposing both fields, ideally with the word split
already done.

**Check in the release notes before removing:**

1. Is there a typed `SpeechInterrupted` event, and does it expose **both**
   `text_spoken` and `text_remaining`? One without the other is useless here.
2. Is `speech_id` present as a **server-emitted diagnostic**? The Jul 30
   thread restores it in that direction — confirm the SDK matches.
3. Does the SDK **surface a Warning** when a playback offset is missing, and
   what is its code name and casing? That is FLAGS.md **F-05**, still open
   (`playback_offset_missing` was proposed lowercase where every other code is
   SCREAMING_CASE). **Do not adopt the SDK's casing into the docs guide until
   Product confirms it** — the SDK could ship the same unresolved guess.

**Retire when:** 1 is yes. Keep `canScoreInterruption` regardless — see below.

---

## Entry 3 · `canScoreInterruption(shape)` — keep this even after the SDK closes the gap

This predicate answers "does this message shape actually let me score a buzz
honestly?" as a **testable claim rather than a rhetorical one** (PRD §5.2).

It stays useful after the SDK adds native support, because it keeps asserting
the property the product needs — that the report carries `text_remaining` —
rather than asserting an SDK version number. Reuse this pattern for any new
SDK-gap tracking rather than inventing another mechanism.

---

## Entry 4 · Device-measured playback offset

**Hand-rolled because:** the offset is measured at the audio device — samples
actually rendered by the output worklet — never with a wall clock. Nothing in
the SDK exposes rendered-sample position; this is a browser-side concern the
SDK may never own.

**What to check:** if the SDK ever ships a browser playback helper, verify it
reports **rendered** samples, not enqueued ones. A wall clock or a
buffer-write position overcounts by including buffered-but-unheard audio and
silent underruns — tens of ms on a good connection, hundreds on a bad one,
**always in the direction of telling the player they heard more than they
did** (PRD §5.1).

**Retire when:** essentially never, unless an SDK helper provably measures at
the device. **Do not swap a wall-clock helper in to delete code.** This is one
of the three decisions PRD §5.1 marks as not open for revisiting.

---

## Version check log

| Date | SDK version checked | Gaps still open | Notes |
|---|---|---|---|
| 2026-08-11 | **not verified this run** | assumed all 4 | This run had no network-verified SDK version to check against and did not add an SDK dependency; the adapter is retained on the PRD's stated behavior. **First action for the next person: fill this row in properly.** |
