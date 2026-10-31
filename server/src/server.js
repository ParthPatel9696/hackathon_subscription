import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './database/connect.js';

connectDatabase()
  .then(() => app.listen(env.PORT, () => console.info(`API listening on port ${env.PORT}`)))
  .catch((error) => {
    console.error('Unable to connect to MongoDB', error);
    process.exitCode = 1;
  });
