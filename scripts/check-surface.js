#!/usr/bin/env node
// check:surface — the visual and sound surface, checked structurally.
//
// This is how the design direction and the sound design get verified without
// ears and without a browser. It checks the things that ARE checkable:
// spacing scale, framework absence, typographic hierarchy, cue coverage,
// autoplay, mute. It cannot and does not check whether any of it looks or
// sounds good — that is on the human checklist in FLAGS.md.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
// Comments are stripped first: a comment explaining which motif we deliberately
// avoided is not that motif, and prose about the design must not trip checks on
// the design itself.
const stripCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

const css = stripCss(read('public/styles.css'));
const html = stripHtml(read('public/index.html'));
const audio = read('public/audio.js');
const app = read('public/app.js');

let failures = 0;
const pass = [];
const fail = (m) => { failures += 1; console.error(`✗ ${m}`); };
const ok = (m) => pass.push(m);

// ── Visual direction (PRD 5.4) ──────────────────────────────────────────

// No framework, no utility classes.
if (/(tailwind|bootstrap|bulma|foundation)/i.test(css + html)) fail('a CSS framework is referenced');
else ok('no framework');

if (/class="[^"]*\b(?:p|m|mt|mb|px|py|text|bg|flex)-\d/.test(html)) fail('utility classes in the markup');
else ok('no utility classes');

// Nothing loaded from off-origin: no external fonts, scripts, or assets.
const external = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
if (external.length) fail(`external asset reference(s): ${external.join(', ')}`);
else ok('no external assets — nothing loaded off-origin');

// Spacing scale is 16px multiples only.
const scale = [...css.matchAll(/--s\d+:\s*(\d+)px/g)].map((m) => Number(m[1]));
if (!scale.length) fail('no spacing scale defined');
else if (scale.some((v) => v % 16 !== 0)) fail(`spacing scale has non-16px multiples: ${scale.join(', ')}`);
else ok(`spacing scale is 16px multiples (${scale.join(', ')})`);

// The word count is by far the largest thing on screen.
const countSize = css.match(/\.count\s*\{[^}]*font-size:\s*clamp\(\s*(\d+)px[^)]*?(\d+)px\s*\)/s);
if (!countSize) fail('the count has no clamped font size');
else {
  const floor = Number(countSize[1]);
  const others = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
  const biggestOther = Math.max(...others);
  if (floor <= biggestOther * 2) fail(`the count (${floor}px floor) is not dominant over the next largest text (${biggestOther}px)`);
  else ok(`the count dominates the hierarchy (${floor}px floor vs ${biggestOther}px next largest)`);
}

// The word strip: spoken lit, unreached dim and struck, a hard rule at the cut.
for (const [sel, why] of [
  ['.word.spoken', 'spoken words are lit'],
  ['.word.unreached', 'unreached words are dim and struck through'],
  ['.cut', 'a hard rule marks where the cut landed'],
]) {
  if (css.includes(sel)) ok(why);
  else fail(`missing ${sel} — ${why}`);
}
if (/\.word\.unreached[^}]*line-through/s.test(css)) ok('the strike is an actual line-through');
else fail('unreached words are not struck through');

// One accent, used sparingly. Ambient glow present; no glassy orb motif.
const accentUses = (css.match(/var\(--accent\)/g) || []).length;
if (accentUses > 14) fail(`the accent is used ${accentUses} times — that is not "sparingly"`);
else ok(`one accent used sparingly (${accentUses} uses)`);
if (/radial-gradient/.test(css)) ok('ambient glow present');
else fail('no ambient glow');
if (/\bbackdrop-filter\b/.test(css) || /orb/i.test(css + html)) fail('a glassy/orb motif leaked in — that fights the instrument read');
else ok('no glassy orb motif');

// No instrumentation on screen.
if (/\bms\b/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) fail('a millisecond unit appears in the markup');
else ok('no millisecond readout in the markup');

// ── Sound design (PRD 5.5) ──────────────────────────────────────────────

for (const cue of ['buzzer', 'correct', 'wrong', 'tension', 'riser', 'tick']) {
  if (new RegExp(`\\b${cue}\\s*\\(`).test(audio)) ok(`cue present: ${cue}`);
  else fail(`missing required cue: ${cue}`);
}

// Everything synthesized — no sourced audio files, no fetched assets.
if (/\.(mp3|wav|ogg|m4a|aac)\b/i.test(audio + html)) fail('a sourced audio file is referenced — sound must be synthesized');
else ok('all sound is synthesized, no sourced audio files');
if (/\bfetch\(|XMLHttpRequest|decodeAudioData/.test(audio)) fail('audio.js fetches or decodes external audio');
else ok('no external audio fetched or decoded');

// Nothing autoplays: the context is only created from a player gesture.
if (/new\s+(?:window\.)?(?:AudioContext|Ctx)\b/.test(audio) && !/unlock\s*\(\)\s*\{[\s\S]*?new Ctx\(\)/.test(audio)) {
  fail('an AudioContext is created outside the unlock path');
} else ok('the AudioContext is created only inside unlock()');
if (/unlock\(\)/.test(app)) ok('unlock() is called from a player gesture');
else fail('nothing calls unlock() — audio would never start');

// A mute toggle exists, persists, and kills cues already in flight.
if (/id="mute"/.test(html)) ok('mute control present in the markup');
else fail('no mute control');
if (/setMuted/.test(audio) && /stopAll/.test(audio)) ok('mute silences cues already in flight');
else fail('mute does not stop in-flight cues');
if (/localStorage/.test(audio)) ok('mute preference persists');
else fail('mute preference does not persist');

// Reduced motion is respected.
if (/prefers-reduced-motion/.test(css)) ok('prefers-reduced-motion respected');
else fail('prefers-reduced-motion not respected');

// ── Browser/node safety: no unguarded `process` in browser modules ──────
//
// Added after a real failure: `getInterruptShape(name = process.env.X)` threw
// ReferenceError: process is not defined on the first click, because src/ is
// shared between the server and the browser. Walk what the browser actually
// loads and fail on any unguarded reference.

const graph = new Set();
const stack = ['public/app.js'];
while (stack.length) {
  const file = stack.pop();
  if (graph.has(file)) continue;
  graph.add(file);
  let src;
  try {
    src = read(file);
  } catch {
    continue;
  }
  for (const m of src.matchAll(/from ['"]([^'"]+)['"]/g)) {
    let spec = m[1];
    if (spec.startsWith('/src/')) spec = `src/${spec.slice(5)}`;
    else if (spec.startsWith('./')) spec = (file.startsWith('public/') ? 'public/' : 'src/') + spec.slice(2);
    else continue;
    stack.push(spec);
  }
}

for (const file of graph) {
  const code = read(file).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // A guarded use (typeof process === 'undefined') is fine; a bare one is not.
  const guarded = /typeof\s+process\s*===\s*['"]undefined['"]/.test(code);
  if (/\bprocess\s*\./.test(code) && !guarded) {
    fail(`${file} reads \`process\` unguarded, but the browser loads it — this throws ReferenceError at runtime.`);
  }
}
ok(`no unguarded process access across ${graph.size} browser-loaded modules`);

// ── Report ──────────────────────────────────────────────────────────────

if (failures) {
  console.error(`\ncheck:surface FAILED — ${failures} problem(s).`);
  process.exit(1);
}
console.log(`check:surface PASS — ${pass.length} structural checks on the visual and sound surface.`);
console.log('This says NOTHING about whether it looks or sounds good. See FLAGS.md sections A and D.');
