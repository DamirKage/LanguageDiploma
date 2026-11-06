import cluster from 'node:cluster';
import os from 'node:os';
import { createApp } from './app';
import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { logger } from './lib/logger';

async function main() {
  await connectDb(config.mongoUri);
  const server = createApp().listen(config.port, () => logger.info(`API listening on :${config.port}`));
  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Node.js runs JavaScript on one core. With WEB_CONCURRENCY=N (or "auto" for one per core) the primary process forks
 * N identical workers that share the port, so a single machine uses all its cores; a crashed worker is replaced.
 */
const requested = process.env.WEB_CONCURRENCY;
const workers = requested === 'auto' ? (os.availableParallelism?.() ?? os.cpus().length) : Number(requested ?? 1) || 1;

if (workers > 1 && cluster.isPrimary) {
  logger.info(`Starting ${workers} worker processes`);
  for (let i = 0; i < workers; i++) cluster.fork();
  let stopping = false;
  cluster.on('exit', (worker, code) => {
    if (stopping) return;
    logger.warn({ pid: worker.process.pid, code }, 'Worker exited, starting a new one');
    cluster.fork();
  });
  const stop = () => {
    stopping = true;
    for (const w of Object.values(cluster.workers ?? {})) w?.process.kill('SIGTERM');
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} else {
  main().catch((err) => {
    logger.fatal({ err }, 'Failed to start');
    process.exit(1);
  });
}
