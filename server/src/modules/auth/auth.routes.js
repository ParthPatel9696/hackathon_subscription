import { Router } from 'express';
import * as controller from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { registerSchema, loginSchema, emailSchema, resetSchema, staffSchema } from './auth.validation.js';

const router = Router();
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/forgot-password', validate(emailSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetSchema), controller.resetPassword);
router.post('/staff', authenticate, authorize('ADMIN'), validate(staffSchema), controller.createStaff);
export default router;
