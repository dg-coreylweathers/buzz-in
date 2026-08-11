# Review: buzz-in working tree (2026-08-11 unattended run)

Classification: **code review** (local mode, full tree — no PR exists yet)
Verdict: **approve-with-nits** — two defects found and fixed in-run; one nit
left standing and logged. All three checkers plus 113 assertions pass after
the fixes.

Reviewed: `src/`, `public/`, `scripts/`, `server.js`, `test/`.
Intent (from PRD §5): preserve onset-capture, monotonic offset, and
device-measured playback exactly; keep the key server-side; keep every call on
staging.

---

## Blocking

### [B1] `server.js:112` — a "key guard" that guarded nothing

**Summary.** A block commented as a last-line guard against leaking the API
key did nothing at all, and read as protection that existed.

**Description.** The block read `const originalEnd =
server.constructor.prototype.emit; void originalEnd;` under a comment
promising it would "fail loudly" if the key ever appeared in a response body.
It assigned a function reference to a variable and discarded it. No response
was inspected, nothing could ever fail loudly. The danger is not the dead code
itself — it is that a future reader trusts the comment, assumes responses are
screened, and stops checking by hand. On the one constraint where a mistake is
unrecoverable (a leaked key lands in logs and git history), a placebo guard is
worse than no guard, because it buys false confidence.

**Expected.** Either a guard that actually inspects outbound payloads, or no
guard and no claim of one.

**Observed.** A no-op block advertising protection that did not exist.

**Recommended fix (applied).** Removed the block and the now-unused
`resolveApiKey` import. The real protection is structural and still holds: the
key is never placed in any payload, `/api/health` reports only a boolean
`speechConfigured`, and no route echoes environment values.

---

## Should-fix

### [S1] `public/app.js:112` — the word pacer credited audio for a word that never played

**Summary.** At the end of an unbuzzed clue, the ledger was advanced one extra
word past the end of the clue.

**Description.** The clue stepper called `lightNextWord()` and then
`playback.advanceWords(1)` unconditionally. On the final tick `lightNextWord()`
returns `false` — there is no word left to light — but `advanceWords(1)` still
ran before the early return, recording ~400ms of rendered audio that the
device never produced. In the current build this lands only on the unbuzzed
path, where it cannot change a score (an unbuzzed clue scores zero by
definition). It matters anyway for two reasons: the session ledger is
monotonic and shared across clues, so a phantom advance carries into the next
turn's offset; and it is an **overcount**, the precise failure direction PRD
§5.1 says a wall clock produces and this design exists to avoid. Shipping a
demo whose own ledger overcounts, in a post arguing that everyone else's
overcounts, is the kind of detail a reader checks.

**Expected.** The ledger advances only for audio the device actually rendered.

**Observed.** One extra word of audio credited per unbuzzed clue.

**Recommended fix (applied).** Return before advancing:

```js
const advanced = lightNextWord();
if (!advanced) return endClueUnbuzzed();
playback.advanceWords(1);
```

---

## Nits

### [N1] `test/run.js` — assertion labels are hand-numbered and no longer match the count

**Summary.** Labels run to "104" while 113 assertions execute, because the
per-line loop over `SPOKEN_COPY` reuses the label "60".

**Description.** Cosmetic only; every assertion runs and reports correctly, and
a failure still prints its own descriptive text. Left as-is deliberately —
renumbering by hand invites the same drift again, and the real fix is a small
harness that numbers automatically, which is more churn than this earns today.

**Expected.** Label numbers match execution order.
**Observed.** Numbering repeats and stops short of the total.
**Recommended fix.** If it ever matters, drop the hand-numbers and let the
harness index them.

---

## Verified (evidence)

| Claim | Result | Evidence |
|---|---|---|
| Offset captured at onset, never re-read at confirmation | **PASS** | assertions 2–5; `check:offset` guard 2 greps the confirmation path for `currentOffsetMs` |
| Offset monotonic across turn boundaries | **PASS** | assertions 10–14, 95; strictly-increasing invariant fixed during step 1 |
| Offset measured at the device, no wall clock | **PASS** | `check:offset` guard 1 greps `Date.now`/`performance.now`/`new Date` out of all three offset-path files |
| One ledger per session, not per clue | **PASS** | `check:offset` guard 4 counts `new OffsetLedger(` in `src/session.js` — exactly 1 |
| GA shape omits `speech_id` from the client message | **PASS** | assertion 24; smoke run asserts it per clue |
| Adapter is genuinely swappable | **PASS** | assertions 19–27; both shapes construct and parse |
| `canScoreInterruption` is a real predicate, not decoration | **PASS** | assertion 35 — false for a shape that reports no remainder; `GameSession` refuses to start on it (assertion 99) |
| Key never reaches the browser | **PASS** | no route returns it; `/api/health` returns a boolean only; `.gitignore` covers `.env*`; `git log -p` grep for the key value finds nothing |
| Every call targets staging | **PASS** | assertions 100–104; production throws without an explicit override |
| Static file serving is not traversable | **PASS** | `normalize` + allowlisted directory + `startsWith` containment check |
| No vendor name anywhere player-visible | **PASS** | `check:copy` over spoken lines, on-screen text, and `alt`/`aria-label`/`title` attributes |

## Needs human

- **The offset-ledger check does not exist in the review skill**, only in this
  repo's CI (`scripts/check-offset.js`). `skill-creator` is not installed, so
  it could not be added where it would serve other clusters. Decision for
  Corey: port it into the skill in a session where that tool exists.
  See DECISIONS.md D-04 and FLAGS.md F-02.
- **Everything in FLAGS.md §"Human-verification checklist"** is outside what
  any review can settle — it needs ears and a device.

## Developer-facing messaging

The repo is intended to be read as much as run (PRD §7's Champion and
agent-operator rows). Two things carry that weight and should survive any
future cleanup: the comment blocks in `src/offsetLedger.js` naming *why* each
of the three properties exists, and `src/interruptShape.js` making the adapter
boundary obvious. Both are the artifact the persona content points at. Do not
let a tidy-up strip them to bare code.
