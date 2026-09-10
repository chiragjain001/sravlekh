'use strict';
/* Loads infra/staging/staging.env — the single source of staging configuration.
 *
 * Deliberately not dotenv: this file is also `source`d by bash, so it must stay
 * a plain KEY=VALUE file with no expansion, and the two loaders must agree on
 * what it means. A dependency here would also mean the guards could not run
 * before `pnpm install`.
 */
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, 'staging.env');
const EXAMPLE = path.join(__dirname, 'staging.env.example');

const CR = String.fromCharCode(13);

function loadStagingEnv({ required = [] } = {}) {
  if (!fs.existsSync(ENV_FILE)) {
    fail(
      `${ENV_FILE} not found.\n` +
        `  cp infra/staging/staging.env.example infra/staging/staging.env\n` +
        `  (template: ${EXAMPLE})`,
    );
  }

  const raw = fs.readFileSync(ENV_FILE, 'utf8');

  // run-stack.sh and run-smoke.sh `source` this file. bash does not strip CR, so
  // a Windows editor saving CRLF would give every value a trailing carriage
  // return — and the resulting failure ("localhost:5433\r is not in the
  // allowlist") reads like an allowlist problem rather than a line-ending one.
  // Say what it actually is.
  if (raw.includes(CR)) {
    fail(
      'infra/staging/staging.env has CRLF line endings.\n' +
        '  bash `source` keeps the carriage return, so every value would end in one.\n' +
        '  Re-save it with LF endings.',
    );
  }

  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }

  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    fail(
      `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} empty in infra/staging/staging.env.\n` +
        '  Staging targets are never defaulted — an unset value must stop the run, not fall back.',
    );
  }

  return env;
}

function fail(msg) {
  console.error(`\nREFUSING TO RUN: ${msg}\n`);
  process.exit(2);
}

module.exports = { ENV_FILE, loadStagingEnv, fail };
