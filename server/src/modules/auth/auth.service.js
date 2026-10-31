import { randomUUID } from 'node:crypto';
import { Customer } from '../users/customer.model.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import {
  createAccessToken, createRefreshToken, createResetToken, hashToken, verifyRefreshToken
} from '../../utils/tokens.js';
import { env } from '../../config/env.js';
import { sendPasswordResetEmail } from '../../utils/mailer.js';

const publicUser = (user) => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  status: user.status, emailVerified: user.emailVerified
});

function assertUniqueError(error) {
  if (error?.code === 11000) throw new AppError('Email is already registered', 409, 'EMAIL_ALREADY_REGISTERED');
  throw error;
}

export async function register({ name, email, password }) {
  try {
    const user = await User.create({ name, email, passwordHash: await hashPassword(password) });
    await Customer.create({ userId: user.id, customerNumber: `CUS-${randomUUID().slice(0, 8).toUpperCase()}` });
    return publicUser(user);
  } catch (error) {
    assertUniqueError(error);
  }
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHash');
  if (!user || !(await comparePassword(password, user.passwordHash)) || user.status !== 'ACTIVE') {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  const refreshToken = createRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  return { user: publicUser(user), accessToken: createAccessToken(user), refreshToken };
}

export async function refresh(refreshToken) {
  if (!refreshToken) throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHENTICATED');
  }
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || user.status !== 'ACTIVE' || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHENTICATED');
  }
  const newRefreshToken = createRefreshToken(user);
  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();
  return { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: newRefreshToken };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.findByIdAndUpdate(payload.sub, { $unset: { refreshTokenHash: 1 } });
  } catch {
    // Logout remains idempotent when a cookie has expired or been tampered with.
  }
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpiresAt');
  if (!user) return null;
  const token = createResetToken();
  user.resetTokenHash = hashToken(token);
  user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  await sendPasswordResetEmail(user.email, token);
  return { token, expiresAt: user.resetTokenExpiresAt };
}

export async function resetPassword(token, password) {
  const user = await User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpiresAt: { $gt: new Date() }
  }).select('+resetTokenHash +resetTokenExpiresAt');
  if (!user) throw new AppError('Invalid or expired password reset token', 400, 'INVALID_RESET_TOKEN');
  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.refreshTokenHash = null;
  await user.save();
}

export async function createStaff({ name, email, password }) {
  try {
    const user = await User.create({
      name, email, passwordHash: await hashPassword(password), role: 'STAFF', emailVerified: true
    });
    return publicUser(user);
  } catch (error) {
    assertUniqueError(error);
  }
}

export { publicUser };
