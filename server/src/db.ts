import mongoose from 'mongoose';
import { logger } from './lib/logger';

mongoose.set('strictQuery', true);

export async function connectDb(uri: string) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await mongoose.connection.syncIndexes();
  logger.info('MongoDB connected');
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
