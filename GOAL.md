# GOAL: Buzz-In Quiz — verify, finish, and ship, unattended

> **Note for /goal evaluation:** After completing each numbered build-order
> step below, print the current contents of STATUS.md into the chat before
> continuing. The completion check can only see what you've surfaced in
> conversation, not your files directly — if you do real work but don't
> narrate it into the chat, the goal will look unmet even though the work
> is done.

Read PRD.md in this repo's root in full before doing anything else. It is
the spec. This is DIFFERENT FROM A GREENFIELD BUILD — a working, tested
repo already exists (47 assertions passing, both constraint checkers
passing, a headless three-clue run). Your job is closing what's
unverified, finishing the content, and shipping — not building from zero.
Don't rewrite what's already correct; PRD Section 5.1 lists the three
hard-won decisions (onset-capture, monotonic offset, device-measured
playback) that are NOT open for revisiting.

You will not have anyone available to answer questions mid-task —
resolve ambiguity yourself using the rules below, and keep a written
record of every call you made.

Before doing anything else, create DECISIONS.md, STATUS.md, FLAGS.md,
and SDK_WATCH.md in the repo root. Update all four continuously.

## THE ONE THING YOU CANNOT DO — READ THIS BEFORE YOU START

You have no ears and no microphone. Voice quality, real audio timing
against the live staging API, and mobile Safari touch/audio behavior all
require a human with headphones and a real device. Do not simulate,
infer, or claim a pass on any of these. Run everything that genuinely is
headless-checkable — the existing assertion suite, both constraint
checkers, scripts/smoke.js with a scripted buzz — against staging, and
write an explicit, itemized human-verification checklist into FLAGS.md
for the rest. "The smoke script ran clean" and "a human confirmed this
sounds right" are different claims — never let STATUS.md blur them into
one.

## ENVIRONMENT

Every API call — tests, verification, deploy — targets Deepgram STAGING.
Never production. If staging credentials aren't already available in
this environment, log it in FLAGS.md and halt only that piece of work.
Production cutover is a separate, deliberate step outside this run.

## SDK USAGE — THIS REPO ALREADY DOES THIS RIGHT, EXTEND IT

The Interrupt/SpeechInterrupted message shape is already isolated behind
a two-method adapter (build message, parse report) with swappable GA and
EA implementations selected by BUZZ_IN_INTERRUPT_SHAPE. Don't rebuild
this — document it. Add SDK_WATCH.md entries covering: what this adapter
does that the official SDK might eventually cover natively, and what to
check in the SDK's release notes before removing any hand-rolled piece.
Before assuming a gap still exists, check the current SDK version.

## VISUAL DIRECTION

This cluster already has a specific, correct design intent: studio
equipment running a game show — dark, matte, instrument-grade chassis,
broadcast typography with the word count as the largest thing on screen,
no framework, no utility classes, a 16px-multiple spacing scale. The
clue renders as a strip of words: spoken words lit, unreached words dim
and struck through, a hard rule where the cut landed.

Bring in talk.deepgram.com's token language ONLY where it's compatible —
dark background treatment, ambient glow, one sparing accent color,
generous negative space. Do NOT import their glassy voice-orb motif; it
fights this product's "instrument" read. Where the two directions
conflict, this cluster's own design intent wins.

## SOUND DESIGN — LEAN INTO THIS, DON'T TREAT IT AS OPTIONAL

This is a buzz-in quiz. It should sound like one. Build, at minimum:
a buzzer sound at confirmed interrupt, a correct-answer sting, a
wrong-answer sting, a tension cue under reversal clues, a rising riser
for a clue about to run out with no buzz, and a satisfying UI tick timed
to the word-strike animation.

Generate all of this with the Web Audio API — oscillators, noise bursts,
simple envelopes. Do not source an external SFX/music library, and do
not imitate any recognizable existing game-show jingle (Jeopardy, etc.) —
that's someone else's IP. If real composed music would meaningfully
improve the LiveStream or shorts, that's human production work — flag it
in FLAGS.md as a nice-to-have, don't ship a synthesized placeholder and
call it final music. Add a mute toggle. Nothing autoplays without a
player action.

## DECISION RULES

- Where the PRD states its own recommendation, treat it as decided.
- Where a default only breaks under a condition you can't verify yet,
  implement the default and log exactly what would need to change, and
  why, in DECISIONS.md.
- Where something depends on a live human call (voice roster
  reconciliation, exact spoken-copy wording), use the PRD's stated
  current-best-known values and flag the dependency in FLAGS.md rather
  than guessing at what hasn't been confirmed yet.
- Everything in PRD Section 8 ("flag, don't resolve") — the stale spec
  doc, the speech_id-as-client-field question, the Warning code casing,
  voice-name reconciliation, the Playground overlap, the migration guide
  gate — gets a dated FLAGS.md entry with enough context to forward
  as-is. Not yours to resolve. Don't let the length of this list make
  any one item feel less urgent than it is.

## BUILD ORDER

1. Run the full existing test suite and both constraint checkers
   (check:copy, check:clues) against staging. Confirm all 47 assertions
   and the headless three-clue run still pass before touching anything
   else. If anything fails, fix only what's needed to restore the
   existing, already-decided behavior — don't "improve" passing tests.

2. Code review pass: run the devrel-code-review skill against the repo.
   Fix what it flags. If it's missing a check this codebase's shape
   clearly needs (e.g. something specific to the offset-ledger pattern),
   extend it with skill-creator and log why in DECISIONS.md. Don't touch
   the skill for a one-off finding.

3. Add sound (per the Sound Design section above) and confirm the visual
   surface follows the direction above — this is UI/asset work, verify
   it with the headless test suite plus a visual/structural review, not
   by listening.

4. Content, fully drafted, not outlined, saved under /content:
   - Finalize units 1 and 3 (build post, docs guide) to publish-ready.
     Close every [verify] item resolvable from the repo/spec itself.
     Items needing a live human answer (Pipecat issue link, final repo
     path, signup terms, the Warning code name) — log in FLAGS.md,
     don't guess.
   - Unit 2 (the benchmark post) is gated on research sign-off (Tim or
     David), not you. Do not fill in any figure. Leave every [verify]
     exactly as marked. Don't let this block anything else — proceed
     with the rest of the cluster regardless of its state.
   - Draft the new persona pieces from PRD Section 7: the Scaler
     ops-angle piece, the Partner-dev Pipecat-specific piece, and the
     Champion teardown (mostly extraction from the PRD/cluster page's
     own "three iterations" narrative — don't rewrite it from scratch).
     Draft the agent-operator llms.txt/examples-corpus entry too, and
     flag its unvalidated-archetype status in FLAGS.md.
   - Use the deepgram-devrel-drafting skill throughout so house voice,
     SEO frontmatter, and image briefs match the existing units. Extend
     it with skill-creator if it's missing coverage for a format here,
     and log why.

5. Deploy to Fly.io, staging config. Assume flyctl is authenticated;
   if not, log in FLAGS.md and skip rather than block. Set the Deepgram
   key via `fly secrets set` from an existing env var — never hardcode
   or commit it; if unset, log and skip the deploy. Record the live URL
   in STATUS.md.

6. Push to GitHub at github.com/dg-coreylweathers/buzz-in. No repo
   exists under deepgram-devs for this project — this is resolved, don't
   search for one or treat it as open. If dg-coreylweathers/buzz-in
   doesn't exist yet, create it. If a repo by that name already exists
   there from prior work, confirm it's the same project (check for the
   existing buzz loop / offset ledger / clue bank) before pushing into
   it rather than assuming and overwriting. Public unless DECISIONS.md
   logs a reason otherwise. Update the `git clone` line in the build
   post (unit 1) to match this path. Assume gh CLI is authenticated; if
   not, log in FLAGS.md and skip. Commit at the end of each numbered
   step with a clear message.

## HARD CONSTRAINTS — never a judgment call

- No vendor name, logo, or competitor reference anywhere.
- No spoken line contains the plural of "interruption," a score in units
  of time, product/API terminology, a banned voice name, or a turn long
  enough to risk the five-minute degradation. The buzz word never
  appears inside clue text.
- No on-screen instrumentation: no millisecond readout, no field names,
  no product name in the interface.
- The playback offset is held at speech onset, never read at keyword
  confirmation. Never revisit this.
- The API key never leaves the server, never lands in git history.
- Every call this build makes targets staging, never production.

## WHEN TO STOP

Only when a hard constraint is structurally impossible to satisfy, or
the PRD contradicts itself in a way no default resolves. Stop only that
piece of work, log why in STATUS.md, keep going on everything else.
Never end the whole run over one blocked item — and never end it early
just because unit 2 is stuck waiting on a human reviewer; that's
expected, not a failure.

## END STATE

STATUS.md reads as a full handoff: what shipped, what's live (staging
deploy URL, repo URL), the human-verification checklist for everything
requiring ears/a device/mobile Safari, what's a placeholder, what's in
FLAGS.md, what's in SDK_WATCH.md, which skills you modified and why, and
what — if anything — is still blocked.
