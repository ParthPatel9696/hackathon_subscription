import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['ADMIN', 'STAFF', 'CUSTOMER'], default: 'CUSTOMER', index: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    refreshTokenHash: { type: String, select: false, default: null },
    emailVerified: { type: Boolean, default: false },
    resetTokenHash: { type: String, select: false, default: null },
    resetTokenExpiresAt: { type: Date, select: false, default: null }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
