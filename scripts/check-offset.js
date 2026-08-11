#!/usr/bin/env node
// check:offset — the offset-ledger guard.
//
// This is the check a generic code-review pass will not think to make, and it
// covers this codebase's three specific failure modes (PRD 5.1). Written as a
// static guard so it holds even for code paths the assertion suite cannot
// exercise headlessly — notably the browser playback worklet.
//
// See DECISIONS.md D-04 for why this lives here rather than inside a review
// skill.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function fail(msg) {
  failures += 1;
  console.error(`✗ ${msg}`);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

// Files that participate in measuring or holding the playback offset.
const OFFSET_PATH_FILES = [
  'src/offsetLedger.js',
  'src/simulator.js',
  'public/playback.js',
];

// --- Guard 1: no wall clock anywhere in the offset path ---------------------
// A wall clock overcounts by including buffered-but-unheard audio and silent
// underruns — always in the direction of telling the player they heard more
// than they did.
const WALL_CLOCK = /\b(Date\.now|performance\.now|new Date)\b/;

for (const rel of OFFSET_PATH_FILES) {
  const src = read(rel);
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (WALL_CLOCK.test(code)) {
    fail(`${rel} reads a wall clock in the offset path — the offset must be measured at the audio device.`);
  }
}

// --- Guard 2: the offset is captured at onset and held ----------------------
const ledger = read('src/offsetLedger.js');
if (!/captureAtOnset\s*\(/.test(ledger)) {
  fail('src/offsetLedger.js has no captureAtOnset — the offset must be captured at speech onset.');
}
if (!/offsetForConfirmedBuzz\s*\(/.test(ledger)) {
  fail('src/offsetLedger.js has no offsetForConfirmedBuzz.');
}
// The confirmation path must consume the HELD value, not re-read the counter.
const confirmBody = ledger.slice(ledger.indexOf('offsetForConfirmedBuzz'));
const confirmFn = confirmBody.slice(0, confirmBody.indexOf('\n  discardOnset'));
if (/currentOffsetMs\s*\(/.test(confirmFn.replace(/\/\/[^\n]*/g, ''))) {
  fail(
    'offsetForConfirmedBuzz re-reads the current offset. It must use the value held ' +
      'from onset — re-reading inflates every score by about a word.'
  );
}

// --- Guard 3: the ledger is session-scoped and monotonic --------------------
if (!/_highWaterMs/.test(ledger)) {
  fail('src/offsetLedger.js does not track a high-water mark — a backwards offset would go undetected.');
}
const endTurn = ledger.slice(ledger.indexOf('endTurn'));
if (/_renderedSamples\s*=\s*0/.test(endTurn)) {
  fail(
    'endTurn resets the rendered-sample counter. The counter is session-scoped, ' +
      'not per-turn — resetting it produces a backwards offset the server rejects.'
  );
}

// --- Guard 4: the session holds one ledger, not one per clue ----------------
const session = read('src/session.js');
const ledgerConstructions = (session.match(/new OffsetLedger\(/g) || []).length;
if (ledgerConstructions !== 1) {
  fail(`src/session.js constructs ${ledgerConstructions} ledgers; it must construct exactly one for the whole session.`);
}

if (failures) {
  console.error(`\ncheck:offset FAILED — ${failures} problem(s).`);
  process.exit(1);
}

console.log(
  'check:offset PASS — offset captured at onset and held, session-scoped and ' +
    'monotonic, measured at the audio device with no wall clock in the path.'
);
