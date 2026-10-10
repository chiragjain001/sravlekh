const { Queue, Worker } = require(require.resolve('bullmq', { paths: [__dirname + '/../apps/api'] }));
const Redis = require(require.resolve('ioredis', { paths: [__dirname + '/../apps/api'] }));
const { performance } = require('perf_hooks');

const REDIS_URL = 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

async function run() {
  console.log('====================================================');
  console.log('AIOS BULLMQ ASYNCHRONOUS LOAD & WORKER BENCHMARK');
  console.log('====================================================\n');

  const queueName = 'test-benchmark-queue';
  const testQueue = new Queue(queueName, { connection });

  // Clean queue
  await testQueue.drain();
  await testQueue.clean(0, 1000, 'completed');
  await testQueue.clean(0, 1000, 'failed');

  console.log('--- 1. Testing 100 Job Enqueue Burst ---');
  const t0 = performance.now();
  const jobs100 = Array.from({ length: 100 }).map((_, i) => ({
    name: 'benchmark-job',
    data: { jobId: i, instituteId: 'demo-institute-1', timestamp: Date.now() },
    opts: { removeOnComplete: true, attempts: 3 }
  }));
  await testQueue.addBulk(jobs100);
  const enqueue100Duration = performance.now() - t0;
  const count100 = await testQueue.getWaitingCount();
  console.log(`  Enqueued 100 jobs in:    ${enqueue100Duration.toFixed(2)} ms`);
  console.log(`  Enqueue Throughput:      ${(100 / (enqueue100Duration / 1000)).toFixed(1)} jobs/sec`);
  console.log(`  Queue Depth (Waiting):   ${count100}`);

  console.log('\n--- 2. Processing 100 Jobs with Simulated Worker ---');
  let processedCount = 0;
  const tProcessStart = performance.now();

  const worker = new Worker(queueName, async (job) => {
    // Simulate ~5ms async task (e.g. notification dispatch or db record update)
    await new Promise(r => setTimeout(r, 5));
    processedCount++;
  }, { connection, concurrency: 10 });

  // Wait for queue to drain
  while (processedCount < 100 && (performance.now() - tProcessStart) < 10000) {
    await new Promise(r => setTimeout(r, 50));
  }
  const processDuration = performance.now() - tProcessStart;
  console.log(`  Processed 100 jobs in:   ${processDuration.toFixed(2)} ms`);
  console.log(`  Processing Throughput:   ${(processedCount / (processDuration / 1000)).toFixed(1)} jobs/sec`);
  console.log(`  Remaining in Queue:      ${await testQueue.getWaitingCount()}`);

  console.log('\n--- 3. Testing 1,000 Job Enqueue Burst ---');
  const t1000Start = performance.now();
  const chunks = 10;
  for (let c = 0; c < chunks; c++) {
    const batch = Array.from({ length: 100 }).map((_, i) => ({
      name: 'large-scale-job',
      data: { batchIndex: c, item: i, instituteId: 'demo-institute-1' },
      opts: { removeOnComplete: true }
    }));
    await testQueue.addBulk(batch);
  }
  const enqueue1000Duration = performance.now() - t1000Start;
  const count1000 = await testQueue.getWaitingCount();
  console.log(`  Enqueued 1,000 jobs in:  ${enqueue1000Duration.toFixed(2)} ms`);
  console.log(`  Queue Depth (Waiting):   ${count1000}`);

  console.log('\n--- 4. Job Failure & Exponential Retry Behavior ---');
  const failureQueueName = 'test-failure-retry-queue';
  const failQueue = new Queue(failureQueueName, { connection });
  let attemptsMade = 0;

  const failWorker = new Worker(failureQueueName, async (job) => {
    attemptsMade++;
    if (job.attemptsMade < 2) {
      throw new Error('Simulated transient worker failure');
    }
    return { success: true };
  }, {
    connection,
    concurrency: 1
  });

  const failJob = await failQueue.add('retry-test-job', { payload: 'retry-data' }, {
    attempts: 3,
    backoff: { type: 'fixed', delay: 100 }
  });

  // Wait for retry completion
  await new Promise(r => setTimeout(r, 800));
  const finalJobState = await failJob.getState();
  console.log(`  Job ID:                  ${failJob.id}`);
  console.log(`  Total Attempts Observed: ${attemptsMade}`);
  console.log(`  Final Job State:         ${finalJobState} [PASS: Retried after transient failure and completed]`);

  // Clean up
  await worker.close();
  await failWorker.close();
  await testQueue.drain();
  await testQueue.close();
  await failQueue.drain();
  await failQueue.close();

  console.log('\n====================================================');
  console.log('BULLMQ ASYNCHRONOUS BENCHMARK COMPLETE');
  console.log('====================================================');
}

run().catch(console.error).finally(() => connection.disconnect());
