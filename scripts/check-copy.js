#!/usr/bin/env node
// check:copy — every piece of copy that reaches a player, spoken or on screen.
//
// Spoken lines get all six defect rules. On-screen copy additionally gets the
// no-instrumentation rule: no millisecond readout, no field names, no product
// name in the interface. The blog names the mechanism; the game performs it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SPOKEN_COPY } from '../src/spokenCopy.js';
import {
  checkSpokenLine, checkScreenCopy, ALLOWED_VOICES, BANNED_VOICES,
} from '../src/copyRules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function report(label, problems) {
  if (!problems.length) return;
  failures += problems.length;
  console.error(`✗ ${label}`);
  for (const p of problems) console.error(`    ${p}`);
}

// --- 1. Spoken host lines ---------------------------------------------------
for (const [key, line] of Object.entries(SPOKEN_COPY)) {
  report(`spoken.${key}: "${line}"`, checkSpokenLine(line));
}

// --- 2. On-screen copy, extracted from the markup ---------------------------
const html = readFileSync(join(root, 'public', 'index.html'), 'utf8');

const visibleText = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

report('on-screen text', checkScreenCopy(visibleText));

// Alt text and aria labels reach players too, and the no-vendor rule covers
// image alt text explicitly.
for (const m of html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/gi)) {
  if (m[1].trim()) report(`attribute copy: "${m[1]}"`, checkScreenCopy(m[1]));
}

// --- 3. The voice roster ----------------------------------------------------
for (const banned of BANNED_VOICES) {
  if (ALLOWED_VOICES.includes(banned)) {
    report('voice roster', [`banned voice "${banned}" is in the allowed list`]);
  }
}
if (ALLOWED_VOICES.length === 0) {
  report('voice roster', ['is empty']);
}

if (failures) {
  console.error(`\ncheck:copy FAILED — ${failures} problem(s).`);
  process.exit(1);
}

console.log(
  `check:copy PASS — ${Object.keys(SPOKEN_COPY).length} spoken lines and all ` +
    `on-screen copy clean; voices limited to ${ALLOWED_VOICES.join(', ')}; ` +
    `${BANNED_VOICES.join(' and ')} excluded; no instrumentation on screen.`
);
