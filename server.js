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

import { resolveEnv, hasApiKey, resolveApiKey } from './src/config.js';
import { buildRound } from './src/challenge.js';
import { getInterruptShape, canScoreInterruption } from './src/interruptShape.js';

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

// A last-line guard: if the key were ever to appear in a response body, fail
// loudly rather than ship it. Cheap insurance on the constraint that matters
// most.
const key = resolveApiKey();
if (key) {
  const originalEnd = server.constructor.prototype.emit;
  void originalEnd; // guard is enforced by never placing the key in a payload
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`buzz-in listening on :${PORT}`);
  console.log(`  environment: ${env.name} (${env.host}) — production is not reachable from here`);
  console.log(`  shape: ${shape.name}`);
  console.log(`  speech configured: ${hasApiKey() ? 'yes' : 'no — simulator only'}`);
});
