// Server-side speech session against staging /v2/speak.
//
// The browser never opens this connection and never sees the key. The browser
// talks to our own server over a plain WebSocket; this module is the only
// thing that holds credentials.
//
// Protocol as observed live against staging on 2026-08-11 (see FLAGS.md F-15
// for the two findings that differ from the spec this repo was written from):
//
//   ->  {"type":"Speak","text":"..."}
//   ->  {"type":"Flush"}
//   <-  {"type":"Connected","request_id":...,"model_name":...}
//   <-  {"type":"SpeechStarted","speech_id":"dg_sp_..."}
//   <-  binary frames: linear16 PCM at the requested sample rate
//   <-  {"type":"Flushed","speech_id":"..."}
//   ->  {"type":"Interrupt"}            <- NO FIELDS. Any field is rejected.
//   <-  {"type":"SpeechInterrupted","audio_played_ms":N,"metadata":{...}}

import WebSocket from 'ws';
import { resolveEnv, resolveApiKey } from './config.js';
import { getInterruptShape } from './interruptShape.js';

export const SAMPLE_RATE = 48000;
export const ENCODING = 'linear16';

export class SpeakSession {
  // Defaults to the live-observed Early Access shape. Set
  // BUZZ_IN_SPEAK_SHAPE=ga once the GA interrupt surface is live.
  constructor({
    voice,
    shape = getInterruptShape(process.env.BUZZ_IN_SPEAK_SHAPE || 'staging'),
    env = resolveEnv(),
  } = {}) {
    this.voice = voice;
    this.shape = shape;
    this.env = env;
    this.ws = null;
    this.speechId = null;
    this.handlers = { audio: () => {}, control: () => {}, close: () => {}, error: () => {} };
  }

  on(event, fn) {
    this.handlers[event] = fn;
    return this;
  }

  connect() {
    const key = resolveApiKey();
    if (!key) throw new Error('No staging key in the environment; refusing to open a session.');

    const url =
      `wss://${this.env.host}/v2/speak` +
      `?model=flux-${this.voice}-en&encoding=${ENCODING}&sample_rate=${SAMPLE_RATE}`;

    // The key travels only on this outbound header, server to service.
    this.ws = new WebSocket(url, { headers: { Authorization: `Token ${key}` } });

    this.ws.on('message', (data, isBinary) => {
      if (isBinary) return this.handlers.audio(data);
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === 'SpeechStarted') this.speechId = msg.speech_id;
      this.handlers.control(msg);
    });

    this.ws.on('error', (err) => this.handlers.error(err));
    this.ws.on('close', (code, reason) => this.handlers.close(code, String(reason)));

    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve(this));
      this.ws.once('error', reject);
    });
  }

  speak(text) {
    this._send({ type: 'Speak', text });
    this._send({ type: 'Flush' });
  }

  // A confirmed buzz. The message is built through the adapter, so which
  // fields travel is the shape's decision, not this method's. The Early
  // Access shape emits a field-free Interrupt; the GA shape emits
  // playback_offset. Sending an offset the server does not accept would be
  // rejected outright (MESSAGE-0000), which is exactly why this goes through
  // the adapter.
  interrupt(offsetMs = 0) {
    this._send(this.shape.buildInterrupt({ offsetMs: Math.max(0, Number(offsetMs) || 0) }));
  }

  _send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already closing */
    }
  }
}
