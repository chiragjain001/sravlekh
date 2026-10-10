const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PrismaClient } = require('../packages/db/node_modules/@prisma/client');

const k6Bin = path.join(__dirname, '..', 'load-tests', 'k6-v0.54.0-windows-amd64', 'k6.exe');
const prisma = new PrismaClient();

const stages = [
  { vus: 25, duration: '20s', label: '25 VUs (Baseline Load)' },
  { vus: 50, duration: '25s', label: '50 VUs (Normal Institute Load)' },
  { vus: 100, duration: '30s', label: '100 VUs (Peak Exam Start)' },
  { vus: 150, duration: '30s', label: '150 VUs (Saturation Boundary)' },
  { vus: 200, duration: '25s', label: '200 VUs (Stress / Breaking Limit)' }
];

async function measureDbLatency() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Date.now() - t0;
  } catch (e) {
    return -1;
  }
}

async function runBenchmark() {
  console.log('====================================================');
  console.log('STEPPED CAPACITY & DEGRADATION BENCHMARK (k6)');
  console.log('====================================================\n');

  const matrix = [];

  for (const stage of stages) {
    console.log(`\n>>> Testing Stage: ${stage.label} (${stage.vus} VUs for ${stage.duration})`);

    const dbLatencyBefore = await measureDbLatency();
    const freeMemBeforeMb = Math.round(os.freemem() / 1024 / 1024);
    const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);

    const scriptPath = path.join(__dirname, '..', 'load-tests', 'realistic-workloads.js');
    const summaryFile = path.join(__dirname, `summary_${stage.vus}vu.json`);

    // Override stages in options via environment/cli
    const cmd = `"${k6Bin}" run --vus ${stage.vus} --duration ${stage.duration} --summary-export="${summaryFile}" "${scriptPath}"`;

    let stdout = '';
    let success = true;
    const tStart = Date.now();

    try {
      stdout = execSync(cmd, { encoding: 'utf8', timeout: 120000 });
    } catch (err) {
      success = false;
      stdout = err.stdout ? err.stdout.toString() : err.message;
      console.log(`  k6 exited with non-zero code (threshold breached or errors occurred)`);
    }

    const durationSec = Math.round((Date.now() - tStart) / 1000);
    const dbLatencyAfter = await measureDbLatency();
    const freeMemAfterMb = Math.round(os.freemem() / 1024 / 1024);

    let summaryData = null;
    if (fs.existsSync(summaryFile)) {
      try {
        summaryData = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
      } catch (e) {}
    }

    const httpReqs = summaryData?.metrics?.http_reqs?.values?.count || 0;
    const rate = summaryData?.metrics?.http_reqs?.values?.rate || 0;
    const p50 = summaryData?.metrics?.http_req_duration?.values?.['p(50)'] || 0;
    const p90 = summaryData?.metrics?.http_req_duration?.values?.['p(90)'] || 0;
    const p95 = summaryData?.metrics?.http_req_duration?.values?.['p(95)'] || 0;
    const p99 = summaryData?.metrics?.http_req_duration?.values?.['p(99)'] || 0;
    const max = summaryData?.metrics?.http_req_duration?.values?.max || 0;
    const failRate = (summaryData?.metrics?.http_req_failed?.values?.rate || 0) * 100;
    const errRate = (summaryData?.metrics?.realistic_error_rate?.values?.rate || 0) * 100;

    const row = {
      vus: stage.vus,
      label: stage.label,
      duration: stage.duration,
      totalRequests: httpReqs,
      throughputRps: Math.round(rate * 10) / 10,
      p50Ms: Math.round(p50),
      p90Ms: Math.round(p90),
      p95Ms: Math.round(p95),
      p99Ms: Math.round(p99),
      maxLatencyMs: Math.round(max),
      httpFailRatePct: Math.round(failRate * 100) / 100,
      roleErrorRatePct: Math.round(errRate * 100) / 100,
      dbLatencyMs: dbLatencyAfter,
      ramUsageMb: totalMemMb - freeMemAfterMb,
      status: failRate < 1.0 && p95 < 4000 ? 'SAFE' : (failRate < 5.0 ? 'DEGRADED' : 'SATURATED')
    };

    console.log(`  Requests: ${row.totalRequests} | Throughput: ${row.throughputRps} req/s`);
    console.log(`  p50: ${row.p50Ms}ms | p90: ${row.p90Ms}ms | p95: ${row.p95Ms}ms | p99: ${row.p99Ms}ms | Max: ${row.maxLatencyMs}ms`);
    console.log(`  HTTP Failures: ${row.httpFailRatePct}% | Role Errors: ${row.roleErrorRatePct}% | DB Latency: ${row.dbLatencyMs}ms`);
    console.log(`  Stage Status: [${row.status}]`);

    matrix.push(row);

    // If saturation causes severe failure (>20% errors), stop further escalation to protect DB
    if (row.httpFailRatePct > 20) {
      console.log('\n[STOPPING ESCALATION]: System has reached hard failure saturation limit.');
      break;
    }

    // Cooling pause between stages
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log('\n====================================================');
  console.log('FINAL STEPPED CAPACITY RESULTS MATRIX');
  console.log('====================================================');
  console.table(matrix);

  fs.writeFileSync(path.join(__dirname, 'capacity-matrix-results.json'), JSON.stringify(matrix, null, 2));
  await prisma.$disconnect();
}

runBenchmark().catch(err => {
  console.error('Fatal Benchmark Error:', err);
  prisma.$disconnect();
});
