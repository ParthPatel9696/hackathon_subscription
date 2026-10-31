import { AppError } from '../utils/app-error.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', result.error.flatten()));
  }
  req[source] = result.data;
  next();
};
