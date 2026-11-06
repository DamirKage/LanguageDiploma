import { createRequire } from 'node:module';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import bcrypt from 'bcryptjs';

/**
 * Password hashing off the main thread.
 *
 * bcrypt is deliberately slow (~0.2–0.3 s per hash at cost 12). The bcryptjs implementation is pure JavaScript, so on
 * the main thread every sign-in would stall all other requests for that long; a class of students signing in at
 * the start of a lesson would freeze the server. Hashes are therefore computed in a small pool of worker threads,
 * one per spare CPU core, and the event loop stays free for the rest of the API.
 */

type Job = { op: 'hash'; password: string; rounds: number } | { op: 'compare'; password: string; hash: string };
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

const require = createRequire(import.meta.url);
const WORKER_SOURCE = `
const { parentPort } = require('node:worker_threads');
const bcrypt = require(${JSON.stringify(require.resolve('bcryptjs'))});
parentPort.on('message', async ({ id, job }) => {
  try {
    const result = job.op === 'hash' ? await bcrypt.hash(job.password, job.rounds) : await bcrypt.compare(job.password, job.hash);
    parentPort.postMessage({ id, result });
  } catch (err) {
    parentPort.postMessage({ id, error: String(err && err.message || err) });
  }
});
`;

const POOL_SIZE = Math.max(1, Math.min(4, (os.availableParallelism?.() ?? os.cpus().length) - 1));
const workers: Array<{ worker: Worker; busy: number }> = [];
const pending = new Map<number, Pending>();
let nextId = 1;
let disabled = false;

function spawn() {
  const worker = new Worker(WORKER_SOURCE, { eval: true });
  const slot = { worker, busy: 0 };
  worker.unref();
  worker.on('message', ({ id, result, error }: { id: number; result?: unknown; error?: string }) => {
    slot.busy--;
    const p = pending.get(id);
    pending.delete(id);
    if (error) p?.reject(new Error(error));
    else p?.resolve(result);
  });
  worker.on('error', () => {
    // A broken pool must not break sign-in: fall back to hashing on the main thread.
    disabled = true;
  });
  workers.push(slot);
  return slot;
}

function run<T>(job: Job): Promise<T> {
  if (disabled) {
    return (job.op === 'hash' ? bcrypt.hash(job.password, job.rounds) : bcrypt.compare(job.password, job.hash)) as Promise<T>;
  }
  if (workers.length < POOL_SIZE) spawn();
  const slot = workers.reduce((a, b) => (b.busy < a.busy ? b : a));
  slot.busy++;
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    slot.worker.postMessage({ id, job });
  });
}

export const hashPassword = (password: string, rounds: number) => run<string>({ op: 'hash', password, rounds });
export const verifyPassword = (password: string, hash: string) => run<boolean>({ op: 'compare', password, hash });
