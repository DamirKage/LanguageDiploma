import fs from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer | undefined;

export async function setup() {
  // Allows using a locally installed mongod when the binary cannot be downloaded.
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY;
  mongo = await MongoMemoryServer.create(systemBinary && fs.existsSync(systemBinary) ? { binary: { systemBinary } } : {});
  process.env.MONGODB_URI = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.RATE_LIMIT_ENABLED = 'false';
  process.env.EXPOSE_DEV_LINKS = 'true';
  process.env.DICTIONARY_ENABLED = 'false';
  process.env.UPLOAD_DIR = 'test-uploads';
}

export async function teardown() {
  await mongo?.stop();
  fs.rmSync('test-uploads', { recursive: true, force: true });
}
