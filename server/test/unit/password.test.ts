import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword } from '../../src/lib/password';

describe('password hashing pool', () => {
  it('produces standard bcrypt hashes that verify in both directions', async () => {
    const hash = await hashPassword('Secret123', 4);
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    expect(await verifyPassword('Secret123', hash)).toBe(true);
    expect(await verifyPassword('secret123', hash)).toBe(false);
    expect(await bcrypt.compare('Secret123', hash)).toBe(true);
    expect(await verifyPassword('legacy', bcrypt.hashSync('legacy', 4))).toBe(true);
  });

  it('handles many requests at once', async () => {
    const hashes = await Promise.all(Array.from({ length: 12 }, (_, i) => hashPassword(`pass-${i}`, 4)));
    const checks = await Promise.all(hashes.map((h, i) => verifyPassword(`pass-${i}`, h)));
    expect(checks.every(Boolean)).toBe(true);
  });
});
