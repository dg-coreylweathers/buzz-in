---
title: "What the server knows that your client doesn't"
slug: what-the-server-knows
type: blog
status: ready-for-review
word_target: 1750
keyword_lane: "why you want this server-side"
seo_title: "What the server knows that your client doesn't | Handling barge-in honestly"
seo_description: "When a caller talks over your voice agent, you need to know how much of the sentence they actually heard. Here's why the client can't tell you, and what to do instead."
author: Corey Weathers
image_brief: >
  Dark, matte instrument panel photographed straight on, shallow depth of
  field. A single row of words on a display, the left half lit and the right
  half dimmed with a thin red rule between them. No faces, no logos, no
  screenshots of any product UI. Warm amber key light from the upper left,
  everything else in shadow.
---

# What the server knows that your client doesn't

I built a trivia game where your score is the number of words the host never
got to say.

Buzz in on the first word of a forty-word clue and get it right, that's
thirty-nine points. Let the host finish, that's nothing — there were no words
left to take. The whole game is one number, and that number comes from a
single field on a single message.

I built it because I kept having the same argument about barge-in, and I
wanted a version of the argument you could play instead of read.

## The bug that started it

Here is the thing that goes wrong when someone talks over a voice agent.

The agent is halfway through a sentence. The caller cuts in. Now the agent has
to decide what happens next — and that decision depends entirely on a question
that sounds trivial and isn't: **how much of that sentence did the caller
actually hear?**

Get it right and the next turn is natural. The agent picks up from where it
was cut off, or drops the rest and moves on, and the conversation feels like a
conversation.

Get it wrong in one direction and the agent repeats itself: it thinks the
caller missed the last eight words, so it says them again, and now the caller
is listening to something they already heard. Get it wrong in the other
direction and the agent loses its place: it thinks it finished a sentence it
never got to, and everything after that is answering a question nobody asked.

Neither failure looks like a bug in a log. Both of them feel, to the person on
the phone, like talking to something that isn't listening.

## Why the client can't answer this

The obvious move is to answer it client-side. You know when you started
playing audio. You know when the caller interrupted. Subtract, divide by your
speaking rate, and you have a word count.

This is wrong, and it is wrong in a specific, predictable direction: **it
always overcounts.**

Three reasons, and they stack:

**Buffered audio isn't heard audio.** When you hand a chunk of audio to the
output device, it is not played yet. It is queued. On a good connection that
gap is small. On a bad one it is not. If you measure from when you *sent* the
audio, you are counting words that were still sitting in a buffer when the
caller started talking. They never reached anyone's ears.

**Underruns are silent, and silence isn't speech.** When the audio pipeline
starves — a slow link, a busy device, a dropped packet — the output goes
quiet. A wall clock keeps running through that silence. It has no idea the
words stopped. So your count includes time when nothing was spoken at all.

**The cut isn't where you think it is.** There is a real gap between the
moment someone starts speaking and the moment your transcript is confident
enough to call it a genuine interruption rather than a cough, a background
voice, or the caller saying "mm-hm." In my build that gap measures around
360ms — roughly one word at normal speaking pace. If you read your playback
position *after* that confirmation instead of at the onset, every single
measurement is one word too long.

Each of these pushes the same way. You tell the caller they heard more than
they did. And because the errors are all in one direction, they don't cancel
out — they compound.

## What the server already knows

The server generating the speech knows what it was asked to say and how far it
got. When you tell it to stop, it can report both halves directly: the text it
spoke, and the text it didn't.

That's it. That's the whole idea. `text_spoken` and `text_remaining`, on the
interruption report, from the side of the connection that actually knows.

You don't reconstruct anything. You don't estimate a speaking rate. You don't
maintain a model of where the audio pipeline thinks it is. You send one
message saying "the caller cut in, and here is how far into the audio they
were," and you get back an exact split.

The reason I turned this into a game is that it makes the claim testable
rather than rhetorical. In the game the number is not a diagnostic — it's the
score. It's the largest thing on the screen. If it were wrong by a word,
you'd hear it, because you were there when the host stopped talking and you
can see the strike land in the wrong place. A demo where inaccuracy is
invisible proves nothing. This one puts the measurement where it can be
checked by the person least inclined to give it the benefit of the doubt: a
player who just lost a point.

## Three things I got wrong first

The build took three iterations, and each one was a decision that looked
cosmetic and turned out to be load-bearing.

### Iteration one: score the risk, not the API shape

My first scoring rule was "points for how early you buzzed" — a raw timing
measure. It worked, and it was boring, because it rewarded mashing the button
on the first syllable of every clue.

The rule that made it a game was scoring what the host *didn't get to say*.
That sounds like the same thing. It isn't. Word count is a property of the
sentence, not of the clock — a long clue is worth more than a short one, so
buzzing early on a clue you don't understand is a real gamble rather than a
free win. The score stopped being a stopwatch reading and became a description
of what happened.

It also had a side effect I didn't plan: it made the reversal clues work. If a
clue can flip its meaning in the last five words, buzzing early is genuinely
dangerous, and the score being large is exactly what makes it tempting.

### Iteration two: a word count, not a formula

Second version, I got clever. Weighted the score by clue difficulty, by
position, by a scaling factor I no longer remember the reasoning for.

Nobody could tell whether it was working. When you can't predict the number
before it appears, you can't tell a correct implementation from a broken one —
and neither can your players. I threw it out and made the score a plain count
of words. Now anyone can verify it by looking at the strip on screen and
counting the struck-through words themselves.

If your demo's central claim is accuracy, the number has to be checkable by
hand. Any transformation you apply is somewhere for an error to hide.

### Iteration three: hold at onset, not at confirmation

This is the one that matters.

The naive flow is: detect speech, wait for the transcript to confirm it's a
real interruption, then read your playback position and send it. Every step of
that is reasonable. The result is wrong every time, by about a word, because
the audio kept playing during the confirmation gap.

The fix is to capture the playback position **at speech onset**, hold it, and
only *use* it if the transcript later confirms a genuine interruption. If it
turns out to be a cough, you throw the held value away and nothing else
changes.

Onset is the honest moment. It's when the caller stopped listening. Everything
after that is your system catching up, and none of it should end up in the
number you report.

Two smaller things fell out of that same rewrite:

**The offset is one counter for the whole session, not a timer per turn.** I
had a per-turn timer, and it produced a spectacular bug: every clue after the
first buzzed instantly and scored a perfect run. It looked like a generous
game. It was a broken harness — the per-turn timer reset at the turn boundary
while the session counter had moved on, so the offset went backwards and got
rejected. The tell was that my test runs were *too good*, which is the kind of
failure that survives a long time because nobody files a bug about winning.

**The offset is measured at the audio device, not by a clock.** Count the
samples the output actually rendered. Not what you enqueued, not elapsed time.
This is the fix for the buffering and underrun problems above, and it's the
difference between a number that degrades gracefully on a bad connection and
one that quietly lies harder the worse the network gets.

## The shape of the code

One thing worth stealing regardless of what you're building: I kept the
message shape out of the game logic.

The interruption message format changed during development — a field moved,
and the offset went from resettable to cumulative. Rather than rewriting the
scoring code, the whole shape sits behind two methods: build the message,
parse the report. Two implementations, selected by an environment variable.

That took twenty minutes and has paid for itself twice. When the shape changed
again, the change was one file. And there's a predicate — `canScoreInterruption`
— that asks whether a given message shape can actually report what went unsaid.
It's a testable claim rather than an assertion in a README, which means the
build fails if the answer ever becomes no.

The same instinct applies to the parts of any integration you've hand-rolled
around a gap. Write down what would let you delete the workaround, and check
it when the dependency updates.

## Play it, then read it

The game is a few hundred lines, runs with no key at all in simulator mode,
and the entire scoring path is exercised by the test suite rather than by me
saying it works.

```
git clone https://github.com/dg-coreylweathers/buzz-in
cd buzz-in
npm start
```

Buzz in early. Watch where the rule lands in the strip. That position is not
an estimate — it's the server telling you exactly where it stopped, and the
count next to it is the part it never reached.

If you're building barge-in handling into something real: capture at onset,
keep one counter per session, measure at the device, and get your word split
from the side of the connection that actually knows. The rest is a game.

---

<!-- [verify] Pipecat issue link/number — the open issue describing this exact
     bug class. Needs the real URL before publish. FLAGS.md F-11. -->
<!-- [verify] Current signup offer terms. FLAGS.md F-11. -->
<!-- [verify] Whether speech_id survived as a client field — do not let review
     add it back to the client message without checking. FLAGS.md F-04. -->
<!-- RESOLVED this run: repo path is github.com/dg-coreylweathers/buzz-in and
     the git clone line above matches it. -->
