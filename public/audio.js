// Sound design, synthesized at runtime with the Web Audio API.
//
// Everything here is oscillators, noise bursts, and simple envelopes. No
// sourced SFX pack, no sampled audio, and nothing imitating any recognizable
// existing game-show jingle — intervals used are generic (fifths, octaves) and
// no one owns those. See DECISIONS.md D-10 and FLAGS.md F-13.
//
// Nothing autoplays: the AudioContext is not created until the player's first
// gesture, so a page load makes no sound at all.

const CUES = ['buzzer', 'correct', 'wrong', 'tension', 'riser', 'tick'];

export class Sound {
  constructor() {
    this.ctx = null;
    this.bus = null;
    this.muted = localStorage.getItem('buzz-in.muted') === '1';
    this._live = new Set();      // cues currently in flight, so mute can kill them
  }

  // Called from a real player gesture — never on load.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = this.muted ? 0 : 0.7;
    this.bus.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('buzz-in.muted', muted ? '1' : '0');
    if (!this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(muted ? 0 : 0.7, t, 0.02);
    // Mute must also silence anything already in flight, not just what comes
    // next — a riser under a clue would otherwise keep running.
    if (muted) this.stopAll();
  }

  stopAll() {
    for (const stop of this._live) {
      try { stop(); } catch { /* already ended */ }
    }
    this._live.clear();
  }

  get ready() { return Boolean(this.ctx) && !this.muted; }

  _env(node, { attack = 0.005, decay = 0.18, peak = 1, at = 0 }) {
    const t = this.ctx.currentTime + at;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return t + attack + decay;
  }

  _tone({ type = 'sine', freq = 440, at = 0, decay = 0.18, peak = 0.4, detune = 0 }) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(gain).connect(this.bus);
    const end = this._env(gain, { decay, peak, at });
    const start = this.ctx.currentTime + at;
    osc.start(start);
    osc.stop(end + 0.05);
    this._track(osc, gain);
    return osc;
  }

  _noise({ at = 0, decay = 0.2, peak = 0.3, bandpass = null }) {
    const frames = Math.floor(this.ctx.sampleRate * (decay + 0.1));
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    let chain = src;
    if (bandpass) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = bandpass;
      filt.Q.value = 1.2;
      chain = src.connect(filt);
    }
    chain.connect(gain).connect(this.bus);
    const end = this._env(gain, { decay, peak, at, attack: 0.002 });
    src.start(this.ctx.currentTime + at);
    src.stop(end + 0.05);
    this._track(src, gain);
    return src;
  }

  _track(node, gain) {
    const stop = () => {
      try { node.stop(); } catch { /* fine */ }
      try { gain.disconnect(); } catch { /* fine */ }
    };
    this._live.add(stop);
    node.addEventListener?.('ended', () => this._live.delete(stop));
  }

  // ── The cues ───────────────────────────────────────────────────────────

  // The buzz itself: a hard, square-wave buzzer, deliberately unlike any voice.
  buzzer() {
    if (!this.ready) return;
    this._tone({ type: 'square', freq: 138, decay: 0.34, peak: 0.30 });
    this._tone({ type: 'square', freq: 92, decay: 0.34, peak: 0.24, detune: -8 });
    this._noise({ decay: 0.10, peak: 0.10, bandpass: 900 });
  }

  // Correct: a rising two-note figure, an octave apart. Lands on the count.
  correct() {
    if (!this.ready) return;
    this._tone({ type: 'triangle', freq: 660, decay: 0.16, peak: 0.34, at: 0 });
    this._tone({ type: 'triangle', freq: 1320, decay: 0.30, peak: 0.28, at: 0.11 });
    this._tone({ type: 'sine', freq: 1980, decay: 0.34, peak: 0.10, at: 0.11 });
  }

  // Wrong: a falling minor second, dry and short. No malice, just no.
  wrong() {
    if (!this.ready) return;
    this._tone({ type: 'sawtooth', freq: 210, decay: 0.22, peak: 0.24, at: 0 });
    this._tone({ type: 'sawtooth', freq: 156, decay: 0.42, peak: 0.22, at: 0.13 });
  }

  // Tension, under a reversal clue: a low pulsing fifth that sits beneath the
  // voice rather than competing with it. Returns a stop handle.
  tension() {
    if (!this.ready) return () => {};
    const osc = this.ctx.createOscillator();
    const fifth = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = 'sine'; osc.frequency.value = 55;
    fifth.type = 'sine'; fifth.frequency.value = 82.5;
    lfo.type = 'sine'; lfo.frequency.value = 2.6;
    lfoGain.gain.value = 0.045;

    gain.gain.value = 0.0001;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain); fifth.connect(gain);
    gain.connect(this.bus);

    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.075, t + 0.6);

    osc.start(t); fifth.start(t); lfo.start(t);

    const stop = () => {
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.08);
      osc.stop(now + 0.4); fifth.stop(now + 0.4); lfo.stop(now + 0.4);
      this._live.delete(stop);
    };
    this._live.add(stop);
    return stop;
  }

  // The clue is about to run out with no buzz: a rising riser. Resolves
  // cleanly if a buzz cuts it off.
  riser(seconds = 2.4) {
    if (!this.ready) return () => {};
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + seconds);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + seconds * 0.85);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.2);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 2400;
    osc.connect(filt).connect(gain).connect(this.bus);
    osc.start(t);
    osc.stop(t + seconds + 0.3);

    const stop = () => {
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.04);
      try { osc.stop(now + 0.15); } catch { /* already stopped */ }
      this._live.delete(stop);
    };
    this._live.add(stop);
    return stop;
  }

  // A small, satisfying tick, timed to the word-strike animation so the
  // count-up has an audio partner instead of playing silently.
  tick(index = 0) {
    if (!this.ready) return;
    this._tone({ type: 'square', freq: 1500 + (index % 5) * 40, decay: 0.035, peak: 0.075 });
  }
}

export const CUE_NAMES = CUES;
