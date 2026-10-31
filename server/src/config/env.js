import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/subscription_management'),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-change-me-32'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-change-me-32'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.string().transform((value) => value === 'true').default('false'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email().default('no-reply@example.com')
});

export const env = schema.parse(process.env);
