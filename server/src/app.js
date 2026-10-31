import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { asyncHandler } from './utils/async-handler.js';
import { AppError } from './utils/app-error.js';
import authRouter from './modules/auth/auth.routes.js';
import customerRouter from './modules/users/customer.routes.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(requestLogger);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true
});
app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/customers', customerRouter);
app.use((_req, _res, next) => next(new AppError('Route not found', 404, 'NOT_FOUND')));
app.use(errorHandler);

export default app;
