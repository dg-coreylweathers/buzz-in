// The buzz loop, on screen.
//
// The scoring logic here is the same module the headless suite exercises —
// /src/session.js, /src/offsetLedger.js, /src/interruptShape.js. Only the
// transport differs between this and scripts/smoke.js. That is deliberate:
// the thing under test should be the thing that ships.

import { GameSession } from '/src/session.js';
import { OUTCOME } from '/src/scoring.js';
import { SPOKEN_COPY } from '/src/spokenCopy.js';
import { challengePath, seedFromChallengeParam } from '/src/challenge.js';
import { Sound } from './audio.js';
import { DevicePlayback } from './playback.js';

const $ = (id) => document.getElementById(id);
const el = {
  count: $('count'), strip: $('strip'), stripEmpty: $('stripEmpty'),
  start: $('start'), buzz: $('buzzKey'), form: $('answerForm'), answer: $('answer'),
  lamp: $('lamp'), mute: $('mute'), clueNum: $('clueNum'), roundVal: $('roundVal'),
  hostVal: $('hostVal'), statusVal: $('statusVal'), challengeLink: $('challengeLink'),
};

const sound = new Sound();
el.mute.setAttribute('aria-pressed', String(sound.muted));

// Word pacing for the on-screen strip. The AUDIO position is measured at the
// device (playback.js); this is only how fast words light up.
const MS_PER_WORD = 400;
const RUNNING_OUT_WORDS = 6;

let session = null;
let clueState = null;
let stopTension = null;
let stopRiser = null;

function setStatus(text) { el.statusVal.textContent = text; }
function setLamp(state) { el.lamp.dataset.state = state; }

function seedFromLocation() {
  const param = new URLSearchParams(location.search).get('c');
  return seedFromChallengeParam(param) ?? Math.floor(Math.random() * 0xffffffff);
}

// ── The word strip ───────────────────────────────────────────────────────

function renderStrip(words, spokenCount, { cut = false } = {}) {
  el.stripEmpty.hidden = true;
  el.strip.replaceChildren();
  words.forEach((word, i) => {
    if (cut && i === spokenCount) {
      const rule = document.createElement('span');
      rule.className = 'cut';
      el.strip.append(rule);
    }
    const span = document.createElement('span');
    span.className = 'word';
    if (i < spokenCount) span.classList.add('spoken');
    else if (cut) span.classList.add('unreached');
    span.textContent = word;
    el.strip.append(span);
  });
}

function lightNextWord() {
  const { words, spoken } = clueState;
  if (spoken >= words.length) return false;
  clueState.spoken += 1;
  const node = el.strip.children[clueState.spoken - 1];
  if (node) {
    node.classList.add('spoken', 'just-struck');
    setTimeout(() => node.classList.remove('just-struck'), 140);
  }
  // The UI tick is the audio partner for the strike animation.
  sound.tick(clueState.spoken);
  return true;
}

// ── One clue ─────────────────────────────────────────────────────────────

function playClue() {
  const clue = session.currentClue;
  if (!clue) return finishRound();

  const words = clue.text.trim().split(/\s+/);
  clueState = { clue, words, spoken: 0, buzzed: false, timer: null };

  el.clueNum.textContent = `${session.index + 1} of ${session.clues.length}`;
  renderStrip(words, 0);
  el.buzz.disabled = false;
  el.form.hidden = true;
  setLamp('live');
  setStatus(session.index === 0 ? 'first clue' : 'clue in play');

  // A reversal clue is a genuine gamble, so it gets a tension bed under it.
  if (clue.kind === 'reversal') stopTension = sound.tension();

  const step = () => {
    if (clueState.buzzed) return;

    // Only count audio for a word that actually played. Advancing on the
    // final no-op step would credit the ledger with audio the player never
    // heard — an overcount, which is the exact direction of error this whole
    // product exists to point at.
    const advanced = lightNextWord();
    if (!advanced) return endClueUnbuzzed();
    playback.advanceWords(1);

    const left = clueState.words.length - clueState.spoken;
    if (left === RUNNING_OUT_WORDS && !stopRiser) {
      stopRiser = sound.riser((left * MS_PER_WORD) / 1000);
    }
    clueState.timer = setTimeout(step, MS_PER_WORD);
  };
  clueState.timer = setTimeout(step, MS_PER_WORD);
}

function clearCues() {
  if (stopTension) { stopTension(); stopTension = null; }
  if (stopRiser) { stopRiser(); stopRiser = null; }
}

function endClueUnbuzzed() {
  clearTimeout(clueState.timer);
  clearCues();
  setLamp('idle');
  el.buzz.disabled = true;
  setStatus('you let the host finish');
  session.ledger.endTurn();
  const result = session.resolve({ report: null, answer: null });
  showResult(result);
  setTimeout(nextClue, 1400);
}

// The player buzzed. Onset is NOW: capture and hold the offset immediately.
// The confirmation that follows must never re-read it.
function onBuzz() {
  if (!clueState || clueState.buzzed) return;
  clueState.buzzed = true;
  clearTimeout(clueState.timer);
  clearCues();

  playback.captureOnset();
  playback.cut();

  sound.buzzer();
  setLamp('cut');
  el.buzz.disabled = true;
  setStatus('cut in — what is it?');

  // What the host actually got through, and what it never reached.
  const spoken = clueState.words.slice(0, clueState.spoken).join(' ');
  const remaining = clueState.words.slice(clueState.spoken).join(' ');
  clueState.report = { textSpoken: spoken, textRemaining: remaining };

  renderStrip(clueState.words, clueState.spoken, { cut: true });

  el.form.hidden = false;
  el.answer.value = '';
  el.answer.focus();
}

function submitAnswer(event) {
  event.preventDefault();
  if (!clueState?.report) return;

  // Confirmed buzz: this consumes the value HELD at onset. If it threw, the
  // offset went backwards or was never captured — both are real bugs, not
  // things to paper over.
  try {
    session.buildInterruptMessage();
  } catch (err) {
    console.error('offset ledger refused the buzz:', err.message);
  }

  const result = session.resolve({ report: clueState.report, answer: el.answer.value });
  el.form.hidden = true;

  if (result.outcome === OUTCOME.CORRECT) {
    sound.correct();
    setStatus(SPOKEN_COPY.correct.toLowerCase());
  } else {
    sound.wrong();
    setStatus('not this time');
  }
  showResult(result);
  session.ledger.endTurn();
  setTimeout(nextClue, 1600);
}

function showResult(result) {
  const running = session.total().total;
  el.count.dataset.scored = result.points > 0 ? 'true' : 'false';
  countUpTo(running);
}

// The count-up, with a tick per word so the visual has an audio partner.
function countUpTo(target) {
  const from = Number(el.count.textContent) || 0;
  if (target === from) return;
  let n = from;
  const step = () => {
    n += 1;
    el.count.textContent = String(n);
    sound.tick(n);
    if (n < target) setTimeout(step, 40);
  };
  step();
}

function nextClue() {
  if (session.finished) return finishRound();
  playClue();
}

function finishRound() {
  setLamp('idle');
  el.buzz.disabled = true;
  el.start.disabled = false;
  el.start.textContent = 'PLAY AGAIN';
  const t = session.total();
  setStatus(`${t.total} words never said, ${t.correct} of ${t.clues} right`);
  el.challengeLink.hidden = false;
  el.challengeLink.href = challengePath(session.seed);
}

// ── Playback shim ────────────────────────────────────────────────────────
//
// Owns the ledger's view of what the device has rendered. When a real speech
// session is attached, DevicePlayback feeds the ledger from the output
// worklet. Without one, words are paced locally — same ledger, same rules, no
// wall clock either way.

const playback = {
  device: null,
  ledger: null,
  sampleRate: 48000,

  attach(ledger, ctx) {
    this.ledger = ledger;
    if (!ctx) return;
    this.sampleRate = ctx.sampleRate;
    this.device = new DevicePlayback({ ledger, ctx });
    this.device.start().catch(() => { this.device = null; });
  },

  // Only used when no real speech session is feeding the worklet.
  advanceWords(n) {
    if (this.device) return;
    this.ledger.recordRenderedSamples((MS_PER_WORD / 1000) * this.sampleRate * n);
  },

  // Live audio from the server-held session. Goes to the worklet, which is
  // what advances the ledger — enqueueing alone never counts.
  pushSamples(floats) {
    this.device?.push(floats);
  },

  get isLive() {
    return Boolean(this.device);
  },

  captureOnset() { this.ledger.captureAtOnset(); },

  // Queued-but-unheard audio must never count toward the offset.
  cut() { this.device?.flush(); },
};

// ── Wiring ───────────────────────────────────────────────────────────────

function startRound() {
  // First player gesture: this is the only place audio is ever unlocked.
  sound.unlock();

  const seed = seedFromLocation();
  session = new GameSession({ seed });
  playback.attach(session.ledger, sound.ctx);

  el.count.textContent = '0';
  el.count.dataset.scored = 'false';
  el.start.disabled = true;
  el.roundVal.textContent = session.seed.toString(36).toUpperCase();
  el.hostVal.textContent = session.voice;
  el.challengeLink.hidden = true;
  setStatus('here we go');
  playClue();
}

el.start.addEventListener('click', startRound);
el.buzz.addEventListener('click', onBuzz);
el.form.addEventListener('submit', submitAnswer);

el.mute.addEventListener('click', () => {
  const next = el.mute.getAttribute('aria-pressed') !== 'true';
  el.mute.setAttribute('aria-pressed', String(next));
  el.mute.setAttribute('aria-label', next ? 'Unmute sound' : 'Mute sound');
  sound.unlock();
  sound.setMuted(next);
});

// Space bar buzzes, because reaching for a mouse costs words.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  if (document.activeElement === el.answer) return;
  e.preventDefault();
  if (!el.buzz.disabled) onBuzz();
});
