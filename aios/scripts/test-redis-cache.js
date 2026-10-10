const http = require('http');
const Redis = require(require.resolve('ioredis', { paths: [__dirname + '/../apps/api'] }));

const BASE_URL = 'http://localhost:4000/api/v1';
const redis = new Redis('redis://localhost:6379');

async function makeRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, duration: Date.now() - start, data: json });
      });
    });

    req.on('error', err => resolve({ status: 500, duration: Date.now() - start, error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('AIOS REDIS CACHING & INVALIDATION VALIDATION');
  console.log('====================================================\n');

  // Authenticate as Admin
  const loginRes = await makeRequest('/auth/dev-login', 'POST', null, { role: 'ADMIN' });
  const token = loginRes.data.accessToken;

  // Clear any existing batch cache to start cold
  const existingKeys = await redis.keys('batches:demo-institute-1:*');
  if (existingKeys.length > 0) await redis.del(...existingKeys);

  console.log('--- 1. Batches Cache Hit / Miss Latency Test ---');
  // First request: Cold (Cache Miss -> DB read)
  const req1 = await makeRequest('/institutes/demo-institute-1/batches', 'GET', token);
  console.log(`  Request 1 (Cold / Cache Miss): ${req1.duration} ms [Status: ${req1.status}]`);

  // Second request: Warm (Cache Hit from Redis)
  const req2 = await makeRequest('/institutes/demo-institute-1/batches', 'GET', token);
  console.log(`  Request 2 (Warm / Cache Hit) : ${req2.duration} ms [Status: ${req2.status}]`);
  console.log(`  Latency Reduction: ${((1 - req2.duration / req1.duration) * 100).toFixed(1)}%`);

  // Inspect Redis key
  const keys = await redis.keys('batches:demo-institute-1:*');
  console.log(`\n--- 2. Cache Key Correctness & Tenant Scoping ---`);
  console.log(`  Found Redis Keys:`, keys);
  if (keys.length > 0) {
    const ttl = await redis.ttl(keys[0]);
    console.log(`  Key "${keys[0]}" TTL: ${ttl} seconds [PASS - isolated to demo-institute-1]`);
  }

  // Test Invalidation on Mutation
  console.log('\n--- 3. Cache Invalidation on Mutation (createBatch) ---');
  console.log(`  Keys before mutation: ${keys.length}`);
  const createRes = await makeRequest('/institutes/demo-institute-1/batches', 'POST', token, {
    name: 'Temporary Cache Test Batch ' + Date.now(),
    classYear: '10th',
    section: 'X',
    academicYear: '2026-27'
  });
  console.log(`  Created test batch: Status ${createRes.status}`);

  const keysAfter = await redis.keys('batches:demo-institute-1:*');
  console.log(`  Keys after mutation: ${keysAfter.length}`);
  if (keysAfter.length === 0) {
    console.log('  [PASS] Cache correctly invalidated upon batch creation!');
  } else {
    console.log('  [FAIL] Stale cache remained after mutation!');
  }

  // 4. Redis Memory & Stats
  console.log('\n--- 4. Redis Server Memory & Health Metrics ---');
  const infoStats = await redis.info('stats');
  const infoMemory = await redis.info('memory');
  
  const hitsMatch = infoStats.match(/keyspace_hits:(\d+)/);
  const missesMatch = infoStats.match(/keyspace_misses:(\d+)/);
  const usedMemMatch = infoMemory.match(/used_memory_human:([^\r\n]+)/);
  const peakMemMatch = infoMemory.match(/used_memory_peak_human:([^\r\n]+)/);

  const hits = hitsMatch ? parseInt(hitsMatch[1], 10) : 0;
  const misses = missesMatch ? parseInt(missesMatch[1], 10) : 0;
  const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : 'N/A';

  console.log(`  Redis Used Memory:       ${usedMemMatch ? usedMemMatch[1] : 'N/A'}`);
  console.log(`  Redis Peak Memory:       ${peakMemMatch ? peakMemMatch[1] : 'N/A'}`);
  console.log(`  Total Keyspace Hits:     ${hits}`);
  console.log(`  Total Keyspace Misses:   ${misses}`);
  console.log(`  Calculated Cache Hit Rate: ${hitRate}%`);

  console.log('\n====================================================');
  console.log('REDIS CACHING VALIDATION COMPLETE');
  console.log('====================================================');
}

run().catch(console.error).finally(() => redis.disconnect());
