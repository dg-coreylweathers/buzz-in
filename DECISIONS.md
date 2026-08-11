# DECISIONS — Buzz-In Quiz

Every judgment call this unattended run made, and why. Dated 2026-08-11.

---

## D-01 · Reconstructed the build from the PRD instead of ending the run

**Situation:** GOAL.md step 1 says run the existing suite "before touching
anything else." There is no existing suite — see FLAGS.md F-01.

**Rule applied:** GOAL.md "WHEN TO STOP" — *stop only that piece of work, log
why, keep going on everything else. Never end the whole run over one blocked
item.*

**Decision:** Treat PRD §5 as a build spec and implement it, because every
other build-order step (review, sound, deploy, push) is downstream of code
existing at all. Ending the run would have delivered nothing.

**What would need to change:** If the original build surfaces (F-01), this
code is a **reconciliation candidate, not a replacement.** Diff the two before
either is discarded. Do not force-push over the original.

**Honesty boundary:** this run never claims to have verified the inherited 47
assertions. It wrote its own suite and reports it as such.

---

## D-02 · Used the `devrel-review` skill in place of `devrel-code-review`

GOAL.md step 2 names `devrel-code-review`. That skill is not installed; the
installed `devrel-review` skill's own description covers exactly this surface
(PRs, diffs, SDKs, starter apps, dev tooling, "is this merge-ready").

Closest available match, used deliberately. Logged in FLAGS.md F-02.

---

## D-03 · Drafted content without `deepgram-devrel-drafting`

That skill is not installed here (FLAGS.md F-02). House voice, SEO frontmatter
shape, and image briefs were matched to the conventions the PRD itself
describes for the existing units, rather than invented.

**What would need to change:** re-run the drafts through
`deepgram-devrel-drafting` in a session where it exists before publish, and
treat its output as authoritative over this run's voice choices.

---

## D-04 · No skill was extended, because `skill-creator` is unavailable

GOAL.md step 2 allows extending the review skill if it's missing a check this
codebase's shape clearly needs. It is missing one, and I could not add it.

**What I would have added, for whoever can:** an *offset-ledger check* —
assert that a captured playback offset is (a) sampled at speech onset and not
at keyword confirmation, (b) monotonically non-decreasing across turn
boundaries within a session, and (c) derived from rendered audio samples
rather than any wall clock (`Date.now`, `performance.now`) in the playback
path. All three are this codebase's specific failure modes (PRD §5.1) and a
generic review skill will not look for them.

**Mitigation shipped instead:** those three properties are enforced by
automated assertions in `test/run.js` and by a static guard in
`scripts/check-offset.js`, so the check exists in CI even though it does not
exist in the skill.

---

## D-05 · Interrupt-shape default is `ga`, with `ea` retained as a swappable implementation

PRD §8 leaves `speech_id`-as-client-field genuinely unresolved and states the
build "currently assumes it did not survive as a client field." That is the
PRD's own stated current behavior, so it is treated as decided.

`BUZZ_IN_INTERRUPT_SHAPE=ga` (default) omits `speech_id` from the client
message. `BUZZ_IN_INTERRUPT_SHAPE=ea` retains it.

**What would need to change:** if Product confirms `speech_id` survived as a
client input (FLAGS.md F-04), change the default to the shape that includes
it. One line. That is the entire point of the adapter.

---

## D-06 · Buzz word is `BUZZ`, and it is filtered out of the clue bank mechanically

PRD §3 requires the buzz word never appear inside clue text, and states this
is the actual echo-cancellation mitigation, not a rules nicety.

`check:clues` fails the build on any clue containing it, case-insensitively,
as a whole word or as a substring of a longer word.

---

## D-07 · Score is the word count of `text_remaining`, computed server-side

PRD §1: "the score is the exact number of words the host never got to say."
Taken literally — the count of whitespace-delimited tokens in `text_remaining`
as reported by the server, never a client-side reconstruction.

This is the claim the whole cluster rests on (PRD §2: competitors force a
client-side reconstruction that overcounts). Reconstructing it client-side
here would undercut the post.

---

## D-08 · Voice roster limited to the confirmed cutlist, enforced by assertion

`rufus`, `jack`, `cole`, `haley`. `brittany` and `marcus` are banned and the
ban is asserted, not just documented.

The parent launch page's `meghan`/`conor`/`wes` recommendation is **not**
followed, because PRD §8 states those names do not appear in the confirmed
cutlist at all. The discrepancy is routed, not resolved — FLAGS.md F-06.

---

## D-09 · Repo is public

GOAL.md step 6: public unless DECISIONS.md logs a reason otherwise. No reason
found — it is a demo built to be forked, and PRD §7's Champion and
agent-operator rows both depend on it being readable. **Public.**

No key material is committed; the staging key is read from the environment at
runtime and set on Fly via `fly secrets set`.

---

## D-10 · Sound is synthesized at runtime, muted-by-default until a player action

PRD §5.5 mandates Web Audio synthesis over any sourced library. Nothing
autoplays: the AudioContext is created only on the first player gesture, so a
page load makes no sound at all. A mute toggle persists to `localStorage`.

No cue imitates any recognizable existing game-show jingle. Melodic content is
limited to generic intervals (perfect fifths, octaves) that no one owns.

---

## D-11 · Staging-only is enforced in code, not just in policy

`src/config.js` resolves the API host from `BUZZ_IN_ENV`, defaults to
staging, and **throws** if anything sets it to production without an explicit
`BUZZ_IN_ALLOW_PROD=1`. GOAL.md's "every call targets staging, never
production" is a hard constraint, so it is a runtime guard rather than a
convention someone can forget.

---

## D-12 · The five-minute degradation risk is enforced as a word-count ceiling

No wall-clock turn length is measurable headlessly, so the constraint is
approximated statically: a spoken line is capped well under any plausible
five-minute turn at normal speaking pace.

**What would need to change:** if real playback shows a clue approaching the
risk window, tighten the ceiling — the check is one constant. Audible
confirmation is on the human checklist (FLAGS.md § A).

---

## D-13 · Added a `staging` interrupt shape rather than changing the default

Live probing (FLAGS.md F-15) showed staging accepts a field-free `Interrupt`
and returns no text split. Two options: change the GA shape to match what the
server does, or record the observed shape as its own implementation.

**Decision: add it as a third implementation, leave `ga` the default.**

One environment's behavior on one day is evidence, not a spec. The adapter
exists precisely so an observed shape can be captured and tested without
overwriting the documented one. `BUZZ_IN_INTERRUPT_SHAPE=staging` selects it.

**What would need to change:** if Product confirms the field-free shape is the
real contract, make it the default and retire `ga`. If the text split ships,
`staging` gets updated from the same probe script and
`canScoreInterruption(staging)` starts returning true on its own.

## D-14 · Live mode plays real audio but does not claim a server-authoritative score

`canScoreInterruption(staging)` is false, so `GameSession` refuses to start a
round on that shape. Live mode therefore streams **real voice audio from
staging** — the game is playable and the voices are real — while scoring
continues to come from the path that can be computed honestly.

**What this run refused to do:** reconstruct the word split client-side from
the device offset and present it as the score. That reconstruction is the
exact anti-pattern the whole cluster is written against (PRD §2), and shipping
it inside the demo that argues against it would be self-refuting.

**What would need to change:** when the split ships, live mode scores from
`text_remaining` and the two paths converge. Until then, the honest live demo
is "real voice, real interrupt, no fabricated number."

---

## D-15 · Buzz trigger is a phrase, chosen from measurement

The buzz word was `BUZZ`. Measured against staging Flux STT on 2026-08-11,
single plosive words do not survive recognition: "Buzz!" transcribed as
"But", "Buzzer!" as an empty string. Phrases did: "I know it!" came back
clean, as did "Answer!".

**Decision: the trigger is the phrase "I know it".** Accepting a mis-hearing
like "but" instead would false-trigger on ordinary clue words and score the
player for words they actually heard, which is worse than a missed buzz they
can simply repeat.

`check:clues` confirms the phrase appears in none of the 30 clues, which is
what keeps the echo-cancellation mitigation intact: if the host said it, the
player's own microphone would buzz them in.

## D-16 · Claude Haiku 4.5 classifies intent, behind a free literal matcher

The game should understand "let's try again" and "got it" without printing
every accepted phrasing on screen. A literal list cannot cover natural
speech, so `claude-haiku-4-5` (the cheapest current model) labels the
ambiguous remainder as buzz / retry / skip / none.

**Cost discipline, in order:** literal match first (free, instant, handles the
common case) · obvious non-speech discarded before any call · only genuinely
ambiguous transcripts reach the model · results cached per transcript, shared
process-wide, so a phrasing paid for once is free afterwards. Measured on a
ten-case set: 10/10 correct, 4 model calls, 6 free.

`max_tokens` is 64 and the output is schema-constrained to one enum field.

**Degradation is deliberate:** with no `ANTHROPIC_API_KEY` the classifier is
disabled, the literal matcher still works, and the game stays playable while
understanding fewer phrasings. A classifier error is caught and treated as
"heard nothing" — it can never break a round.

## D-17 · The countdown is a clock, not a readout

PRD §3 bans on-screen instrumentation. A game-show countdown is not
instrumentation: it shows whole seconds with **no unit label and no field
name**, which is furniture every game show has. What stays banned is what the
rule actually targets — millisecond readouts, field names, product names.
`check:copy` enforces that distinction and passes.
