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
import { ALLOWED_VOICES } from './src/copyRules.js';

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

const wss = new WebSocketServer({ server, path: '/speak' });

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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`buzz-in listening on :${PORT}`);
  console.log(`  environment: ${env.name} (${env.host}) — production is not reachable from here`);
  console.log(`  shape: ${shape.name}`);
  console.log(`  speech configured: ${hasApiKey() ? 'yes' : 'no — simulator only'}`);
});
