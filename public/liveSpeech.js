// Live speech, through our own server, from staging.
//
// The browser never holds a key and never opens a session against the service
// directly. It opens a WebSocket to this app's own server, which holds the
// credentials and proxies.
//
// Audio arrives as linear16 PCM at 48kHz. It is converted to float samples and
// handed to the output worklet, which is what advances the offset ledger — so
// the offset still reflects audio the device actually rendered, exactly as in
// simulator mode. That property does not change between transports.

const SAMPLE_RATE = 48000;

export class LiveSpeech {
  constructor({ playback }) {
    this.playback = playback;
    this.ws = null;
    this.onStarted = () => {};
    this.onReport = () => {};
    this.onFinished = () => {};
    this.onError = () => {};
    this.speechId = null;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/speak`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) return this._audio(event.data);

      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'SpeechStarted') {
        this.speechId = msg.speech_id;
        this.onStarted(msg);
      }
      if (msg.type === 'SpeechInterrupted') this.onReport(msg);
      if (msg.type === 'SpeechMetadata' || msg.type === 'Flushed') this.onFinished(msg);
      if (msg.type === 'ProxyError' || msg.type === 'Error') this.onError(msg);
    });

    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(this), { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  // linear16 -> float32, then into the worklet. Only what the worklet renders
  // reaches the ledger; anything still queued when a buzz lands is discarded.
  _audio(buffer) {
    const pcm = new Int16Array(buffer);
    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768;
    this.playback.pushSamples(floats);
  }

  speak(voice, text) {
    this._send({ type: 'start', voice, text });
  }

  // A confirmed buzz. The offset held at onset is handed to the server, which
  // decides whether the active shape can carry it: Early Access rejects every
  // field on Interrupt, GA takes it as `playback_offset` and only returns the
  // text split when it is present. The plumbing is the same either way, so
  // nothing here changes when GA lands.
  interrupt(heldOffsetMs) {
    this._send({ type: 'interrupt', offsetMs: heldOffsetMs });
  }

  stop() {
    this._send({ type: 'stop' });
    try {
      this.ws?.close();
    } catch {
      /* already closing */
    }
  }

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
}

export const LIVE_SAMPLE_RATE = SAMPLE_RATE;
