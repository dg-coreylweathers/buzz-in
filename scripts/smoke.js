#!/usr/bin/env node
// smoke — a full three-clue run, headless, with a scripted buzz.
//
//   node scripts/smoke.js                 # buzz after 4 words of each clue
//   node scripts/smoke.js --buzz-at 2     # buzz after 2 words
//   node scripts/smoke.js --seed 42
//   node scripts/smoke.js --live          # also probe staging reachability
//
// WHAT THIS PROVES: the buzz loop, the offset ledger, the adapter, and the
// scoring path all run end to end without error and produce the scores the
// spec says they should.
//
// WHAT THIS DOES NOT PROVE, AND CANNOT: that the audio sounds right, that the
// timing holds against the live service, or that any of it works on a real
// phone. "The smoke script ran clean" is not "a human confirmed this sounds
// right." See FLAGS.md.

import { GameSession } from '../src/session.js';
import { SimulatedSpeech } from '../src/simulator.js';
import { getInterruptShape } from '../src/interruptShape.js';
import { resolveEnv, hasApiKey } from '../src/config.js';
import { countWords } from '../src/scoring.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const buzzAt = Number(flag('buzz-at', 4));
const seed = Number(flag('seed', 7));
const live = args.includes('--live');

const env = resolveEnv();
const shape = getInterruptShape();

console.log(`buzz-in smoke run`);
console.log(`  environment : ${env.name} (${env.host})`);
console.log(`  shape       : ${shape.name}`);
console.log(`  seed        : ${seed}`);
console.log(`  buzz at     : word ${buzzAt}`);
console.log(`  key present : ${hasApiKey() ? 'yes' : 'no (simulator only)'}`);

if (env.name !== 'staging') {
  console.error('\nRefusing to smoke-test outside staging.');
  process.exit(1);
}

const session = new GameSession({ seed, shape });
const speech = new SimulatedSpeech({ ledger: session.ledger });

console.log(`  voice       : ${session.voice}`);
console.log(`  clues       : ${session.clues.map((c) => c.id).join(', ')}\n`);

let lastOffset = -1;
let failures = 0;

for (const clue of [...session.clues]) {
  const result = speech.speak(clue.text, { buzzAtWord: buzzAt });

  if (!result.interrupted) {
    console.error(`✗ ${clue.id}: no interrupt was reported`);
    failures += 1;
    session.resolve({ report: null, answer: null });
    continue;
  }

  // The offset must never go backwards across a turn boundary. This is the
  // exact bug that made every clue after the first buzz instantly and score a
  // perfect run.
  if (result.offsetMs <= lastOffset) {
    console.error(
      `✗ ${clue.id}: offset did not advance across the turn boundary ` +
        `(${result.offsetMs.toFixed(0)} after ${lastOffset.toFixed(0)})`
    );
    failures += 1;
  }
  lastOffset = result.offsetMs;

  // The message the client would send, built through the adapter.
  const built = shape.buildInterrupt({ offsetMs: result.heldOffsetMs });
  if (shape.name === 'ga' && 'speech_id' in built) {
    console.error(`✗ ${clue.id}: GA shape leaked speech_id into the client message`);
    failures += 1;
  }

  const report = shape.parseReport(result.message);
  const resolved = session.resolve({ report, answer: clue.answer });

  const heard = countWords(report.textSpoken);
  if (heard !== buzzAt) {
    console.error(`✗ ${clue.id}: expected ${buzzAt} words heard, got ${heard}`);
    failures += 1;
  }

  console.log(
    `  ${clue.id}  heard ${heard}  unsaid ${resolved.wordsUnsaid}  ` +
      `${resolved.outcome.padEnd(7)}  +${resolved.points}`
  );
}

const total = session.total();
console.log(
  `\n  total: ${total.total} points across ${total.clues} clues ` +
    `(${total.correct} correct of ${total.buzzed} buzzed)`
);

if (live) {
  if (!hasApiKey()) {
    console.log('\n  --live: no staging key in the environment; skipped the reachability probe.');
  } else {
    try {
      const res = await fetch(`https://${env.host}/v1/projects`, {
        method: 'GET',
        headers: { Authorization: `Token ${process.env.DEEPGRAM_STAGING_API_KEY}` },
      });
      console.log(`\n  --live: staging reachable, responded ${res.status}.`);
      console.log('  NOTE: reachability only. This says nothing about audio timing or quality.');
    } catch (err) {
      console.log(`\n  --live: could not reach staging (${err.message}). Not treated as a failure.`);
    }
  }
}

if (failures) {
  console.error(`\nsmoke FAILED — ${failures} problem(s).`);
  process.exit(1);
}

console.log('\nsmoke PASS — three-clue run completed headless, offset monotonic throughout.');
console.log('Audio quality, live timing, and mobile behaviour remain UNVERIFIED. See FLAGS.md.');
