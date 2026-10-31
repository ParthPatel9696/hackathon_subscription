const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Only validate if password is plain text (not yet hashed)
        // bcrypt hashes start with $2a$ or $2b$ and are 60 chars long
        if (v && v.startsWith('$2') && v.length === 60) return true;
        return v && v.length > 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[!@#$%^&*(),.?":{}|<>]/.test(v);
      },
      message: 'Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.'
    }
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'customer'],
    default: 'customer'
  },
  name: {
    type: String,
    required: true
  },
  companyName: {
    type: String,
    default: ''
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook: Hash password before saving if modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
