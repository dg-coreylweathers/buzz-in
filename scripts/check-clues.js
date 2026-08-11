#!/usr/bin/env node
// check:clues — every clue in the bank, against the six confirmed spoken-copy
// defects. Fails the build. These are hard constraints, not preferences.

import { CLUES, CLUE_KINDS } from '../src/clues.js';
import { checkSpokenLine, BUZZ_WORD } from '../src/copyRules.js';

let failures = 0;
const seen = new Set();

for (const clue of CLUES) {
  const problems = checkSpokenLine(clue.text);

  if (seen.has(clue.id)) problems.push(`duplicate clue id "${clue.id}"`);
  seen.add(clue.id);

  if (!CLUE_KINDS.includes(clue.kind)) {
    problems.push(`unknown clue kind "${clue.kind}"`);
  }
  if (!clue.accept || clue.accept.length === 0) {
    problems.push('has no accepted answers');
  }
  // A clue needs enough words for a buzz to leave something unsaid — the
  // score is the count of what was left, so a four-word clue is not a game.
  const wordCount = clue.text.trim().split(/\s+/).length;
  if (wordCount < 12) {
    problems.push(`is only ${wordCount} words — too short to score meaningfully`);
  }

  if (problems.length) {
    failures += problems.length;
    console.error(`✗ ${clue.id} (${clue.category})`);
    for (const p of problems) console.error(`    ${p}`);
  }
}

const reversals = CLUES.filter((c) => c.kind === 'reversal').length;

if (failures) {
  console.error(`\ncheck:clues FAILED — ${failures} problem(s) across ${CLUES.length} clues.`);
  process.exit(1);
}

console.log(
  `check:clues PASS — ${CLUES.length} clues (${reversals} reversal), ` +
    `no vendor reference, no product terminology, no banned voice name, ` +
    `no plural of "interruption", no score in units of time, ` +
    `and the buzz word "${BUZZ_WORD}" appears in none of them.`
);
