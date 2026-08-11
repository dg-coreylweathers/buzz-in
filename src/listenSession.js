// Server-side listening session against staging /v2/listen.
//
// This is the half of the loop that makes the game honest. The player buzzes
// in by SPEAKING, and two separate moments come out of this stream:
//
//   StartOfTurn  -> speech onset. Capture the playback offset NOW and hold it.
//   transcript   -> confirmation. Only now do we know it was a real buzz and
//                   not a cough, and by then audio has kept playing.
//
// The gap between those two is the entire argument the product makes. If the
// offset were read at confirmation instead of onset, every score would be
// about a word too high.
//
// Protocol observed live against staging 2026-08-11:
//   <- {"type":"Connected","request_id":...}
//   <- {"type":"TurnInfo","event":"StartOfTurn"|"Update"|"EndOfTurn",
//        "transcript":"...","words":[...],"end_of_turn_confidence":N}

import WebSocket from 'ws';
import { resolveEnv, resolveApiKey } from './config.js';

export const MIC_SAMPLE_RATE = 16000;
export const MIC_ENCODING = 'linear16';
export const STT_MODEL = 'flux-general-en';

export class ListenSession {
  constructor({ env = resolveEnv() } = {}) {
    this.env = env;
    this.ws = null;
    this.handlers = { turn: () => {}, error: () => {}, close: () => {} };
  }

  on(event, fn) {
    this.handlers[event] = fn;
    return this;
  }

  connect() {
    const key = resolveApiKey();
    if (!key) throw new Error('No staging key in the environment; refusing to open a session.');

    const url =
      `wss://${this.env.host}/v2/listen` +
      `?model=${STT_MODEL}&encoding=${MIC_ENCODING}&sample_rate=${MIC_SAMPLE_RATE}`;

    this.ws = new WebSocket(url, { headers: { Authorization: `Token ${key}` } });

    this.ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === 'TurnInfo') this.handlers.turn(msg);
    });

    this.ws.on('error', (err) => this.handlers.error(err));
    this.ws.on('close', (code, reason) => this.handlers.close(code, String(reason)));

    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve(this));
      this.ws.once('error', reject);
    });
  }

  // Raw linear16 frames from the player's microphone.
  sendAudio(chunk) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(chunk, { binary: true });
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already closing */
    }
  }
}

// Did the player say the buzz phrase?
//
// Deliberately strict. A false positive scores the player for words they
// actually heard, which is worse than a missed buzz they can retry.
export function matchesBuzzPhrase(transcript, phrases) {
  const clean = String(transcript || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return false;
  return phrases.some((p) => clean.includes(p));
}
