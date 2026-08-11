#!/usr/bin/env node
// The assertion suite.
//
// NOTE ON PROVENANCE: this suite was written by the 2026-08-11 unattended run,
// from the PRD spec. It is NOT the inherited suite referenced in GOAL.md and
// PRD section 2 — that code was not present in this repository. See FLAGS.md
// F-01. Do not read a pass here as confirmation that the original 47
// assertions pass; they were never available to run.

import { OffsetLedger } from '../src/offsetLedger.js';
import { getInterruptShape, canScoreInterruption, AVAILABLE_SHAPES } from '../src/interruptShape.js';
import { CLUES } from '../src/clues.js';
import { SPOKEN_COPY } from '../src/spokenCopy.js';
import {
  checkSpokenLine, checkScreenCopy, ALLOWED_VOICES, BANNED_VOICES, MAX_SPOKEN_WORDS,
  BUZZ_WORD, BUZZ_PHRASES,
} from '../src/copyRules.js';
import { matchesBuzzPhrase } from '../src/listenSession.js';
import {
  countWords, buildWordStrip, scoreBuzz, scoreSession, answerMatches, OUTCOME,
} from '../src/scoring.js';
import { buildRound, makeRng, normalizeSeed, challengePath, seedFromChallengeParam } from '../src/challenge.js';
import { SimulatedSpeech, ONSET_TO_CONFIRMATION_MS } from '../src/simulator.js';
import { GameSession } from '../src/session.js';
import { resolveEnv } from '../src/config.js';

let passed = 0;
const failures = [];

function ok(label, cond) {
  if (cond) { passed += 1; return; }
  failures.push(label);
  console.error(`✗ ${label}`);
}
function eq(label, actual, expected) {
  ok(`${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`, actual === expected);
}
function throws(label, fn) {
  try { fn(); ok(label, false); } catch { ok(label, true); }
}

// ─── Group 1: the offset ledger — PRD 5.1, all three properties ─────────────

{
  const l = new OffsetLedger({ sampleRate: 48000 });
  l.recordRenderedSamples(48000);
  eq('1. offset is derived from rendered samples', Math.round(l.currentOffsetMs()), 1000);

  l.captureAtOnset();
  eq('2. onset capture holds the value at onset', Math.round(l.heldOffsetMs), 1000);

  // Audio keeps playing across the onset→confirmation gap.
  l.recordRenderedSamples(48000 * 0.36);
  eq('3. counter advances during the confirmation gap', Math.round(l.currentOffsetMs()), 1360);
  eq('4. held value is unchanged by that advance', Math.round(l.heldOffsetMs), 1000);
  eq('5. confirmed buzz uses the onset value, not the current one', Math.round(l.offsetForConfirmedBuzz()), 1000);
}
{
  const l = new OffsetLedger();
  throws('6. reading a confirmed offset with no onset capture throws', () => l.offsetForConfirmedBuzz());
}
{
  const l = new OffsetLedger();
  l.recordRenderedSamples(48000);
  l.captureAtOnset();
  l.captureAtOnset();
  eq('7. a second onset capture does not overwrite the first', Math.round(l.heldOffsetMs), 1000);
}
{
  const l = new OffsetLedger();
  l.recordRenderedSamples(4800);
  l.captureAtOnset();
  l.discardOnset();
  ok('8. an unconfirmed onset drops the hold', !l.hasHeldOffset);
  eq('9. discarding an onset does not rewind the counter', Math.round(l.currentOffsetMs()), 100);
}
{
  // The bug from PRD 5.1: a per-turn counter resets while the session moves on.
  const l = new OffsetLedger();
  l.recordRenderedSamples(48000);
  l.endTurn();
  eq('10. endTurn does NOT reset the session counter', Math.round(l.currentOffsetMs()), 1000);
  ok('11. endTurn clears any pending onset hold', !l.hasHeldOffset);
}
{
  const l = new OffsetLedger();
  l.recordRenderedSamples(48000); l.captureAtOnset(); l.offsetForConfirmedBuzz();
  l.captureAtOnset();
  throws('12. a backwards offset is rejected', () => l.offsetForConfirmedBuzz());
}
{
  const l = new OffsetLedger();
  const offsets = [];
  for (let turn = 0; turn < 3; turn++) {
    l.recordRenderedSamples(48000);
    l.captureAtOnset();
    l.recordRenderedSamples(1000);
    offsets.push(l.offsetForConfirmedBuzz());
    l.endTurn();
  }
  ok('13. offsets are strictly increasing across three turns', offsets[0] < offsets[1] && offsets[1] < offsets[2]);
  ok('14. no offset is ever zero after the first turn', offsets.every((o) => o > 0));
}
throws('15. a negative rendered-sample count is rejected', () => new OffsetLedger().recordRenderedSamples(-1));
throws('16. a non-finite rendered-sample count is rejected', () => new OffsetLedger().recordRenderedSamples(NaN));
throws('17. a zero sample rate is rejected', () => new OffsetLedger({ sampleRate: 0 }));
{
  const l = new OffsetLedger({ sampleRate: 24000 });
  l.recordRenderedSamples(24000);
  eq('18. a different device sample rate still yields real time', Math.round(l.currentOffsetMs()), 1000);
}

// ─── Group 2: the interrupt-shape adapter — PRD 5.2 ────────────────────────

{
  const ga = getInterruptShape('ga');
  const ea = getInterruptShape('ea');
  eq('19. the default shape is GA', getInterruptShape(undefined).name, 'ga');
  ok('20. both GA and EA shapes are available', AVAILABLE_SHAPES.includes('ga') && AVAILABLE_SHAPES.includes('ea'));
  throws('21. an unknown shape name is rejected', () => getInterruptShape('nonsense'));

  const gaMsg = ga.buildInterrupt({ offsetMs: 1234.6, speechId: 'abc' });
  eq('22. GA client message is an Interrupt', gaMsg.type, 'Interrupt');
  // Per deepgram-docs PR #1092 (GA contract): playback_offset, an object.
  eq('23. GA sends playback_offset as a time_ms object', gaMsg.playback_offset.type, 'time_ms');
  eq('23b. GA rounds the offset value to whole units', gaMsg.playback_offset.value, 1235);
  ok('23c. GA does not use the flat playback_offset_ms field', !('playback_offset_ms' in gaMsg));
  ok('24. GA does NOT send speech_id as a client field', !('speech_id' in gaMsg));
  // "unknown fields are rejected" — so the message must carry nothing else.
  eq('24b. GA sends exactly two keys and no unknown fields', Object.keys(gaMsg).sort().join(), 'playback_offset,type');
  ok('25. GA is declared cumulative', ga.offsetIsCumulative === true);

  const eaMsg = ea.buildInterrupt({ offsetMs: 100, speechId: 'abc' });
  eq('26. EA does send speech_id as a client field', eaMsg.speech_id, 'abc');
  ok('27. EA is declared non-cumulative', ea.offsetIsCumulative === false);

  throws('28. a negative offset is refused by the adapter', () => ga.buildInterrupt({ offsetMs: -1 }));

  const report = ga.parseReport({
    type: 'SpeechInterrupted', text_spoken: 'one two', text_remaining: 'three four five', speech_id: 'srv-1',
  });
  eq('29. the report exposes what was spoken', report.textSpoken, 'one two');
  eq('30. the report exposes what was left unsaid', report.textRemaining, 'three four five');
  eq('31. speech_id survives as a server-emitted diagnostic', report.speechId, 'srv-1');
  ok('31b. a report with both text fields is flagged as carrying the split', report.hasTextSplit);
  ok('31c. a report without the text fields is flagged as lacking the split',
    !ga.parseReport({ type: 'SpeechInterrupted', audio_played_ms: 900, metadata: { speech_id: 'x' } }).hasTextSplit);
  eq('31d. speech_id is read from metadata at GA',
    ga.parseReport({ type: 'SpeechInterrupted', metadata: { speech_id: 'dg_sp_1' } }).speechId, 'dg_sp_1');
  eq('32. a non-SpeechInterrupted message parses to null', ga.parseReport({ type: 'Other' }), null);

  ok('33. canScoreInterruption is true for GA', canScoreInterruption(ga));
  ok('34. canScoreInterruption is true for EA', canScoreInterruption(ea));
  ok('35. canScoreInterruption is false for a shape that cannot report the remainder',
    !canScoreInterruption({ parseReport: () => ({ textSpoken: 'x', textRemaining: '' }) }));
}

// ─── Group 3: scoring — PRD 1, DECISIONS D-07 ──────────────────────────────

eq('36. the score is the word count of what was left unsaid', scoreBuzz({ textRemaining: 'a b c d', outcome: OUTCOME.CORRECT }).points, 4);
eq('37. a wrong answer scores nothing but still reports the remainder', scoreBuzz({ textRemaining: 'a b c d', outcome: OUTCOME.WRONG }).points, 0);
eq('38. a wrong answer still counts the unsaid words', scoreBuzz({ textRemaining: 'a b c d', outcome: OUTCOME.WRONG }).wordsUnsaid, 4);
eq('39. letting the host finish scores nothing', scoreBuzz({ textRemaining: '', outcome: OUTCOME.NO_BUZZ }).points, 0);
eq('40. word counting ignores surrounding whitespace', countWords('  two  words  '), 2);
eq('41. an empty remainder counts as zero words', countWords(''), 0);
{
  const strip = buildWordStrip('one two three four', 'one two');
  eq('42. the word strip covers the whole clue', strip.length, 4);
  ok('43. spoken words are lit and unreached words are not', strip[0].spoken && strip[1].spoken && !strip[2].spoken);
  ok('44. the cut rule lands on the first unreached word', strip[2].cutHere === true && strip[3].cutHere === false);
}
ok('45. answer matching ignores case, articles, and punctuation', answerMatches('the titanic!', ['Titanic']));
ok('46. answer matching still rejects a wrong answer', !answerMatches('lusitania', ['Titanic']));
ok('47. an empty answer never matches', !answerMatches('   ', ['Titanic']));
{
  const s = scoreSession([
    { points: 5, outcome: OUTCOME.CORRECT }, { points: 0, outcome: OUTCOME.WRONG }, { points: 0, outcome: OUTCOME.NO_BUZZ },
  ]);
  eq('48. session total sums the points', s.total, 5);
  eq('49. session counts buzzes separately from clues', s.buzzed, 2);
}

// ─── Group 4: the six confirmed spoken-copy defects ────────────────────────

ok('50. the plural of "interruption" is caught', checkSpokenLine('too many interruptions today').length > 0);
ok('51. a score in units of time is caught', checkSpokenLine('you scored 250 milliseconds').length > 0);
ok('52. product terminology is caught', checkSpokenLine('the endpoint returned a payload').length > 0);
ok('53. a banned voice name is caught', checkSpokenLine('here is brittany with the clue').length > 0);
ok('54. an over-long turn is caught', checkSpokenLine('word '.repeat(MAX_SPOKEN_WORDS + 5)).length > 0);
ok('55. the buzz phrase inside clue text is caught', checkSpokenLine('the answer is I know it apparently').length > 0);
// Measured against staging: single plosive words do not survive recognition
// ("Buzz!" -> "But"), so the trigger is a phrase and the rule matches a phrase.
ok('55b. an ordinary clue containing "know" alone is NOT flagged',
  checkSpokenLine('Nobody could know this one for certain.').length === 0);
ok('56. a vendor reference is caught', checkSpokenLine('powered by deepgram').length > 0);
ok('57. a clean line passes all six rules', checkSpokenLine('This river runs through ten countries.').length === 0);
ok('58. an on-screen millisecond readout is caught', checkScreenCopy('cut at 340 ms').length > 0);
ok('59. a field name on screen is caught', checkScreenCopy('text_remaining').length > 0);

for (const [key, line] of Object.entries(SPOKEN_COPY)) {
  ok(`60. shipped spoken line "${key}" is clean`, checkSpokenLine(line).length === 0);
}

// ─── Group 5: the clue bank ────────────────────────────────────────────────

eq('61. the clue bank holds thirty clues', CLUES.length, 30);
ok('62. every clue is clean against all six rules', CLUES.every((c) => checkSpokenLine(c.text).length === 0));
ok('63. the buzz phrase appears in no clue',
  CLUES.every((c) => !new RegExp(BUZZ_WORD, 'i').test(c.text)));
// The mic trigger, which is the echo-cancellation mitigation in practice.
ok('63b. every accepted buzz phrase is absent from every clue',
  CLUES.every((c) => BUZZ_PHRASES.every((p) => !c.text.toLowerCase().includes(p))));
ok('63c. the buzz phrase matcher accepts what a player would say',
  matchesBuzzPhrase('I know it!', BUZZ_PHRASES) && matchesBuzzPhrase('oh i know this', BUZZ_PHRASES));
ok('63d. the matcher rejects ordinary speech',
  !matchesBuzzPhrase('um, hold on', BUZZ_PHRASES) && !matchesBuzzPhrase('', BUZZ_PHRASES));
ok('63e. the matcher rejects a mis-hearing of a plosive word',
  !matchesBuzzPhrase('but', BUZZ_PHRASES) && !matchesBuzzPhrase('bias', BUZZ_PHRASES));
ok('64. every clue id is unique', new Set(CLUES.map((c) => c.id)).size === CLUES.length);
ok('65. every clue has at least one accepted answer', CLUES.every((c) => c.accept?.length > 0));
ok('66. the bank contains reversal clues', CLUES.some((c) => c.kind === 'reversal'));
ok('67. every clue is long enough to leave words unsaid', CLUES.every((c) => countWords(c.text) >= 12));

// ─── Group 6: the voice roster — PRD 5.6, FLAGS F-06 ───────────────────────

ok('68. the roster excludes brittany', !ALLOWED_VOICES.includes('brittany'));
ok('69. the roster excludes marcus', !ALLOWED_VOICES.includes('marcus'));
ok('70. brittany and marcus are both explicitly banned', BANNED_VOICES.includes('brittany') && BANNED_VOICES.includes('marcus'));
ok('71. the roster is the confirmed cutlist', ['rufus', 'jack', 'cole', 'haley'].every((v) => ALLOWED_VOICES.includes(v)));

// ─── Group 7: seeded challenge links ───────────────────────────────────────

{
  const a = buildRound(42), b = buildRound(42), c = buildRound(43);
  eq('72. the same seed yields the same clue order', a.clues.map((x) => x.id).join(), b.clues.map((x) => x.id).join());
  eq('73. the same seed yields the same voice', a.voice, b.voice);
  ok('74. a different seed yields a different round', a.clues.map((x) => x.id).join() !== c.clues.map((x) => x.id).join());
  ok('75. a seeded round only uses roster voices', ALLOWED_VOICES.includes(a.voice));
  eq('76. a round is three clues', a.clues.length, 3);
  eq('77. a challenge link round-trips its seed', seedFromChallengeParam(challengePath(99).split('=')[1]), normalizeSeed(99));
  ok('78. a string seed normalizes to a number', Number.isInteger(normalizeSeed('hello')));
  ok('79. the rng is deterministic for a seed', makeRng(5)() === makeRng(5)());
}

// ─── Group 8: the simulated buzz loop, end to end ──────────────────────────

{
  const session = new GameSession({ seed: 7 });
  const speech = new SimulatedSpeech({ ledger: session.ledger });
  const clue = session.currentClue;
  const r = speech.speak(clue.text, { buzzAtWord: 3 });

  ok('80. a scripted buzz produces an interrupt', r.interrupted);
  eq('81. the report names three words as heard', countWords(r.message.text_spoken), 3);
  eq('82. the remainder is everything else in the clue', countWords(r.message.text_remaining), countWords(clue.text) - 3);

  // The onset value must exclude the audio rendered during the confirmation gap.
  const gapMs = ONSET_TO_CONFIRMATION_MS;
  ok('83. the scored offset excludes the confirmation gap', r.offsetMs < session.ledger.currentOffsetMs() - gapMs + 1);

  const resolved = session.resolve({ report: getInterruptShape('ga').parseReport(r.message), answer: clue.answer });
  eq('84. a correct answer scores the unsaid word count', resolved.points, countWords(clue.text) - 3);
  eq('85. the outcome is recorded as correct', resolved.outcome, OUTCOME.CORRECT);
}
{
  const session = new GameSession({ seed: 7 });
  const speech = new SimulatedSpeech({ ledger: session.ledger });
  const clue = session.currentClue;
  const r = speech.speak(clue.text, { buzzAtWord: 3 });
  const resolved = session.resolve({ report: getInterruptShape('ga').parseReport(r.message), answer: 'definitely not this' });
  eq('86. a wrong answer scores zero', resolved.points, 0);
  ok('87. a wrong answer still reports what went unsaid', resolved.wordsUnsaid > 0);
}
{
  const session = new GameSession({ seed: 7 });
  const speech = new SimulatedSpeech({ ledger: session.ledger });
  const r = speech.speak(session.currentClue.text, { buzzAtWord: null });
  ok('88. letting the host finish reports no interrupt', !r.interrupted);
  const resolved = session.resolve({ report: null, answer: null });
  eq('89. an unbuzzed clue scores zero', resolved.points, 0);
  eq('90. an unbuzzed clue is recorded as no_buzz', resolved.outcome, OUTCOME.NO_BUZZ);
}
{
  const session = new GameSession({ seed: 7 });
  const speech = new SimulatedSpeech({ ledger: session.ledger });
  const r = speech.speak(session.currentClue.text, { buzzAtWord: 3, confirms: false });
  ok('91. an unconfirmed onset produces no interrupt', !r.interrupted);
  ok('92. an unconfirmed onset leaves no held offset', !session.ledger.hasHeldOffset);
}
{
  // The full three-clue run, and the bug that hid behind it.
  const session = new GameSession({ seed: 11 });
  const speech = new SimulatedSpeech({ ledger: session.ledger });
  const offsets = [];
  for (const clue of [...session.clues]) {
    const r = speech.speak(clue.text, { buzzAtWord: 2 });
    offsets.push(r.offsetMs);
    session.resolve({ report: getInterruptShape('ga').parseReport(r.message), answer: clue.answer });
  }
  eq('93. a three-clue run resolves three clues', session.results.length, 3);
  ok('94. the run is finished', session.finished);
  ok('95. offsets increase strictly across the whole run', offsets[0] < offsets[1] && offsets[1] < offsets[2]);
  ok('96. no clue scored a perfect run by buzzing instantly', offsets.every((o) => o > 0));
  ok('97. the session total is the sum of its clues', session.total().total === session.results.reduce((s, r) => s + r.points, 0));
}
{
  const session = new GameSession({ seed: 7 });
  eq('98. a session builds exactly one ledger for all clues', session.ledger instanceof OffsetLedger, true);
  throws('99. a shape that cannot report the remainder cannot start a round', () =>
    new GameSession({ seed: 1, shape: { name: 'broken', parseReport: () => null, buildInterrupt: () => ({}) } }));
}

// ─── Group 9: staging-only enforcement — GOAL hard constraint ──────────────

eq('100. the default environment is staging', resolveEnv({}).name, 'staging');
ok('101. the staging host is the staging host', resolveEnv({}).host.includes('staging'));
throws('102. production is refused without an explicit override', () => resolveEnv({ BUZZ_IN_ENV: 'production' }));
throws('103. an unknown environment is refused', () => resolveEnv({ BUZZ_IN_ENV: 'dev' }));
eq('104. production is reachable only with a deliberate override', resolveEnv({ BUZZ_IN_ENV: 'production', BUZZ_IN_ALLOW_PROD: '1' }).name, 'production');

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${passed} assertions passed, ${failures.length} failed.`);
if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('Suite PASS.');
console.log(
  'Provenance: this suite was written by the 2026-08-11 run from the PRD spec. ' +
    'It is NOT the inherited suite named in GOAL.md — that code was absent. See FLAGS.md F-01.'
);
