// The server.
//
// The API key is held here and NEVER leaves. The browser never opens a speech
// session directly and never receives the key, not in a response body, not in
// a config object, not in a header.
//
// Every outbound call targets staging. src/config.js refuses production
// without a deliberate override.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { WebSocketServer } from 'ws';

import { resolveEnv, hasApiKey } from './src/config.js';
import { buildRound } from './src/challenge.js';
import { getInterruptShape, canScoreInterruption } from './src/interruptShape.js';
import { SpeakSession, SAMPLE_RATE, ENCODING } from './src/speakSession.js';
import { ListenSession, MIC_SAMPLE_RATE, matchesBuzzPhrase } from './src/listenSession.js';
import { ALLOWED_VOICES, BUZZ_WORD, BUZZ_PHRASES } from './src/copyRules.js';

const root = dirname(fileURLToPath(import.meta.url));
const env = resolveEnv();
const shape = getInterruptShape();
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

// Only these two directories are ever served. /src is served because the
// browser runs the same scoring modules the test suite does.
const SERVE_DIRS = ['public', 'src'];

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}

async function serveStatic(res, pathname) {
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const rel = clean === '/' ? '/public/index.html' : clean;
  const parts = rel.split('/').filter(Boolean);
  const dir = SERVE_DIRS.includes(parts[0]) ? parts[0] : 'public';
  const file = SERVE_DIRS.includes(parts[0]) ? parts.slice(1).join('/') : parts.join('/');
  const full = join(root, dir, file);

  if (!full.startsWith(join(root, dir))) return send(res, 403, 'Forbidden');

  try {
    const body = await readFile(full);
    send(res, 200, body, TYPES[extname(full)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({
      ok: true,
      environment: env.name,           // staging
      shape: shape.name,
      canScore: canScoreInterruption(shape),
      // Live speech is available when a key is configured. Note that
      // canScoreLive is FALSE against staging today: the SpeechInterrupted
      // report carries no text split. See FLAGS.md F-15.
      canScoreLive: canScoreInterruption(getInterruptShape('staging')),
      audio: { encoding: ENCODING, sampleRate: SAMPLE_RATE },
      mic: { sampleRate: MIC_SAMPLE_RATE, buzzWord: BUZZ_WORD },
      voices: ALLOWED_VOICES,
      // Whether a key is configured — never the key itself, not even a prefix.
      speechConfigured: hasApiKey(),
    }), TYPES['.json']);
  }

  if (url.pathname === '/api/round') {
    const round = buildRound(url.searchParams.get('seed') || 'buzz-in');
    return send(res, 200, JSON.stringify({
      seed: round.seed,
      voice: round.voice,
      clues: round.clues.map((c) => ({ id: c.id, kind: c.kind, category: c.category, text: c.text })),
    }), TYPES['.json']);
  }

  return serveStatic(res, url.pathname);
});

// ── Live speech proxy ───────────────────────────────────────────────────
//
// The browser opens a WebSocket to US. We open the staging session. The key
// never crosses this boundary — the browser sends only a voice name and the
// clue text, and receives only audio frames and control messages.

// Both sockets use noServer and share ONE upgrade handler. Attaching two
// WebSocketServer instances to the same HTTP server with `path` does not work:
// each installs its own 'upgrade' listener, and the first one to see a request
// for the other's path rejects it with a 400.
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (client) => {
  let session = null;

  const tell = (obj) => {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(obj));
  };

  client.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return tell({ type: 'ProxyError', reason: 'unparseable message' });
    }

    if (msg.type === 'start') {
      if (!hasApiKey()) return tell({ type: 'ProxyError', reason: 'no staging key configured' });
      // Only roster voices. A client cannot ask for a banned or arbitrary one.
      const voice = ALLOWED_VOICES.includes(msg.voice) ? msg.voice : ALLOWED_VOICES[0];
      try {
        session = new SpeakSession({ voice });
        session
          .on('audio', (buf) => {
            if (client.readyState === client.OPEN) client.send(buf, { binary: true });
          })
          .on('control', (m) => tell(m))
          .on('error', (e) => tell({ type: 'ProxyError', reason: e.message }))
          .on('close', () => tell({ type: 'SessionClosed' }));
        await session.connect();
        session.speak(String(msg.text || ''));
      } catch (err) {
        tell({ type: 'ProxyError', reason: err.message });
      }
      return;
    }

    // A confirmed buzz. The browser's held onset offset is passed through;
    // the adapter decides whether the active shape can carry it.
    if (msg.type === 'interrupt') return session?.interrupt(msg.offsetMs);
    if (msg.type === 'stop') return session?.close();
  });

  client.on('close', () => session?.close());
});

// ── Mic proxy ───────────────────────────────────────────────────────────
//
// The player's microphone audio comes to US as binary frames; we hold the
// credentials and open the listening session. Two events go back: onset, and
// a confirmed buzz. The browser decides nothing about what counts as a buzz.

const micWss = new WebSocketServer({ noServer: true });

micWss.on('connection', (client) => {
  let listen = null;
  let armed = false;         // only report a buzz while a clue is in play
  let onsetSent = false;

  const tell = (obj) => {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(obj));
  };

  client.on('message', async (raw, isBinary) => {
    if (isBinary) return listen?.sendAudio(raw);

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'start') {
      if (!hasApiKey()) return tell({ type: 'MicError', reason: 'no staging key configured' });
      try {
        listen = new ListenSession();
        listen
          .on('turn', (t) => {
            if (!armed) return;

            // Speech onset. This is the moment the player stopped listening.
            // Report it immediately; the browser captures and HOLDS the offset.
            if (t.event === 'StartOfTurn' && !onsetSent) {
              onsetSent = true;
              tell({ type: 'Onset' });
            }

            // Confirmation. Audio has kept playing since onset, which is why
            // the held value is the one that counts.
            if (matchesBuzzPhrase(t.transcript, BUZZ_PHRASES)) {
              armed = false;
              tell({ type: 'BuzzConfirmed', transcript: t.transcript });
            } else if (t.transcript) {
              tell({ type: 'Heard', transcript: t.transcript });
            }
          })
          .on('error', (e) => tell({ type: 'MicError', reason: e.message }))
          .on('close', () => tell({ type: 'MicClosed' }));
        await listen.connect();
        tell({ type: 'MicReady' });
      } catch (err) {
        tell({ type: 'MicError', reason: err.message });
      }
      return;
    }

    // A clue is playing: from here, speech counts as a buzz attempt.
    if (msg.type === 'arm') { armed = true; onsetSent = false; return; }
    if (msg.type === 'disarm') { armed = false; return; }
    if (msg.type === 'stop') return listen?.close();
  });

  client.on('close', () => listen?.close());
});

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (pathname === '/speak') {
    return wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  }
  if (pathname === '/listen') {
    return micWss.handleUpgrade(req, socket, head, (ws) => micWss.emit('connection', ws, req));
  }
  socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`buzz-in listening on :${PORT}`);
  console.log(`  environment: ${env.name} (${env.host}) — production is not reachable from here`);
  console.log(`  shape: ${shape.name}`);
  console.log(`  speech configured: ${hasApiKey() ? 'yes' : 'no — simulator only'}`);
});
