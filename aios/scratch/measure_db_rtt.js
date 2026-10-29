const { PrismaClient } = require('@prisma/client');
const net = require('net');
const { performance } = require('perf_hooks');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Network RTT vs Internal Query Execution ---');
  const tcpTimes = [];
  for (let i = 0; i < 15; i++) {
    const t0 = performance.now();
    await new Promise((res) => {
      const s = net.createConnection({ host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543 }, () => {
        tcpTimes.push(performance.now() - t0);
        s.destroy();
        res();
      });
      s.on('error', () => res());
    });
  }

  const sqlTimes = [];
  for (let i = 0; i < 15; i++) {
    const t0 = performance.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    sqlTimes.push(performance.now() - t0);
  }

  const explainResult = await prisma.$queryRawUnsafe('EXPLAIN ANALYZE SELECT * FROM institutes LIMIT 5');

  tcpTimes.sort((a, b) => a - b);
  sqlTimes.sort((a, b) => a - b);

  console.log('TCP Connect to Mumbai (15 samples):');
  console.log('  Min:', tcpTimes[0].toFixed(2), 'ms | P50:', tcpTimes[Math.floor(tcpTimes.length * 0.5)].toFixed(2), 'ms | P95:', tcpTimes[Math.floor(tcpTimes.length * 0.95)].toFixed(2), 'ms');
  console.log('SQL SELECT 1 Round-Trip over TLS connection (15 samples):');
  console.log('  Min:', sqlTimes[0].toFixed(2), 'ms | P50:', sqlTimes[Math.floor(sqlTimes.length * 0.5)].toFixed(2), 'ms | P95:', sqlTimes[Math.floor(sqlTimes.length * 0.95)].toFixed(2), 'ms');
  console.log('PostgreSQL EXPLAIN ANALYZE Internal Execution Plan:');
  for (const row of explainResult) {
    console.log(' ', row['QUERY PLAN']);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
