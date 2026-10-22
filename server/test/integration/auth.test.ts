import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RefreshToken, User } from '../../src/models/user';
import { app, registerUser, useTestDatabase } from '../helpers';

useTestDatabase({ seed: false });

function refreshCookie(setCookie: string[] | string | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = list.find((c) => c.startsWith('slog_rt='));
  if (!cookie) throw new Error('no refresh cookie');
  return cookie.split(';')[0]!;
}

describe('registration and login', () => {
  it('registers a user, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'Aliya@Example.com', password: 'Secret123', name: 'Алия' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'aliya@example.com', name: 'Алия', role: 'user', onboarded: false });
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('slog_rt='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('stores only a bcrypt hash of the password', async () => {
    const user = await User.findOne({ email: 'aliya@example.com' }).select('+passwordHash').lean();
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user!.passwordHash).not.toContain('Secret123');
  });

  it('rejects duplicate emails, weak passwords and invalid input', async () => {
    const dup = await request(app).post('/api/auth/register').send({ email: 'aliya@example.com', password: 'Secret123', name: 'X' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('email_taken');
    const weak = await request(app).post('/api/auth/register').send({ email: 'weak@example.com', password: 'password', name: 'X' });
    expect(weak.body.error.code).toBe('weak_password');
    const invalid = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'Secret123' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_failed');
    expect(invalid.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['body.email', 'body.name']));
  });

  it('logs in with correct credentials and gives the same error for unknown email and wrong password', async () => {
    const ok = await request(app).post('/api/auth/login').send({ email: 'ALIYA@example.com', password: 'Secret123' });
    expect(ok.status).toBe(200);
    const wrong = await request(app).post('/api/auth/login').send({ email: 'aliya@example.com', password: 'Wrong1234' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('blocks a login for a blocked account', async () => {
    const u = await registerUser();
    await User.updateOne({ email: u.email }, { $set: { isBlocked: true } });
    const res = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_blocked');
  });
});

describe('protected endpoints', () => {
  it('require a valid bearer token', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).get('/api/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const u = await registerUser();
    const me = await request(app).get('/api/me').set(u.auth);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(u.email);
  });

  it('stop accepting the token of a user who gets blocked', async () => {
    const u = await registerUser();
    await User.updateOne({ email: u.email }, { $set: { isBlocked: true } });
    expect((await request(app).get('/api/me').set(u.auth)).status).toBe(403);
  });
});

describe('refresh token rotation', () => {
  it('requires the anti-CSRF header', async () => {
    const u = await registerUser();
    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(u.cookies));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_failed');
  });

  it('rotates the refresh token and revokes the family when an old token is replayed', async () => {
    const u = await registerUser();
    const first = refreshCookie(u.cookies);
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', first).set('X-Requested-With', 'slog');
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTypeOf('string');
    const second = refreshCookie(r1.headers['set-cookie']);
    expect(second).not.toBe(first);

    // A replay within a few seconds is treated as a concurrent refresh from another tab.
    await RefreshToken.updateMany({ usedAt: { $ne: null } }, { $set: { usedAt: new Date(Date.now() - 60_000) } });
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', first).set('X-Requested-With', 'slog');
    expect(replay.status).toBe(401);
    const afterReplay = await request(app).post('/api/auth/refresh').set('Cookie', second).set('X-Requested-With', 'slog');
    expect(afterReplay.status).toBe(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const u = await registerUser();
    const cookie = refreshCookie(u.cookies);
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie).set('X-Requested-With', 'slog');
    expect(out.status).toBe(204);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('X-Requested-With', 'slog');
    expect(res.status).toBe(401);
  });
});

describe('password recovery and change', () => {
  it('answers the same way for unknown emails', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
  });

  it('resets the password with a one-time token and ends existing sessions', async () => {
    const u = await registerUser();
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: u.email });
    const token = new URL(forgot.body.devResetUrl).searchParams.get('token')!;
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewSecret456' });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Another789' })).body.error.code).toBe('invalid_token');
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: u.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'NewSecret456' })).status).toBe(200);
    const oldRefresh = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(u.cookies)).set('X-Requested-With', 'slog');
    expect(oldRefresh.status).toBe(401);
  });

  it('changes the password only with the current password', async () => {
    const u = await registerUser();
    const bad = await request(app).patch('/api/me/password').set(u.auth).send({ currentPassword: 'Nope12345', newPassword: 'Fresh12345' });
    expect(bad.body.error.code).toBe('wrong_password');
    const ok = await request(app).patch('/api/me/password').set(u.auth).send({ currentPassword: u.password, newPassword: 'Fresh12345' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTypeOf('string');
  });

  it('deletes the account and its data after password confirmation', async () => {
    const u = await registerUser();
    expect((await request(app).delete('/api/me').set(u.auth).send({ password: 'wrong' })).status).toBe(400);
    expect((await request(app).delete('/api/me').set(u.auth).send({ password: u.password })).status).toBe(204);
    expect(await User.exists({ email: u.email })).toBeNull();
  });
});
