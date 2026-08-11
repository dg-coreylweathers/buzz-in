// Environment resolution.
//
// HARD CONSTRAINT (GOAL.md): every call this build makes targets staging,
// never production. That is enforced here as a runtime guard rather than as a
// convention someone can forget. See DECISIONS.md D-11.

const HOSTS = {
  staging: 'api.staging.deepgram.com',
  production: 'api.deepgram.com',
};

export function resolveEnv(env = process.env) {
  const name = (env.BUZZ_IN_ENV || 'staging').toLowerCase();

  if (!HOSTS[name]) {
    throw new Error(
      `BUZZ_IN_ENV must be one of ${Object.keys(HOSTS).join(', ')} — got "${name}"`
    );
  }

  if (name === 'production' && env.BUZZ_IN_ALLOW_PROD !== '1') {
    throw new Error(
      'Refusing to target production. This build is staging-only; production ' +
        'cutover is a separate, deliberate step. Set BUZZ_IN_ALLOW_PROD=1 only ' +
        'if you genuinely mean it.'
    );
  }

  return { name, host: HOSTS[name] };
}

// The key is read server-side only and never returned to a browser.
// Staging key first: this build should not silently fall back to a key that
// might be a production key.
export function resolveApiKey(env = process.env) {
  return env.DEEPGRAM_STAGING_API_KEY || env.BUZZ_IN_API_KEY || null;
}

export function hasApiKey(env = process.env) {
  return Boolean(resolveApiKey(env));
}
