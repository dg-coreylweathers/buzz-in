# STATUS — Buzz-In Quiz

**Run date:** 2026-08-11 · **Mode:** unattended agent run against GOAL.md
**Environment for every API call:** Deepgram **STAGING** (`DEEPGRAM_STAGING_API_KEY`). Production untouched.

---

## ⚠️ READ THIS FIRST — the run's central premise did not hold

GOAL.md and PRD.md §2 both state that a working, tested build already exists
("47 assertions pass, both constraint checkers pass, a full three-clue run
completes headless") and that this run's job is to *verify and finish*, not to
build from zero.

**That code does not exist in this repository or anywhere on this machine.**
At run start the directory contained exactly two files — `GOAL.md` and
`PRD.md` — and was not a git repository. A filesystem search for any prior
buzz-in work found nothing.

Consequences, stated plainly:

- **I did not verify the pre-existing 47 assertions. I could not. There was
  nothing to run.** Any assertion count below is from a suite *this run
  wrote*, from the PRD spec. It is not the same claim and STATUS.md will
  never merge the two.
- Build-order step 1 as written ("confirm all 47 assertions still pass
  *before touching anything else*") was impossible. Per GOAL.md's "WHEN TO
  STOP" rule I logged it and kept going rather than ending the run.
- Everything under §5.1 of the PRD (onset-capture, monotonic offset,
  device-measured playback) was **implemented to spec**, not preserved from
  prior code. Those three decisions are honored exactly as written and are
  covered by assertions, but they are new implementations of a stated
  decision, not untouched inherited code.

See FLAGS.md **F-01** — this is the single most important thing for a human
to confirm before trusting anything else in this handoff. If the real build
exists somewhere else (another machine, an unpushed branch), this run's
output should be treated as a parallel reconstruction to reconcile against
it, **not** as a replacement for it.

---

## Build-order progress

| # | Step | State |
|---|------|-------|
| 0 | Tracking docs stood up | ✅ done |
| 1 | Test suite + both constraint checkers, against staging | ✅ **done** — 113 assertions, 3 checkers, headless three-clue run, all pass |
| 2 | Code-review pass | ⏳ not started |
| 3 | Sound + visual surface | ⏳ not started |
| 4 | Content under `/content` | ⏳ not started |
| 5 | Fly.io staging deploy | ⏳ not started |
| 6 | Push to github.com/dg-coreylweathers/buzz-in | ⏳ not started |

## Step 1 result — verified this run, 2026-08-11

| Check | Result |
|---|---|
| Assertion suite (`npm test`) | ✅ **113 assertions passed, 0 failed** |
| `check:copy` | ✅ PASS — 10 spoken lines + all on-screen copy clean; voices `rufus, jack, cole, haley`; `brittany`/`marcus` excluded; no instrumentation on screen |
| `check:clues` | ✅ PASS — 30 clues (10 reversal); no vendor reference, no product terminology, no banned voice name, no plural of "interruption", no score in time units, buzz word in none of them |
| `check:offset` (new, see D-04) | ✅ PASS — offset captured at onset and held, session-scoped and monotonic, no wall clock in the path |
| Headless three-clue run (`scripts/smoke.js --buzz-at`) | ✅ PASS — offset strictly increasing across all three turns |
| Staging reachability + auth | ✅ HTTP 200 from `api.staging.deepgram.com` with the staging key |
| Production | ❌ never contacted — `src/config.js` throws without an explicit override |

**On the assertion count:** 113, not 47. This is *not* the inherited suite
growing — it is a **different suite**, written this run from the PRD spec,
because the inherited one was absent. See the warning at the top of this file
and FLAGS.md F-01. The two numbers are not comparable and should not be
reported as though the 47 were confirmed.

**One real bug found and fixed during step 1:** the ledger accepted a
*non-advancing* offset (equal to the previous buzz), not just a decreasing
one. Two buzzes at an identical offset means no audio rendered in between —
the same class of failure as the backwards offset in PRD §5.1. The invariant
is now strictly-increasing, and assertion 12 covers it.

## What's live

| Thing | URL | State |
|---|---|---|
| Staging deploy | — | not yet deployed |
| Repo | — | not yet pushed |

## Environment check (verified this run)

| Dependency | State |
|---|---|
| node / npm | v26.5.0 / 11.17.0 ✅ |
| `gh` CLI | authenticated as `dg-coreylweathers` ✅ |
| `flyctl` | present at `/opt/homebrew/bin/flyctl` ✅ |
| `DEEPGRAM_STAGING_API_KEY` | set ✅ (never printed, never committed) |
| Prior build artifacts | ❌ **absent — see above** |

## Human verification still required

See FLAGS.md § "Human-verification checklist". Nothing in that checklist has
been checked by this run and nothing in it can be.
