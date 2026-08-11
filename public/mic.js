// The player's microphone.
//
// Captures at the device's native rate, downsamples to 16kHz linear16, and
// streams it to our own server, which holds the credentials and opens the
// listening session. No key is ever present in this file or reachable from it.
//
// Echo cancellation is on, and it matters here more than usual: the host's
// voice is coming out of the speakers while the mic is open. That is also why
// the buzz phrase never appears inside clue text. If the host said it, the
// player's own microphone would hear it and buzz them in.

const TARGET_RATE = 16000;

const CAPTURE_WORKLET = `
class MicCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / options.processorOptions.targetRate;
    this.acc = 0;
    this.buf = [];
  }
  process(inputs, outputs) {
    const input = inputs[0][0];
    if (!input) return true;
    // Pass silence downstream: the node stays in the graph, nothing is heard.
    const silence = outputs[0] && outputs[0][0];
    if (silence) silence.fill(0);
    // Linear decimation to the target rate. Good enough for speech, and it
    // keeps the work off the main thread.
    for (let i = 0; i < input.length; i++) {
      this.acc += 1;
      if (this.acc >= this.ratio) {
        this.acc -= this.ratio;
        this.buf.push(input[i]);
      }
    }
    if (this.buf.length >= 320) {
      const out = new Int16Array(this.buf.length);
      for (let i = 0; i < this.buf.length; i++) {
        const s = Math.max(-1, Math.min(1, this.buf[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(out, [out.buffer]);
      this.buf = [];
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;

export class Mic {
  constructor() {
    this.ws = null;
    this.stream = null;
    this.ctx = null;
    this.node = null;
    this.onOnset = () => {};
    this.onBuzz = () => {};
    this.onHeard = () => {};
    this.onError = () => {};
    this.ready = false;
    this.framesSent = 0;   // so a silent mic is diagnosable rather than mysterious
  }

  async start() {
    // The browser will prompt for permission here. Nothing listens before it.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/listen`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'MicReady') this.ready = true;
      if (msg.type === 'Onset') this.onOnset();
      if (msg.type === 'BuzzConfirmed') this.onBuzz(msg.transcript);
      if (msg.type === 'Heard') this.onHeard(msg.transcript);
      if (msg.type === 'MicError') this.onError(msg.reason);
    });

    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.send(JSON.stringify({ type: 'start' }));

    // A separate context from playback: the mic runs at its own rate.
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const blob = new Blob([CAPTURE_WORKLET], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'mic-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { targetRate: TARGET_RATE },
    });
    this.node.port.onmessage = (e) => {
      this.framesSent += e.data.length;
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(e.data);
    };

    // A worklet whose output goes nowhere is not guaranteed to be pulled by
    // the audio graph, and then process() never runs and no audio is ever
    // captured. Route it to the destination through a silent gain so the
    // graph keeps it alive without anything being audible.
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    source.connect(this.node);
    this.node.connect(silent).connect(this.ctx.destination);
    return this;
  }

  // Only count speech as a buzz attempt while a clue is actually playing.
  arm() { this._send({ type: 'arm' }); }
  disarm() { this._send({ type: 'disarm' }); }

  stop() {
    this._send({ type: 'stop' });
    try { this.ws?.close(); } catch { /* closing */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    try { this.ctx?.close(); } catch { /* closing */ }
    this.ready = false;
  }

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
}

export const MIC_TARGET_RATE = TARGET_RATE;
