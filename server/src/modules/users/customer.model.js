import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    customerNumber: { type: String, required: true, unique: true, index: true },
    phone: { type: String, trim: true, maxlength: 30 },
    billingAddress: {
      line1: { type: String, trim: true, maxlength: 120 },
      line2: { type: String, trim: true, maxlength: 120 },
      city: { type: String, trim: true, maxlength: 80 },
      state: { type: String, trim: true, maxlength: 80 },
      postalCode: { type: String, trim: true, maxlength: 20 },
      country: { type: String, trim: true, maxlength: 80 }
    }
  },
  { timestamps: true }
);

export const Customer = mongoose.model('Customer', customerSchema);
