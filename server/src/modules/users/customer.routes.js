import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as controller from './customer.controller.js';

const router = Router();
router.get('/me', authenticate, authorize('CUSTOMER'), controller.getOwnCustomer);
router.get('/:userId', authenticate, authorize('ADMIN', 'STAFF', 'CUSTOMER'), controller.getCustomer);
export default router;
