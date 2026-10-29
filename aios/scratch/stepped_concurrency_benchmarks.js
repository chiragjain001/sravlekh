const http = require('http');
const { performance } = require('perf_hooks');

const API_BASE = 'http://127.0.0.1:4000/api/v1';

async function postJson(url, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.status, data: JSON.parse(body) }); }
        catch { resolve({ status: res.status, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.status, data: JSON.parse(body) }); }
        catch { resolve({ status: res.status, data: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function stats(latencies) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    min: sorted[0].toFixed(2),
    p50: sorted[Math.floor(sorted.length * 0.50)].toFixed(2),
    p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
    p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(2),
    max: sorted[sorted.length - 1].toFixed(2),
    avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
  };
}

async function runConcurrencyStep(name, fn, concurrency, totalRequests) {
  const latencies = [];
  let errors = 0;
  const startTotal = performance.now();

  let completed = 0;
  let inFlight = 0;
  let dispatched = 0;

  await new Promise((resolve) => {
    function launchNext() {
      while (inFlight < concurrency && dispatched < totalRequests) {
        dispatched++;
        inFlight++;
        const t0 = performance.now();
        fn()
          .then(res => {
            const duration = performance.now() - t0;
            latencies.push(duration);
            if (res.status >= 400 && res.status !== 404) errors++;
          })
          .catch(() => {
            errors++;
          })
          .finally(() => {
            inFlight--;
            completed++;
            if (completed === totalRequests) resolve();
            else launchNext();
          });
      }
    }
    launchNext();
  });

  const totalTime = (performance.now() - startTotal) / 1000;
  const s = stats(latencies);
  const throughput = (totalRequests / totalTime).toFixed(1);

  console.log(`[${name}] Concurrency: ${concurrency} users | Total Req: ${totalRequests}`);
  console.log(`  P50: ${s.p50}ms | P95: ${s.p95}ms | P99: ${s.p99}ms | Avg: ${s.avg}ms`);
  console.log(`  Throughput: ${throughput} req/s | Errors: ${errors}/${totalRequests} (${((errors/totalRequests)*100).toFixed(1)}%) | Elapsed: ${totalTime.toFixed(2)}s\n`);

  return { concurrency, totalRequests, ...s, throughput, errors, errorRate: ((errors/totalRequests)*100).toFixed(1) };
}

async function main() {
  console.log('========================================================================');
  console.log('AIOS STEPPED CONCURRENCY & LATENCY BENCHMARK SUITE');
  console.log('========================================================================\n');

  // Authenticate admin
  const loginRes = await postJson(`${API_BASE}/auth/dev-login`, { role: 'ADMIN' });
  const token = loginRes.data.accessToken;
  console.log('Authenticated Admin Token obtained.\n');

  const concurrencyLevels = [1, 10, 25, 50];
  const summaryReport = {};

  // 1. Cold Cache Baseline
  console.log('--- 1. Cold Cache vs Warm Cache Benchmarks (/exams) ---');
  // First request is cold cache
  const coldStart = performance.now();
  const coldRes = await getJson(`${API_BASE}/institutes/demo-institute-1/exams`, token);
  const coldLatency = (performance.now() - coldStart).toFixed(2);
  console.log(`Cold Cache Single Request Latency: ${coldLatency}ms (Status: ${coldRes.status})\n`);

  const examWarmResults = [];
  for (const c of concurrencyLevels) {
    const total = c === 1 ? 20 : (c * 2);
    const r = await runConcurrencyStep('Warm Cache Exams List', () => getJson(`${API_BASE}/institutes/demo-institute-1/exams`, token), c, total);
    examWarmResults.push(r);
  }
  summaryReport.exams = { coldLatency, warm: examWarmResults };

  // 2. Students Stats (Cached vs Uncached)
  console.log('--- 2. Students Stats (/students/stats) ---');
  const coldStatsStart = performance.now();
  const coldStatsRes = await getJson(`${API_BASE}/institutes/demo-institute-1/students/stats`, token);
  const coldStatsLatency = (performance.now() - coldStatsStart).toFixed(2);
  console.log(`Cold Cache Students Stats Latency: ${coldStatsLatency}ms (Status: ${coldStatsRes.status})\n`);

  const studentStatsResults = [];
  for (const c of concurrencyLevels) {
    const total = c === 1 ? 20 : (c * 2);
    const r = await runConcurrencyStep('Warm Cache Students Stats', () => getJson(`${API_BASE}/institutes/demo-institute-1/students/stats`, token), c, total);
    studentStatsResults.push(r);
  }
  summaryReport.studentsStats = { coldLatency: coldStatsLatency, warm: studentStatsResults };

  // 3. Python Service Health & Direct Throughput
  console.log('--- 3. Python Service Direct Concurrency (/health) ---');
  const pyResults = [];
  for (const c of concurrencyLevels) {
    const total = c === 1 ? 20 : (c * 2);
    const r = await runConcurrencyStep('Python Health Direct', () => getJson('http://127.0.0.1:8000/health'), c, total);
    pyResults.push(r);
  }
  summaryReport.pythonHealth = pyResults;

  console.log('========================================================================');
  console.log('STEPPED CONCURRENCY BENCHMARK COMPLETE');
  console.log('========================================================================');
  console.log(JSON.stringify(summaryReport, null, 2));
}

main().catch(console.error);
