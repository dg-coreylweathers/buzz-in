// The buzz loop, on screen.
//
// The scoring logic here is the same module the headless suite exercises —
// /src/session.js, /src/offsetLedger.js, /src/interruptShape.js. Only the
// transport differs between this and scripts/smoke.js.
//
// Two transports:
//   LIVE — real voice audio streamed from staging through our own server. The
//          offset ledger is fed by the output worklet, so the offset is
//          measured at the audio device exactly as the design requires.
//   SIM  — no audio, words paced locally. Runs with no key.
//
// Live is the default when the server reports a key; add ?sim=1 to force the
// simulator.

import { GameSession } from '/src/session.js';
import { OUTCOME, countWords } from '/src/scoring.js';
import { SPOKEN_COPY } from '/src/spokenCopy.js';
import { challengePath, seedFromChallengeParam } from '/src/challenge.js';
import { getInterruptShape } from '/src/interruptShape.js';
import { Sound } from './audio.js';
import { DevicePlayback } from './playback.js';
import { LiveSpeech } from './liveSpeech.js';
import { Mic } from './mic.js';

const $ = (id) => document.getElementById(id);
const el = {
  count: $('count'), strip: $('strip'), stripEmpty: $('stripEmpty'),
  start: $('start'), buzz: $('buzzKey'), form: $('answerForm'), answer: $('answer'),
  lamp: $('lamp'), mute: $('mute'), clueNum: $('clueNum'), roundVal: $('roundVal'),
  hostVal: $('hostVal'), statusVal: $('statusVal'), challengeLink: $('challengeLink'),
  voice: $('voice'), pause: $('pause'), clock: $('clock'), clockFill: $('clockFill'),
  heard: $('heard'), flash: $('flash'), stage: document.querySelector('.stage'),
  buzzHint: $('buzzHint'),
};

const sound = new Sound();
el.mute.setAttribute('aria-pressed', String(sound.muted));

const shape = getInterruptShape('ga');

// Simulator pacing only. Live mode never uses this — it paces off rendered audio.
const MS_PER_WORD = 400;
// Measured against staging 2026-08-11 across three clues: ~54-67 ms/char.
// Used ONLY to position the word strip against real audio; it never touches
// the offset ledger and never contributes to a score.
const MS_PER_CHAR = 57;
const RUNNING_OUT_WORDS = 6;

let session = null;
let clueState = null;
let live = null;
let liveAvailable = false;
let stopTension = null;
let stopRiser = null;
let stopRoll = null;
let mic = null;
let chosenVoice = localStorage.getItem('buzz-in.voice') || null;
let paused = false;

// How long a clue may run before the host finishes it. The clock is a bar,
// never a number, because no instrumentation may appear on screen.
const CLUE_SECONDS = 22;

function flash(kind) {
  el.flash.dataset.fire = '';
  void el.flash.offsetWidth;          // restart the animation
  el.flash.dataset.fire = kind;
}

function slam() {
  el.count.dataset.slam = 'true';
  setTimeout(() => { el.count.dataset.slam = 'false'; }, 160);
}

function setStatus(t) { el.statusVal.textContent = t; }
function setLamp(s) { el.lamp.dataset.state = s; }

function seedFromLocation() {
  const p = new URLSearchParams(location.search).get('c');
  return seedFromChallengeParam(p) ?? Math.floor(Math.random() * 0xffffffff);
}
const forceSim = () => new URLSearchParams(location.search).has('sim');

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

function lightWordsTo(n) {
  const { words } = clueState;
  const target = Math.min(n, words.length);
  while (clueState.spoken < target) {
    clueState.spoken += 1;
    const node = el.strip.children[clueState.spoken - 1];
    if (node) {
      node.classList.add('spoken', 'just-struck');
      setTimeout(() => node.classList.remove('just-struck'), 140);
    }
    sound.tick(clueState.spoken);
  }
  maybeRiser();
}

function maybeRiser() {
  const left = clueState.words.length - clueState.spoken;
  if (left === RUNNING_OUT_WORDS && !stopRiser && !clueState.buzzed) {
    stopRiser = sound.riser((left * MS_PER_WORD) / 1000);
  }
}

// ── One clue ─────────────────────────────────────────────────────────────

function beginClue() {
  const clue = session.currentClue;
  if (!clue) return finishRound();

  const words = clue.text.trim().split(/\s+/);
  // Cumulative character offset per word, for positioning the strip against
  // real audio. Longer words take proportionally longer to say.
  const charEnds = [];
  let acc = 0;
  for (const w of words) { acc += w.length + 1; charEnds.push(acc); }

  clueState = {
    clue, words, charEnds, totalChars: acc,
    spoken: 0, buzzed: false, timer: null, raf: null, startOffsetMs: null,
  };

  el.clueNum.textContent = `${session.index + 1} of ${session.clues.length}`;
  renderStrip(words, 0);
  el.buzz.disabled = false;
  el.form.hidden = true;
  setLamp('live');
  setStatus(session.index === 0 ? 'first clue' : 'clue in play');

  if (clue.kind === 'reversal') stopTension = sound.tension();

  el.stage.dataset.live = 'true';
  el.pause.disabled = false;
  startClock();
  mic?.arm();

  return clueState.live ? null : null;
}

function playClueSimulated() {
  const step = () => {
    if (clueState.buzzed) return;
    if (clueState.spoken >= clueState.words.length) return endClueUnbuzzed();
    lightWordsTo(clueState.spoken + 1);
    playback.advanceWords(1);
    clueState.timer = setTimeout(step, MS_PER_WORD);
  };
  clueState.timer = setTimeout(step, MS_PER_WORD);
}

function playClueLive() {
  live.speak(session.voice, clueState.clue.text);

  // The strip follows audio the DEVICE has actually rendered. The ledger is
  // the source of truth for position; MS_PER_CHAR only maps that position
  // onto words for display.
  const follow = () => {
    if (clueState.buzzed) return;
    if (clueState.startOffsetMs === null) {
      clueState.raf = requestAnimationFrame(follow);
      return;
    }
    const playedMs = session.ledger.currentOffsetMs() - clueState.startOffsetMs;
    const charsSpoken = playedMs / MS_PER_CHAR;
    let n = 0;
    while (n < clueState.charEnds.length && clueState.charEnds[n] <= charsSpoken) n += 1;
    lightWordsTo(n);

    if (clueState.finished && clueState.spoken >= clueState.words.length) return endClueUnbuzzed();
    clueState.raf = requestAnimationFrame(follow);
  };
  clueState.raf = requestAnimationFrame(follow);
}

function playClue() {
  beginClue();
  if (!clueState) return;
  if (live) playClueLive();
  else playClueSimulated();
}

function clearCues() {
  if (stopTension) { stopTension(); stopTension = null; }
  if (stopRiser) { stopRiser(); stopRiser = null; }
  if (stopRoll) { stopRoll(); stopRoll = null; }
}

// ── The clock ────────────────────────────────────────────────────────────
// A draining bar. It is the "you are running out of time" pressure the game
// was missing, and it doubles as the fallback end for a clue.

function startClock() {
  clueState.clockLeft = CLUE_SECONDS * 1000;
  el.clock.dataset.danger = 'false';
  el.clock.dataset.paused = 'false';
  el.clockFill.style.transform = 'scaleX(1)';
  clueState.clockLast = null;

  const tick = (now) => {
    if (!clueState || clueState.buzzed) return;
    if (paused) { clueState.clockLast = null; clueState.clockRaf = requestAnimationFrame(tick); return; }
    if (clueState.clockLast !== null) clueState.clockLeft -= now - clueState.clockLast;
    clueState.clockLast = now;

    const frac = Math.max(0, clueState.clockLeft / (CLUE_SECONDS * 1000));
    el.clockFill.style.transform = `scaleX(${frac})`;

    if (frac < 0.25 && el.clock.dataset.danger !== 'true') {
      el.clock.dataset.danger = 'true';
      if (!stopRoll) stopRoll = sound.drumroll(clueState.clockLeft / 1000);
    }
    if (clueState.clockLeft <= 0) return endClueUnbuzzed();
    clueState.clockRaf = requestAnimationFrame(tick);
  };
  clueState.clockRaf = requestAnimationFrame(tick);
}

function togglePause() {
  if (!clueState || clueState.buzzed) return;
  paused = !paused;
  el.pause.textContent = paused ? 'RESUME' : 'PAUSE';
  el.clock.dataset.paused = String(paused);
  el.buzz.disabled = paused;
  el.stage.dataset.live = String(!paused);
  setStatus(paused ? 'held' : 'back in play');

  if (paused) {
    clearCues();
    mic?.disarm();
    if (clueState.timer) clearTimeout(clueState.timer);
    clueState.pausedAtOffset = session.ledger.currentOffsetMs();
  } else {
    mic?.arm();
    if (!live) playClueSimulated();
  }
}

function stopClueTimers() {
  clearTimeout(clueState.timer);
  if (clueState.raf) cancelAnimationFrame(clueState.raf);
  if (clueState.clockRaf) cancelAnimationFrame(clueState.clockRaf);
}

function endClueUnbuzzed() {
  stopClueTimers();
  clearCues();
  mic?.disarm();
  setLamp('idle');
  el.stage.dataset.live = 'false';
  el.pause.disabled = true;
  el.buzz.disabled = true;
  setStatus('you let the host finish');
  session.ledger.endTurn();
  showResult(session.resolve({ report: null, answer: null }));
  setTimeout(nextClue, 1400);
}

// The player buzzed. Onset is NOW: capture and hold the offset immediately.
// Speech onset from the microphone. This is the moment the player stopped
// listening, and it is the ONLY place the offset may be captured. The
// confirmation that follows must never re-read it.
function onMicOnset() {
  if (!clueState || clueState.buzzed || paused) return;
  playback.captureOnset();
  clueState.onsetHeld = true;
}

function onBuzz({ fromMic = false } = {}) {
  if (!clueState || clueState.buzzed || paused) return;
  clueState.buzzed = true;
  stopClueTimers();
  clearCues();
  mic?.disarm();
  el.pause.disabled = true;
  el.stage.dataset.live = 'false';

  // If the mic already captured at onset, keep that value. Capturing again
  // here would move it later, which is the whole bug this design avoids.
  if (!clueState.onsetHeld) playback.captureOnset();
  void fromMic;
  flash('buzz');
  sound.buzzer();
  setLamp('cut');
  el.buzz.disabled = true;
  setStatus('cut in — what is it?');

  // Local view of the split, from the words actually lit.
  clueState.localReport = {
    textSpoken: clueState.words.slice(0, clueState.spoken).join(' '),
    textRemaining: clueState.words.slice(clueState.spoken).join(' '),
  };

  if (live) {
    // Real interrupt, carrying the offset held at onset. Audio still queued
    // was never heard, so it is dropped rather than counted.
    playback.cut();
    live.interrupt(session.ledger.heldOffsetMs);
  }

  renderStrip(clueState.words, clueState.spoken, { cut: true });
  el.form.hidden = false;
  el.answer.value = '';
  el.answer.focus();
}

function submitAnswer(event) {
  event.preventDefault();
  if (!clueState?.localReport) return;

  try {
    session.buildInterruptMessage();
  } catch (err) {
    console.error('offset ledger refused the buzz:', err.message);
  }

  // Prefer the SERVER's split whenever it is present. It is absent in Early
  // Access, so live rounds currently fall back to the local view and say so.
  const serverReport = clueState.serverReport;
  const usingServerSplit = Boolean(serverReport?.hasTextSplit);
  const report = usingServerSplit ? serverReport : clueState.localReport;

  if (live && !usingServerSplit) {
    console.info(
      '[buzz-in] Scored from the local word strip. The server did not return ' +
        'text_spoken/text_remaining — that split is planned for GA. ' +
        'This score is an estimate, not the server\'s measurement.'
    );
  }

  const result = session.resolve({ report, answer: el.answer.value });
  result.usingServerSplit = usingServerSplit;
  el.form.hidden = true;

  if (result.outcome === OUTCOME.CORRECT) {
    sound.correct();
    sound.applause();
    flash('correct');
    slam();
    setStatus(SPOKEN_COPY.correct.toLowerCase());
  } else {
    sound.wrong();
    flash('wrong');
    setStatus('not this time');
  }
  showResult(result);
  session.ledger.endTurn();
  setTimeout(nextClue, 1600);
}

function showResult(result) {
  el.count.dataset.scored = result.points > 0 ? 'true' : 'false';
  countUpTo(session.total().total);
}

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
  el.stage.dataset.live = 'false';
  el.pause.disabled = true;
  mic?.disarm();
  el.buzz.disabled = true;
  el.start.disabled = false;
  el.start.textContent = 'PLAY AGAIN';
  live?.stop();
  live = null;
  const t = session.total();
  setStatus(`${t.total} words never said, ${t.correct} of ${t.clues} right`);
  el.challengeLink.hidden = false;
  el.challengeLink.href = challengePath(session.seed);
}

// ── Playback shim ────────────────────────────────────────────────────────

const playback = {
  device: null, ledger: null, sampleRate: 48000,

  attach(ledger, ctx) {
    this.ledger = ledger;
    if (!ctx) return;
    this.sampleRate = ctx.sampleRate;
    this.device = new DevicePlayback({ ledger, ctx });
    return this.device.start().catch(() => { this.device = null; });
  },

  advanceWords(n) {
    if (this.device && live) return;   // live audio feeds the ledger instead
    this.ledger.recordRenderedSamples((MS_PER_WORD / 1000) * this.sampleRate * n);
  },

  pushSamples(floats) { this.device?.push(floats); },
  captureOnset() { this.ledger.captureAtOnset(); },
  cut() { this.device?.flush(); },
};

// ── Wiring ───────────────────────────────────────────────────────────────

async function startRound() {
  sound.unlock();

  const seed = seedFromLocation();
  session = new GameSession({ seed });
  // An explicit host choice overrides the seeded one.
  if (chosenVoice) session.voice = chosenVoice;
  await playback.attach(session.ledger, sound.ctx);

  el.count.textContent = '0';
  el.count.dataset.scored = 'false';
  el.start.disabled = true;
  el.roundVal.textContent = session.seed.toString(36).toUpperCase();
  el.hostVal.textContent = session.voice;
  el.challengeLink.hidden = true;

  live = null;
  if (liveAvailable && !forceSim() && playback.device) {
    try {
      live = new LiveSpeech({ playback });
      live.onStarted = () => {
        // Where this clue's audio begins on the session-cumulative ledger.
        if (clueState) clueState.startOffsetMs = session.ledger.currentOffsetMs();
      };
      live.onFinished = () => { if (clueState) clueState.finished = true; };
      live.onReport = (msg) => {
        if (clueState) clueState.serverReport = shape.parseReport(msg);
      };
      live.onError = (m) => console.warn('[buzz-in] live speech:', m.reason || m.description);
      await live.connect();
      setStatus('here we go');
    } catch (err) {
      console.warn('[buzz-in] live speech unavailable, using the simulator:', err?.message);
      live = null;
    }
  }
  if (!live) setStatus('here we go');

  // The microphone: this is how you actually buzz in. Permission is requested
  // on this click, never on page load.
  if (!mic) {
    try {
      mic = new Mic();
      mic.onOnset = onMicOnset;
      mic.onBuzz = () => { el.heard.dataset.hot = 'true'; onBuzz({ fromMic: true }); };
      mic.onHeard = (t) => { el.heard.dataset.hot = 'false'; el.heard.textContent = t ? `"${t}"` : ''; };
      mic.onError = (r) => { console.warn('[buzz-in] mic:', r); el.heard.textContent = ''; };
      await mic.start();
      el.buzzHint.textContent = 'say "I know it", or press space';
    } catch (err) {
      console.warn('[buzz-in] microphone unavailable, keyboard only:', err?.message);
      el.buzzHint.textContent = 'press space (no microphone)';
      mic = null;
    }
  }

  playClue();
}

el.start.addEventListener('click', startRound);
el.buzz.addEventListener('click', () => onBuzz());
el.pause.addEventListener('click', togglePause);
el.voice.addEventListener('change', () => {
  chosenVoice = el.voice.value;
  localStorage.setItem('buzz-in.voice', chosenVoice);
  el.hostVal.textContent = chosenVoice;
  if (session) session.voice = chosenVoice;
});
el.form.addEventListener('submit', submitAnswer);

el.mute.addEventListener('click', () => {
  const next = el.mute.getAttribute('aria-pressed') !== 'true';
  el.mute.setAttribute('aria-pressed', String(next));
  el.mute.setAttribute('aria-label', next ? 'Unmute sound' : 'Mute sound');
  sound.unlock();
  sound.setMuted(next);
});

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  if (document.activeElement === el.answer) return;
  e.preventDefault();
  if (!el.buzz.disabled) onBuzz();
});

// Ask the server whether a live session is possible. The answer is a boolean;
// no credential ever reaches this page.
fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    liveAvailable = Boolean(h.speechConfigured);
    for (const v of h.voices || []) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      el.voice.append(opt);
    }
    if (chosenVoice && (h.voices || []).includes(chosenVoice)) el.voice.value = chosenVoice;
    else chosenVoice = el.voice.value || null;
    el.hostVal.textContent = chosenVoice || '\u2014';
    if (h.mic?.buzzWord) el.buzzHint.textContent = `say "${h.mic.buzzWord}", or press space`;
    setStatus(liveAvailable && !forceSim() ? 'standing by' : 'standing by, no voice');
  })
  .catch(() => { liveAvailable = false; });
