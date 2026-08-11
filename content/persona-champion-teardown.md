---
title: "Three iterations: a build teardown you can fork"
slug: three-iterations-teardown
type: blog
persona: Champion
status: draft, ready for review
word_target: 1100
keyword_lane: "recipe to build on top of"
seo_title: "Three iterations: a buzz-in game build teardown"
seo_description: "The three decisions that turned a barge-in demo into a game, scoring the risk, a plain word count, and holding the offset at onset. Packaged as something to fork."
author: Corey Weathers
image_brief: >
  Three identical instrument panels side by side, left to right, each slightly
  more complete than the last, the first bare, the last fully lit with a word
  strip. Reads as an iteration sequence. Amber key light, matte, no logos.
---

# Three iterations: a build teardown you can fork

This is the teardown version of the buzz-in quiz, what the three iterations
actually were, why each one changed, and what's worth taking.

It exists as a written artifact on purpose. The live rebuild is a good format
and it's an event; this is the part you can find afterwards and fork.

## What the thing is

A trivia game where your score is the number of words the host never got to
say. Buzz in early on a long clue and get it right, you score most of the
clue. Let the host finish, you score nothing.

The number comes from the speech service reporting what it did and didn't say
when it was cut off. The game is a way of putting that measurement somewhere a
player can check it.

## Iteration 1, score the risk, not the API shape

**What I built first:** points for how early you buzzed. A timing measure
straight off the mechanism.

**Why it changed:** it rewarded mashing the button. Buzz on the first syllable
of everything and you win, regardless of whether you knew the answer. The
score described the API's capability rather than anything about the game.

**What replaced it:** score what the host didn't get to say. Nearly the same
data, completely different game, word count is a property of the *sentence*
so a long clue is worth more than a short one and buzzing early on a clue you
don't understand becomes a genuine gamble.

**The transferable bit:** when a demo scores the thing your API measures, you
get a demo about your API. Score the thing the *player* is risking, and the
API becomes how it works rather than what it's about. The reversal clues 
statements that flip in the last few words, only became possible after this
change, because they need early buzzing to be dangerous.

## Iteration 2, a word count, not a formula

**What I built:** weighted scoring. Clue difficulty, position in the clue, a
scaling factor.

**Why it changed:** nobody could tell whether it was working. Including me.
When you can't predict the number before it appears, you can't distinguish a
correct implementation from a broken one, and neither can a skeptical reader.

**What replaced it:** a plain count of words. The strip on screen shows every
word struck through; you can count them yourself and check the score by hand.

**The transferable bit:** if your demo's claim is accuracy, the output has to
be verifiable by hand. Every transformation you apply between the measurement
and the display is a place an error can hide, and a place a reader has to take
your word for it. This is also why the count is the largest thing on screen
and there's no other instrumentation anywhere in the interface, one number
checkable.

## Iteration 3, hold at onset, not at confirmation

**What I built:** detect speech, wait for the transcript to confirm a real
interruption, read the playback position, send it.

**Why it changed:** every score was about a word too high. Audio keeps playing
during the gap between someone starting to speak and your transcript being
confident it wasn't a cough, around 360ms in my build, roughly one word at
normal speaking pace. Reading the position at the far end of that gap includes
audio the player was already talking over.

**What replaced it:** capture the playback position at speech onset, hold it
and use it only if the transcript later confirms. If it was a cough, throw the
held value away.

**The transferable bit:** onset is the honest moment, it's when the listener
stopped listening. Everything after it is your system catching up, and none of
it belongs in the number you report. This is the one decision the whole thing
rests on, and it's the one that's least obvious from the outside, because the
wrong version works fine and is just consistently wrong.

### Two things that fell out of iteration 3

**One counter for the session, not one per turn.** I had a per-turn timer. It
produced the best bug of the build: every clue after the first buzzed
instantly and scored a perfect run. The per-turn timer reset at the turn
boundary while the session counter had moved on, so the offset went backwards
and was rejected. The tell was that the test runs were *too good*, a failure
that hides for a long time, because nobody investigates winning.

**Measure at the device, not with a clock.** Count the samples the output
actually rendered. A clock counts buffered-but-unplayed audio and keeps
running through silent underruns, both of which overcount, tens of
milliseconds on a good connection, hundreds on a bad one, always in the
direction of telling the player they heard more than they did.

## What's actually worth forking

**The offset ledger.** One object, session-scoped, three properties: capture
at onset and hold, never decrease, count rendered samples. Roughly a hundred
lines including the comments explaining why, and the comments are the point.

**The message-shape adapter.** The interruption message format changed
mid-build. Rather than rewriting the game logic, the shape sits behind two
methods, build the message, parse the report, with two implementations
selected by an environment variable. Twenty minutes of work; paid for itself
twice.

**The `canScoreInterruption` predicate.** A function that asks whether a given
message shape can actually report what went unsaid. It's a testable claim
rather than a sentence in a README, and the build refuses to start a round if
the answer is no. Cheap pattern, worth reusing anywhere you've hand-rolled
around a gap.

**The constraint checkers.** The copy rules and clue rules run in CI rather
than living in a style doc. Anything that is genuinely never a judgment call
is better as a failing build than as a guideline.

## Fork it

```
git clone https://github.com/dg-coreylweathers/buzz-in
cd buzz-in
npm install
npm start                            # simulator mode, no key needed
npm run verify                       # the suite and all constraint checkers

export DEEPGRAM_STAGING_API_KEY=...  # then restart for a real voice host
node scripts/e2e-live.mjs            # the live path, headless
```

The key is read by the server and never sent to the browser. Client code is
readable by anyone, so that boundary is the one thing in here worth copying
verbatim.

The scoring path the browser runs is the same module the test suite exercises
,  only the transport differs. If you change the ledger and the offset stops
being monotonic, the suite tells you before a player does.

---

<!-- Persona: Champion. This is PACKAGING of the cluster's own "three
     iterations" narrative into a durable, forkable artifact, not fresh
     writing, and deliberately not a rewrite. The LiveStream covers the same
     ground as an event; this is what remains findable afterwards. -->
