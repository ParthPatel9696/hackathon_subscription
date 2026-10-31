import { asyncHandler } from '../../utils/async-handler.js';
import { Customer } from './customer.model.js';
import { User } from './user.model.js';
import { AppError } from '../../utils/app-error.js';

export const getOwnCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ userId: req.user.id }).populate('userId', 'name email role status');
  if (!customer) throw new AppError('Customer profile not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { customer } });
});

export const getCustomer = asyncHandler(async (req, res) => {
  if (req.user.role === 'CUSTOMER' && req.params.userId !== req.user.id) {
    throw new AppError('You do not have permission to access this customer', 403, 'FORBIDDEN');
  }
  const user = await User.findById(req.params.userId).select('name email role status');
  const customer = await Customer.findOne({ userId: req.params.userId });
  if (!user || !customer) throw new AppError('Customer profile not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { customer: { ...customer.toObject(), userId: user } } });
});
