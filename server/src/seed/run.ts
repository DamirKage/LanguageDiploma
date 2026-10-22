import mongoose from 'mongoose';
import { config } from '../config';
import { connectDb, disconnectDb } from '../db';
import { User } from '../models/user';
import { hashPassword } from '../modules/auth/service';
import { seedContent } from './content-seed';
import { DEMO_PROFILES, createDemoLearner } from './demo';

/**
 * Usage: npm run seed [-- --reset] [-- --no-demo]
 *   --reset    drop the whole database first
 *   --no-demo  seed only the curriculum and the administrator
 */
async function main() {
  const args = new Set(process.argv.slice(2));
  await connectDb(config.mongoUri);
  if (args.has('--reset')) {
    if (config.isProd && !args.has('--force')) throw new Error('Refusing to drop a production database without --force');
    await mongoose.connection.dropDatabase();
    await mongoose.connection.syncIndexes();
    console.log('Database dropped');
  }

  await seedContent();
  console.log('Curriculum seeded: 5 languages, A1–B2');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@slog.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'SlogAdmin2026';
  if (!(await User.exists({ email: adminEmail }))) {
    await User.create({
      email: adminEmail,
      name: 'Администратор',
      role: 'admin',
      passwordHash: await hashPassword(adminPassword),
      onboarded: true,
      activeLanguage: null,
    });
    console.log(`Administrator created: ${adminEmail}`);
  }

  if (!args.has('--no-demo')) {
    const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'SlogDemo2026';
    for (const profile of DEMO_PROFILES) {
      const result = await createDemoLearner(profile, demoPassword);
      console.log(`${result.created ? 'Demo learner created' : 'Demo learner exists'}: ${profile.email}`);
    }
  }
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb();
  process.exit(1);
});
