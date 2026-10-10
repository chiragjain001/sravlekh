const http = require('http');

const BASE_URL = 'http://localhost:4000/api/v1';

async function makeRequest(path, method = 'GET', token = null) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('AIOS DISTRIBUTED RATE LIMITING VALIDATION');
  console.log('====================================================\n');

  console.log('1. Testing Public Endpoint Rate Limiting (IP-keyed)...');
  // Send burst of requests to /health
  const results = await Promise.all(
    Array.from({ length: 30 }).map(() => makeRequest('/health'))
  );

  const statusCounts = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }
  console.log('  Health check burst (30 reqs) distribution:', statusCounts);

  console.log('\n2. Testing Authenticated Rate Limiting (User-keyed)...');
  const loginRes = await new Promise((resolve) => {
    const req = http.request(BASE_URL + '/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(JSON.stringify({ role: 'TEACHER' }));
    req.end();
  });

  const token = loginRes.accessToken;
  console.log('  Authenticated as TEACHER.');

  // Send burst to /auth/me
  const burstResults = await Promise.all(
    Array.from({ length: 50 }).map(() => makeRequest('/auth/me', 'GET', token))
  );

  const burstStatus = {};
  let sampleHeaders = null;
  for (const r of burstResults) {
    burstStatus[r.status] = (burstStatus[r.status] || 0) + 1;
    if (r.headers['x-ratelimit-limit']) sampleHeaders = r.headers;
  }
  console.log('  Authenticated burst (50 reqs) distribution:', burstStatus);
  if (sampleHeaders) {
    console.log('  RateLimit Headers:', {
      limit: sampleHeaders['x-ratelimit-limit'],
      remaining: sampleHeaders['x-ratelimit-remaining'],
      reset: sampleHeaders['x-ratelimit-reset']
    });
  }

  console.log('\n====================================================');
  console.log('RATE LIMITING VALIDATION COMPLETE');
  console.log('====================================================');
}

run().catch(console.error);
