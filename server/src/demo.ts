import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Runs the whole platform on one machine without installing MongoDB or Docker:
 * an embedded MongoDB keeps its data in ./demo-data, the API and the built client
 * are served together on http://localhost:8080.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = path.resolve(here, '../..');
const dataDir = path.join(root, 'demo-data');
const dbDir = path.join(dataDir, 'db');
const clientDist = path.join(root, 'client', 'dist');
const port = Number(process.env.PORT ?? 8080);
const url = `http://localhost:${port}`;

function persistentSecret() {
  const file = path.join(dataDir, 'secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(48).toString('base64url');
  writeFileSync(file, secret);
  return secret;
}

function openBrowser() {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    /* the address is printed in the console anyway */
  }
}

async function main() {
  if (!existsSync(path.join(clientDist, 'index.html'))) {
    console.error('Клиент не собран. Запустите: npm run demo');
    process.exit(1);
  }
  mkdirSync(dbDir, { recursive: true });

  console.log('Запуск базы данных (при первом запуске MongoDB скачивается, это может занять несколько минут)…');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongo = await MongoMemoryServer.create({ instance: { dbPath: dbDir, storageEngine: 'wiredTiger' } });

  Object.assign(process.env, {
    NODE_ENV: 'development',
    MONGODB_URI: mongo.getUri('linguapath'),
    JWT_ACCESS_SECRET: persistentSecret(),
    CLIENT_ORIGIN: url,
    PUBLIC_APP_URL: url,
    COOKIE_SECURE: 'false',
    EXPOSE_DEV_LINKS: 'true',
    UPLOAD_DIR: path.join(dataDir, 'uploads'),
    LOG_LEVEL: 'warn',
  });

  const [{ default: express }, { createApp }, { connectDb, disconnectDb }, { User }] = await Promise.all([
    import('express'),
    import('./app'),
    import('./db'),
    import('./models/user'),
  ]);

  await connectDb(process.env.MONGODB_URI!);
  if (!(await User.exists({}))) {
    console.log('Первый запуск: загрузка курсов и демо-аккаунтов…');
    await disconnectDb();
    await new Promise<void>((resolve, reject) => {
      const seed = spawn(process.execPath, [require.resolve('tsx/cli'), path.join(here, 'seed', 'run.ts')], {
        env: process.env,
        stdio: 'inherit',
      });
      seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exited with ${code}`))));
    });
    await connectDb(process.env.MONGODB_URI!);
  }

  const app = express();
  app.use(express.static(clientDist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  app.use(createApp());

  const server = app.listen(port, () => {
    console.log('');
    console.log(`LinguaPath запущен: ${url}`);
    console.log('Учащийся: demo@linguapath.local / LinguaDemo2026');
    console.log('Администратор: admin@linguapath.local / LinguaAdmin2026');
    console.log('Чтобы остановить, закройте это окно или нажмите Ctrl+C.');
    openBrowser();
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    await mongo.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
