import { asyncHandler } from '../../utils/async-handler.js';
import * as service from './auth.service.js';
import { env } from '../../config/env.js';

const cookieOptions = {
  httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/v1/auth'
};

const response = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const register = asyncHandler(async (req, res) => response(res, { user: await service.register(req.body) }, 201));
export const login = asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  res.cookie('refreshToken', result.refreshToken, cookieOptions);
  delete result.refreshToken;
  response(res, result);
});
export const refresh = asyncHandler(async (req, res) => {
  const result = await service.refresh(req.cookies.refreshToken);
  res.cookie('refreshToken', result.refreshToken, cookieOptions);
  delete result.refreshToken;
  response(res, result);
});
export const logout = asyncHandler(async (req, res) => {
  await service.logout(req.cookies.refreshToken);
  res.clearCookie('refreshToken', cookieOptions);
  response(res, { message: 'Logged out successfully' });
});
export const me = asyncHandler(async (req, res) => response(res, { user: service.publicUser(req.user) }));
export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await service.requestPasswordReset(req.body.email);
  response(res, {
    message: 'If an account exists for that email, password reset instructions have been sent.',
    ...(env.NODE_ENV !== 'production' && result ? { resetToken: result.token } : {})
  });
});
export const resetPassword = asyncHandler(async (req, res) => {
  await service.resetPassword(req.body.token, req.body.password);
  response(res, { message: 'Password has been reset successfully' });
});
export const createStaff = asyncHandler(async (req, res) =>
  response(res, { user: await service.createStaff(req.body) }, 201));
