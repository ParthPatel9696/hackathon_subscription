import { env } from '../config/env.js';

export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  const code = error.code || 'INTERNAL_ERROR';
  if (env.NODE_ENV !== 'test') console.error(error);
  res.status(status).json({
    success: false,
    error: { code, message: status === 500 ? 'Internal server error' : error.message, details: error.details }
  });
}
