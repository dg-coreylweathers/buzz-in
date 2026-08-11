# FLAGS — Buzz-In Quiz

Items that need a human. Each is written to be forwarded as-is.
Dates are the date the flag was raised in this run.

Legend: **BLOCKER** = something downstream is wrong until this is answered ·
**ROUTE** = not this run's call, hand to the named owner ·
**HUMAN-ONLY** = physically impossible for an agent to check.

---

## F-01 · BLOCKER · 2026-08-11 · The prior build is missing

**Owner:** Corey Weathers

GOAL.md and PRD.md §2 both describe an existing, working, tested build: buzz
loop, cumulative-offset ledger, deterministic scoring, a 30-clue bank, seeded
challenge links, a no-API-key simulator, 47 passing assertions, two passing
constraint checkers, a headless three-clue run.

**None of it is in this repository.** At the start of this run
`/Users/coreyweathers/code/buzz-in` contained `GOAL.md` and `PRD.md` and
nothing else, and was not a git repository. A filesystem search under the
user's home directory found no other copy.

What this run did instead: reconstructed the build from the PRD's own spec
(§5.1, §5.2, §5.4, §5.5, §5.6) and said so everywhere it matters.

**What a human needs to decide:**

1. Does the real build exist somewhere this run couldn't see — another
   machine, an unpushed branch, a different account's GitHub? If yes, treat
   this run's code as a **parallel reconstruction to reconcile against it**,
   not a replacement, and do not force-push over it.
2. If it does not exist anywhere, then the cluster-page status "built,
   unblocked, ready for review" is wrong upstream and should be corrected,
   because two documents inherited it as fact.

**Until this is answered, treat "47 assertions pass" as an unverified
inherited claim, not as something this run confirmed.** It did not.

---

## F-02 · BLOCKER-ADJACENT · 2026-08-11 · Named skills do not exist in this environment

**Owner:** Corey Weathers

GOAL.md build-order steps 2 and 4 name three skills. Availability as of this
run:

| Skill named in GOAL.md | Present? | What this run did |
|---|---|---|
| `devrel-code-review` | ❌ not present | Used **`devrel-review`**, which is present and whose description covers exactly this ("review a PR, a diff, a doc change… SDKs, starter apps, dev tooling"). Recorded as D-02 in DECISIONS.md. |
| `deepgram-devrel-drafting` | ❌ not present | Referenced by `devrel-review`'s own description as the drafting counterpart, so it exists as a concept but is not installed here. Content in `/content` was drafted to match house voice as evidenced by the PRD itself. See D-03. |
| `skill-creator` | ❌ not present | Could not extend any skill. GOAL.md's "extend it with skill-creator and log why" branch was therefore unavailable — see D-04 for what would have been extended and why. |

**No skill was modified by this run**, because the tool to modify them was
not available. If skill extension was expected as a deliverable, it needs a
session where `skill-creator` is installed.

---

## F-03 · ROUTE → Product · 2026-08-11 · `/v2/speak` spec doc is stale and contradicts implemented behavior

*(PRD §8, forwarded as-is.)* Last edited Jul 28. Still documents
`Interrupt.speech_id` as a **client** field. Its Approvals property reads
"Pending (ajsyp)" with no approval from ajsyp anywhere in the record.

The doc or the docs guide is wrong **in public**, and it should not be the
docs guide. This build and the docs guide (content unit 3) both assume
`speech_id` did **not** survive as a client field.

**Not resolved here. Product's call.**

---

## F-04 · ROUTE → Product · 2026-08-11 · Did `speech_id` survive as a client field on `Interrupt`?

*(PRD §8, forwarded as-is.)* Genuinely unresolved. The Jul 30 thread clearly
restores `speech_id` as a **server-emitted diagnostic** but never explicitly
re-confirms or denies it as a **client input**.

The build and the docs guide currently assume it did **not** survive as a
client input. That assumption is isolated behind the interrupt-shape adapter
(`BUZZ_IN_INTERRUPT_SHAPE`), so flipping it is a one-implementation change,
not a refactor — see SDK_WATCH.md.

**Correct this if it's wrong — and do not let a reviewer add `speech_id`
back to the client message without checking first.**

---

## F-05 · ROUTE → Product · 2026-08-11 · `Warning` code casing for a missing offset

*(PRD §8, forwarded as-is.)* `playback_offset_missing` was proposed —
**lowercase**, where every other code in the spec is SCREAMING_CASE.

Unconfirmed. Content unit 3 (docs guide) leaves this marked rather than
guessing, per GOAL.md's instruction not to guess at the Warning code name.

**Product's call.**

---

## F-06 · ROUTE → whoever owns the parent launch page · 2026-08-11 · Voice-name reconciliation

*(PRD §8, forwarded as-is.)* The parent launch page recommends `meghan`,
`conor`, `wes` and lists `rufus`, `brittany`, `marcus` as avoid. The confirmed
EA Launch-12 cutlist is **entirely different names**, and `meghan`/`conor`/
`wes` do not appear in it at all.

This build uses cutlist-only names (`rufus`, `jack`, `cole`, `haley`) and
excludes `brittany`/`marcus`, enforced by an automated assertion and by
`check:copy`. That part is safe. **The parent page itself still needs
reconciling**, and the GA roster is larger than the EA twelve with 17 new
voice names still outstanding as of Aug 3.

Same discrepancy flagged in the BYOM PRD — **one fix serves both clusters.**

---

## F-07 · ROUTE → Product · 2026-08-11 · Playground overlap

*(PRD §8, forwarded as-is.)* Same open question as the BYOM cluster. Lower
risk here, since this demo is conversational rather than a second "try it"
link — but still not this PRD's call, and still open.

---

## F-08 · ROUTE → launch-wide · 2026-08-11 · Pause control unreliable in staging as of Aug 5

*(PRD §8, forwarded as-is.)* **Not a blocker for this build** — it uses no
pause control. Flagged because it is live and affects anyone else scripting
audio for launch. Not this cluster's problem to fix; it is this cluster's
problem to not let it go unmentioned.

---

## F-09 · ROUTE → whoever owns the migration guide · 2026-08-11 · Aura→Flux migration guide predates the Jul 23 speed-range narrowing

*(PRD §8, forwarded as-is.)* Same gate identified in the BYOM PRD. Explicitly
**out of scope** here (PRD §4). Do not fix per-cluster — **confirm it is
tracked once**, centrally.

---

## F-10 · ROUTE → Developer Journey Archetypes working notes · 2026-08-11 · "Agent operator" is an unvalidated archetype

*(PRD §7, and required explicitly by GOAL.md step 4.)* The agent-operator
llms.txt / examples-corpus entry drafted in `/content` addresses a **proposed
seventh archetype that is an open question**, not a settled one.

It is drafted so it exists to be evaluated, and is **not** to be treated as a
shipped commitment to that archetype. Flag it in the same open-question
thread as the BYOM PRD's agent-operator row.

---

## F-11 · HUMAN-ONLY · 2026-08-11 · Content [verify] items needing a live human answer

Left marked in `/content`, **not guessed**, per GOAL.md step 4:

| Item | Where | Who can answer |
|---|---|---|
| Pipecat issue link / number | unit 1 build post, Partner-dev piece | Human — needs the actual open issue URL |
| Current signup offer terms | unit 1 build post | Marketing / whoever owns the offer |
| `Warning` code name | unit 3 docs guide | Product (see F-05) |
| Whether `speech_id` is a client field | units 1 + 3 | Product (see F-04) |
| Final repo path | unit 1 `git clone` line | **RESOLVED** — `github.com/dg-coreylweathers/buzz-in`, updated in the draft |

---

## F-12 · HUMAN-ONLY · 2026-08-11 · Unit 2 (benchmark post) is gated on research sign-off

**Owner:** Tim or David — explicitly **not** Corey, and explicitly not this run.

Every figure in unit 2 remains `[verify]`. **This run filled in zero figures
and changed zero numbers.** Three judgment calls flagged on the page need a
reviewer, not an agent:

1. Does the headline survive the tail (p95)?
2. Should the long-turn finding get promoted to its own section?
3. Which voice set was actually measured?

If a figure lands weaker than hoped, **reframe the section rather than soften
the wording.** This being unfinished is expected and blocks nothing else.

---

## F-13 · NICE-TO-HAVE · 2026-08-11 · Real composed music for the LiveStream and shorts

**Owner:** whoever produces those assets.

All game audio is synthesized at runtime with the Web Audio API — oscillators,
noise bursts, envelopes. No external SFX pack, no sampled audio, and nothing
imitating any recognizable existing game-show jingle.

That is the right call for the **game**. It is **not** a music bed for the
**LiveStream or the shorts**. If genuinely composed music would improve those,
that is real human production work.

**This run has not shipped a synthesized placeholder as if it were final
music, and nothing here should be mistaken for one.**

---

## Human-verification checklist — NOTHING BELOW HAS BEEN CHECKED

> **An agent has no ears and no microphone.** Every line below requires a
> human with headphones and a real device. This run ran everything that is
> genuinely headless-checkable and stopped there. **"The smoke script ran
> clean" and "a human confirmed this sounds right" are different claims.**
> None of the boxes below are ticked, and none of them may be ticked by
> anything other than a person.

### A. Voice quality — needs headphones

- [ ] Each shipped voice (`rufus`, `jack`, `cole`, `haley`) sounds like a game-show host reading a clue, not a narrator reading a paragraph.
- [ ] No audible artifacting, clipping, or dropout at clue start.
- [ ] Leading silence before the first word is short enough that the clue doesn't feel late.
- [ ] No voice mispronounces a proper noun in the 30-clue bank badly enough to make a clue unanswerable.
- [ ] Turn length never approaches the five-minute degradation risk in real playback (constraint-checked statically; **confirm audibly**).

### B. Live-API audio timing — needs a real session against staging

- [ ] The buzzer fires at the moment the player hears the cut, not noticeably after it.
- [ ] The word strip's strike point matches where the host **audibly** stopped. This is the entire product; if it is off by a word, the demo is dishonest.
- [ ] The ~360ms onset→confirmation gap holds on a real connection (PRD §5.1 measured it; **reconfirm live**).
- [ ] Score does **not** inflate by ~one word — the exact failure mode onset-capture exists to prevent.
- [ ] On a deliberately bad connection, the score still does not overcount.
- [ ] No backwards-offset rejection from the server across a full three-clue run (the per-turn-counter bug from §5.1).

### C. Mobile Safari — needs a real iPhone, not a simulator

- [ ] Audio unlocks on first touch; nothing autoplays before it.
- [ ] The buzz gesture registers reliably on touch.
- [ ] Echo cancellation actually holds with the phone speaker live — this is why the buzz word never appears in clue text.
- [ ] Ringer/silent switch behavior is acceptable and not silently confusing.
- [ ] Backgrounding the tab mid-clue and returning does not corrupt the offset ledger.
- [ ] Layout holds at small widths without the word count losing its "largest thing on screen" role.

### D. Sound design — needs ears

- [ ] Buzzer reads as a buzz-in buzzer and is clearly distinct from the voice audio.
- [ ] Correct and wrong stings are unmistakably different at a glance-listen.
- [ ] The reversal tension cue telegraphs the gamble without drowning the clue.
- [ ] The riser reads as "about to run out" and resolves cleanly if a buzz interrupts it.
- [ ] The UI tick lands **with** the word-strike animation, not after it.
- [ ] Mute toggle actually silences everything, including a cue already in flight.
- [ ] Nothing in the mix is loud enough to be unpleasant on headphones.

---

## F-14 · BLOCKER (deploy only) · 2026-08-11 · Fly.io trial has ended — staging deploy could not run

**Owner:** Corey Weathers

`flyctl` is installed and **authenticated** as `corey.weathers@deepgram.com`,
so GOAL.md's "assume flyctl is authenticated" condition held. The deploy
failed one step later, on billing:

```
Error: failed to determine region: failed to get placements:
trial has ended, please add a credit card by visiting https://fly.io/trial
```

No app was created, so `fly secrets set` also failed (`Could not find App
"buzz-in-staging"`). **The staging key was never transmitted anywhere and is
not in git.**

Per GOAL.md step 5 this was **logged and skipped, not treated as a blocker**
for the rest of the run.

**To finish the deploy, once a payment method is on the Fly org:**

```
flyctl launch --no-deploy --copy-config --name buzz-in-staging --region iad --yes
flyctl secrets set DEEPGRAM_STAGING_API_KEY="$DEEPGRAM_STAGING_API_KEY" --app buzz-in-staging
flyctl deploy --app buzz-in-staging --ha=false
```

`fly.toml` and `Dockerfile` are committed and ready. `fly.toml` pins
`BUZZ_IN_ENV = "staging"`; production is unreachable without an explicit
`BUZZ_IN_ALLOW_PROD=1`, which is deliberately not set anywhere.

**Never hardcode the key** — the command above reads it from the environment,
which is how it was handled throughout this run.

---

## F-15 · BLOCKER · 2026-08-11 · Staging `/v2/speak` does not report the text split the product is built on

**Owner:** Product / whoever owns the `/v2/speak` contract.
**Discovered by probing staging live on 2026-08-11**, not inferred from a doc.
Reproduce with `node scripts/probe-interrupt-shape.mjs`.

### Finding 1 — `Interrupt` accepts NO fields

Every variant tried against `wss://api.staging.deepgram.com/v2/speak`:

| Client message | Staging response |
|---|---|
| `{"type":"Interrupt"}` | ✅ **accepted** → `SpeechInterrupted` |
| `{"type":"Interrupt","playback_offset_ms":800}` | ❌ `Error MESSAGE-0000` — could not be parsed |
| `{"type":"Interrupt","speech_id":"dg_sp_..."}` | ❌ `Error MESSAGE-0000` |
| `{"type":"Interrupt","speech_id":...,"playback_offset_ms":...}` | ❌ `Error MESSAGE-0000` |
| `{"type":"Interrupt","playback_offset":800}` | ❌ `Error MESSAGE-0000` |
| `{"type":"Interrupt","offset_ms":800}` | ❌ `Error MESSAGE-0000` |
| `{"type":"Clear"}` | ❌ `Error MESSAGE-0000` |

**The client cannot report a playback offset to staging at all today.** This
also answers F-04 in the negative *for the client direction*, empirically:
`speech_id` is not accepted as a client field — it is rejected outright.

### Finding 2 — `SpeechInterrupted` carries no text split

Full payload as returned:

```json
{
  "type": "SpeechInterrupted",
  "audio_played_ms": 960,
  "metadata": {
    "speech_id": "dg_sp_26cfaa5ec5af",
    "audio_duration_ms": 960,
    "input_character_count": 103,
    "billable_character_count": 103,
    "controls_applied": { "pronunciations_applied": 0, "breaks_applied": 0, "pronunciation_warnings": 0 }
  }
}
```

**There is no `text_spoken` and no `text_remaining`.**

### Why this is a blocker, not a detail

PRD §1 and §2 define the product as: *the score is the exact number of words
the host never got to say*, taken from `text_remaining` on the interruption
report, and the entire "you cannot build this on a competitor's API" claim
rests on the server reporting that split rather than the client reconstructing
it.

**Against staging as it exists today, that is not implementable.** The
server-side split does not come back.

### Finding 3 — `audio_played_ms` is generated audio, not heard audio

In the end-to-end run (`node scripts/e2e-live.mjs`), staging reported
`audio_played_ms: 1040` while the output path had actually rendered **960ms**.
The client never told the server a playback position (Finding 1 makes that
impossible), so this figure cannot reflect what the listener heard — and the
80ms gap runs in the **overcount** direction, which is precisely the error
PRD §5.1 says a non-device measurement produces.

**Do not let this field be documented or used as "what the caller heard."**

### What this run did about it

- Added a third adapter implementation, `staging`, recording the live-observed
  shape exactly. `canScoreInterruption(staging)` returns **false**, so the
  game **refuses to claim a server-authoritative score** against it. The
  predicate from PRD §5.2 caught this without being modified.
- Kept `ga` as the default so nothing about the documented shape changed on
  the strength of one probe.
- **Did not fabricate a text split**, and did not silently fall back to a
  client-side reconstruction presented as the server's number.

### Questions for Product

1. Is the text split shipping on `/v2/speak` before GA+2 (Aug 19)? The build
   post, the docs guide, and the game's scoring all depend on it.
2. If it is behind a flag or a query parameter, which one? Nothing in
   `/v2/models` or the connect response advertises it.
3. If it is **not** shipping, unit 1 and unit 3 need reframing, not editing —
   and the cluster's central claim needs re-examining before publish.
