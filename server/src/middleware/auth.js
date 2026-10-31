import { User } from '../modules/users/user.model.js';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'ACTIVE') throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or expired access token', 401, 'UNAUTHENTICATED'));
  }
}

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
  }
  next();
};
