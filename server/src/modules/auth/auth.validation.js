import { z } from 'zod';

export const passwordSchema = z.string()
  .min(9, 'Password must be more than 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: passwordSchema
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export const emailSchema = z.object({ email: z.string().trim().email() });
export const resetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema
});
export const staffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: passwordSchema
});
