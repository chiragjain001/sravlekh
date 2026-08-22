// 13-TESTING-STRATEGY.md §8, scenario 2: "20 concurrent POST /papers/generate-ai
// calls; assert FastAPI queue does not starve and no request exceeds the 15s
// hard timeout without a clean 504."
//
// UNEXECUTED — see load-tests/README.md. Targets the AI Blueprint Agent
// (apps/api-python's /ai/generate-blueprint, called by apps/web's
// useGenerateBlueprintAI) — the actual compute-heavy AI-agent endpoint this
// scenario describes; no endpoint literally named /papers/generate-ai exists
// in this codebase (the closest REST-side match, /papers/generate, assembles
// an already-approved question bank rather than calling the AI agent).
import http from 'k6/http';
import { check } from 'k6';

const AI_BASE_URL = __ENV.AI_BASE_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export const options = {
  scenarios: {
    blueprint_burst: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 20,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // The service's own documented hard timeout is 15s — anything beyond that
    // must come back as a clean 504, never hang past it.
    http_req_duration: ['p(100)<15000'],
    http_req_failed: ['rate<0.05'], // a handful of 504s under burst is expected, not a failure
  },
};

export default function () {
  const payload = JSON.stringify({
    prompt: 'Create a 30-mark hard physics test on Kinematics and Laws of Motion.',
  });

  const res = http.post(`${AI_BASE_URL}/ai/generate-blueprint`, payload, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    timeout: '20s', // give the assertion room to see a real 504 rather than a client-side abort
  });

  check(res, {
    'never hangs past the 15s hard timeout without a clean 504': (r) =>
      r.status === 200 || (r.status === 504 && r.timings.duration < 16000),
  });
}
