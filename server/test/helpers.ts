import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import type { AuthResponse } from '@slog/shared';
import { createApp } from '../src/app';
import { User } from '../src/models/user';
import { seedContent } from '../src/seed/content-seed';

export const app = createApp();

/** Each test file works in its own database with the full curriculum seeded. */
export function useTestDatabase(options: { seed?: boolean } = {}) {
  beforeAll(async () => {
    const uri = process.env.MONGODB_URI!;
    const dbName = `test_${Math.random().toString(36).slice(2, 10)}`;
    await mongoose.connect(uri, { dbName });
    await mongoose.connection.syncIndexes();
    if (options.seed !== false) await seedContent();
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

let counter = 0;

export async function registerUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  counter += 1;
  const body = {
    email: overrides.email ?? `user${counter}_${Date.now()}@example.com`,
    password: overrides.password ?? 'Secret123',
    name: overrides.name ?? 'Тестовый пользователь',
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const auth = res.body as AuthResponse;
  return { ...auth, email: body.email, password: body.password, auth: { Authorization: `Bearer ${auth.accessToken}` }, cookies: res.headers['set-cookie'] };
}

export async function registerAdmin() {
  const user = await registerUser();
  await User.updateOne({ _id: user.user.id }, { $set: { role: 'admin' } });
  return user;
}

export async function enroll(auth: Record<string, string>, language: string) {
  const res = await request(app).post('/api/me/enrollments').set(auth).send({ language });
  if (res.status !== 201) throw new Error(`enroll failed: ${res.status}`);
  return res.body;
}
