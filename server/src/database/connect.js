import mongoose from 'mongoose';
import { env } from '../config/env.js';

export async function connectDatabase(uri = env.MONGODB_URI) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
