# STATUS — Buzz-In Quiz

**Run date:** 2026-08-11 · **Mode:** unattended agent run against GOAL.md
**Environment for every API call:** Deepgram **STAGING** (`DEEPGRAM_STAGING_API_KEY`). Production never contacted.

---

## ⚠️ READ THIS FIRST — the run's central premise did not hold

GOAL.md and PRD.md §2 both state that a working, tested build already exists
("47 assertions pass, both constraint checkers pass, a full three-clue run
completes headless") and that this run's job is to *verify and finish*, not to
build from zero.

**That code does not exist in this repository or anywhere on this machine.**
At run start the directory contained exactly two files — `GOAL.md` and
`PRD.md` — and was not a git repository. A filesystem search found no other
copy.

- **I did not verify the pre-existing 47 assertions. I could not. There was
  nothing to run.** The 113 assertions reported below are from a suite *this
  run wrote*, from the PRD spec. **These are different claims and this file
  will not merge them.**
- Build-order step 1 as written ("confirm all 47 assertions still pass before
  touching anything else") was impossible. Per GOAL.md's "WHEN TO STOP" rule
  it was logged and the run continued.
- PRD §5.1's three decisions (onset-capture, monotonic offset,
  device-measured playback) were **implemented to spec**, not preserved from
  prior code. They are honored exactly and covered by assertions — but they
  are new implementations of a stated decision, not untouched inherited code.

See FLAGS.md **F-01**. If the original build exists elsewhere, treat this
run's code as a **parallel reconstruction to reconcile against it, not a
replacement — do not force-push over it.**

---

## Build-order progress

| # | Step | State |
|---|------|-------|
| 0 | Tracking docs stood up | ✅ done |
| 1 | Test suite + both constraint checkers, against staging | ✅ **done** — 113 assertions + 4 checkers + headless three-clue run, all pass |
| 2 | Code-review pass | ✅ **done** — `devrel-review` skill; 2 defects found and fixed; `REVIEW.md` |
| 3 | Sound + visual surface | ✅ **done** — 6 synthesized cues, mute, no autoplay; `check:surface` 27 structural checks |
| 4 | Content under `/content` | ✅ **done** — 7 pieces; unit 2 deliberately untouched (F-12) |
| 5 | Fly.io staging deploy | ✅ **done** — live at https://buzz-in-staging.fly.dev (F-14 resolved) |
| 6 | Push to github.com/dg-coreylweathers/buzz-in | ✅ **done** — repo created public, pushed |

## What's live

| Thing | URL | State |
|---|---|---|
| Repo | **https://github.com/dg-coreylweathers/buzz-in** | ✅ live, public (DECISIONS.md D-09) |
| Staging deploy | **https://buzz-in-staging.fly.dev** | ✅ live, app `buzz-in-staging`, org `deepgram` |

### Deploy verification, 2026-08-11

| Check | Result |
|---|---|
| `/api/health` | ✅ `environment: staging`, key configured, roster `rufus, jack, cole, haley` |
| Static assets | ✅ all 200 |
| `wss://.../speak` | ✅ real voice audio (`haley`, model `2026-08-07.0`), 99838 bytes, `SpeechInterrupted` returned |
| `wss://.../listen` | ✅ `MicReady` — staging listening session opens |
| Key leak scan on the deployed app | ✅ absent from every served response |
| HTTPS | ✅ enforced, http 301s to https |
| Production | ✅ never contacted; `BUZZ_IN_ENV` pinned to staging in `fly.toml` |

**The key was set via `fly secrets set` from the environment variable.** It is
not in `fly.toml`, not in the image, and not in git.

## Headless verification — what actually passed, 2026-08-11

Run with `npm run verify`. All against staging config; production unreachable.

| Check | Result |
|---|---|
| Assertion suite (`npm test`) | ✅ **113 passed, 0 failed** |
| `check:copy` | ✅ PASS — 10 spoken lines + all on-screen copy clean; voices `rufus, jack, cole, haley`; `brittany`/`marcus` excluded; no instrumentation on screen |
| `check:clues` | ✅ PASS — 30 clues (10 reversal); no vendor reference, no product terminology, no banned voice name, no plural of "interruption", no score in time units, buzz word in none |
| `check:offset` (new — see D-04) | ✅ PASS — captured at onset and held, session-scoped, monotonic, no wall clock in the path |
| `check:surface` (new) | ✅ PASS — 27 structural checks on the visual and sound surface |
| Headless three-clue run (`scripts/smoke.js --buzz-at`) | ✅ PASS — offset strictly increasing across all three turns |
| Staging reachability + auth | ✅ HTTP 200 from `api.staging.deepgram.com` |
| Production | ✅ never contacted — `src/config.js` throws without `BUZZ_IN_ALLOW_PROD=1` |
| Key in git history | ✅ zero occurrences |

**On 113 vs 47:** not the inherited suite growing — a **different suite**. See
the warning above.

### Two real defects found and fixed

1. **Ledger accepted a non-advancing offset** (equal to the previous buzz), not
   just a decreasing one. Two buzzes at an identical offset means no audio
   rendered between them — same class as the backwards-offset bug in PRD §5.1.
   Invariant is now strictly-increasing; assertion 12 covers it.
2. **The word pacer credited the ledger for a word that never played** at the
   end of an unbuzzed clue — an **overcount**, the exact error direction this
   product exists to point at. `REVIEW.md` [S1].

Also removed: a no-op "key guard" in `server.js` that advertised protection it
did not provide (`REVIEW.md` [B1]).

## What shipped

**Build** — buzz loop, session-scoped monotonic offset ledger, deterministic
scoring, 30-clue bank (10 reversal), seeded challenge links, no-key simulator,
two-method interrupt-shape adapter (GA + EA, `BUZZ_IN_INTERRUPT_SHAPE`),
`canScoreInterruption` predicate, server holding the key.

**Sound** (all Web Audio synthesis, no sourced assets, DECISIONS.md D-10) —
buzzer at confirmed interrupt, correct sting, wrong sting, reversal tension
bed, riser for a clue running out, UI tick on the word-strike. Mute persists
and kills in-flight cues. **Nothing autoplays** — the AudioContext is created
only inside `unlock()`, on a player gesture.

**Visual** — dark matte instrument chassis, broadcast typography, count
dominant (96px floor vs 22px next largest), word strip with lit/struck words
and a hard rule at the cut, 16px-multiple spacing scale, no framework, no
utility classes, one accent used sparingly, ambient glow. No glassy orb motif.

**Content** (`/content`) — 7 pieces:

| File | State |
|---|---|
| `unit-1-build-post.md` | Publish-ready; `git clone` line points at the resolved repo path; 3 `[verify]`s left that need a human (F-11) |
| `unit-2-benchmark-post.md` | ⛔ **untouched by design** — every figure still `[verify]`, gated on Tim/David (F-12) |
| `unit-3-docs-guide.md` | Drafted; **full spec pass required before publish**; `Warning` code name left unresolved (F-05) |
| `persona-scaler-ops.md` | Drafted |
| `persona-partner-dev-pipecat.md` | Drafted; blocked on the Pipecat issue link (F-11) |
| `persona-champion-teardown.md` | Drafted — packaging of the cluster's own "three iterations" narrative |
| `agent-operator-llms-entry.md` | Drafted; **flagged as an unvalidated archetype** (F-10) |

## Placeholders and things deliberately NOT done

- **Unit 2's figures.** Zero filled in. Zero numbers changed. Gated on a human
  reviewer — expected, not a failure.
- **All game audio is synthesized.** That is correct for the game and is **not**
  a music bed for the LiveStream or shorts. No synthesized placeholder is
  presented as final music (F-13).
- **No SDK version was verified.** The adapter is retained on the PRD's stated
  behavior. First action for the next person: fill in SDK_WATCH.md's version
  row.
- **No skill was modified** — `skill-creator` is not installed (F-02, D-04).

## Human-verification checklist — NOTHING IN IT HAS BEEN CHECKED

FLAGS.md § "Human-verification checklist" — 4 sections, 24 items, covering
voice quality, live-API audio timing, mobile Safari, and sound design. Every
one needs a person with headphones and a real device.

**"The smoke script ran clean" and "a human confirmed this sounds right" are
different claims.** This run only ever made the first.

## What's in FLAGS.md

14 entries. F-01 (prior build missing) and F-14 (Fly billing) are this run's
own blockers; F-02 is the missing skills; **F-03 through F-10 are PRD §8's
route-don't-resolve items, each forwarded as-is with its owner** — stale
`/v2/speak` doc, `speech_id`-as-client-field, `Warning` code casing,
voice-name reconciliation, Playground overlap, staging pause control, the
Aura→Flux migration guide gate, and the unvalidated agent-operator archetype.
**None was resolved by this run.** F-11 through F-13 are human-only items.

## What's in SDK_WATCH.md

4 entries on the hand-rolled interrupt adapter: `Interrupt` message
construction, `SpeechInterrupted` report parsing, the `canScoreInterruption`
predicate (keep it even after the SDK closes the gap), and device-measured
playback (**do not** swap in a wall-clock SDK helper to delete code). Each
states what to check in the SDK's release notes before removing anything.

## Skills modified

**None.** `skill-creator` is not installed (F-02). D-04 records the
offset-ledger check that *would* have been added to the review skill, and it
ships as `scripts/check-offset.js` in CI instead.

## Still blocked

1. **Unit 2** — research sign-off (F-12). Expected.
2. **Unit 1 / Partner-dev piece** — Pipecat issue link (F-11).
3. **Unit 3** — spec pass + `Warning` code name (F-03, F-05).
4. **Reconciling this build against the original, if one exists** (F-01) —
   the most important item on this list.
