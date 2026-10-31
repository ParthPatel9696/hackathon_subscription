const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendPasswordReset } = require('../services/mailer');
const User = require('../models/User');
const { recordAudit } = require('../services/auditService');

const JWT_SECRET = process.env.JWT_SECRET;
const AUTH_COOKIE = 'brightloop_session';

const getJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return JWT_SECRET;
};

const setAuthCookie = (res, token) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name, sessionVersion: user.sessionVersion || 0 },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register (New Customer Sign Up - Problem Statement Page 2)
exports.register = async (req, res) => {
  try {
    const { password, companyName, phone, billingAddress, termsAccepted } = req.body;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required.'
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    // Email unique check
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Unable to create an account with those details. Try signing in if you already have access.'
      });
    }

    // Password validation per Page 2:
    // "more than eight characters, with an uppercase letter, a lowercase letter and a special character."
    const isStrong = password.length > 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!isStrong) {
      return res.status(400).json({
        success: false,
        error: 'Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.'
      });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({ success: false, error: 'You must accept the terms to create an account.' });
    }

    const newUser = new User({
      email,
      password,
      name,
      companyName: companyName || '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      billingAddress: typeof billingAddress === 'string' ? billingAddress.trim() : '',
      termsAcceptedAt: termsAccepted ? new Date() : null,
      role: 'customer' // Public registrations are always customers
    });

    await newUser.save();
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to Brightloop.',
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        companyName: newUser.companyName,
        phone: newUser.phone,
        billingAddress: newUser.billingAddress,
        role: newUser.role
      }
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Unable to create an account with those details.' });
    res.status(err.name === 'ValidationError' ? 400 : 500).json({ success: false, error: err.name === 'ValidationError' ? err.message : 'Unable to create your account.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const user = await User.findOne({ email });
    if (!user || user.accountStatus === 'Archived') {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        companyName: user.companyName,
        phone: user.phone,
        billingAddress: user.billingAddress,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to sign in right now.' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        companyName: req.user.companyName,
        phone: req.user.phone,
        billingAddress: req.user.billingAddress,
        role: req.user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to load your account.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    const strong = newPassword.length > 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    if (!currentPassword || !strong) return res.status(400).json({ success: false, error: 'Enter your current password and a new password longer than 8 characters with uppercase, lowercase, and a special character.' });
    const user = await User.findById(req.user._id);
    if (!user || !await user.comparePassword(currentPassword)) return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    if (await user.comparePassword(newPassword)) return res.status(400).json({ success: false, error: 'Choose a password you have not used for this account.' });
    user.password = newPassword;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
    recordAudit({ actor: req.user, action: 'password_changed', resourceType: 'User', resourceId: user._id }).catch(() => {});
    res.json({ success: true, message: 'Password changed. Sign in again with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to change your password.' });
  }
};

// POST /api/auth/forgot-password (Page 2: "reset link should arrive at their registered email")
exports.forgotPassword = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    const user = await User.findOne({ email });

    if (!user) {
      // Don't leak user existence in production, but confirm email check
      return res.json({
        success: true,
        message: 'If an account exists with this email, password reset instructions have been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const resetUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    let emailSent = false;
    try { emailSent = await sendPasswordReset({ to: user.email, url: resetUrl }); }
    catch (mailError) {
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();
      throw mailError;
    }
    const response = {
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.'
    };
    if (!emailSent && process.env.NODE_ENV !== 'production') response.simulatedResetUrl = resetUrl;
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to request password reset right now.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, error: 'Reset token and password are required.' });
    }

    const isStrong = password.length > 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!isStrong) {
      return res.status(400).json({
        success: false,
        error: 'Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Reset token is invalid or expired.' });
    }

    user.password = password;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. Please sign in again.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to reset your password right now.' });
  }
};

// Incrementing the user's session version revokes the cookie JWT on the next request.
exports.logout = async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Unable to end this session. Please try again.' });
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
  res.json({ success: true, message: 'Signed out successfully.' });
};

// POST /api/auth/add-staff (Page 2: "Only the admin can add a new member of staff")
exports.addStaff = async (req, res) => {
  try {
    // Verified by requireRole('admin') middleware
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Staff name, email, and initial password are required.'
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists.'
      });
    }

    // Validate password complexity
    const isStrong = password.length > 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!isStrong) {
      return res.status(400).json({
        success: false,
        error: 'Password must be more than 8 characters, with an uppercase letter, a lowercase letter and a special character.'
      });
    }

    const newStaff = new User({
      email: email.toLowerCase(),
      password,
      name,
      companyName: 'Brightloop Internal Team',
      role: 'staff' // Explicitly staff role
    });

    await newStaff.save();
    recordAudit({ actor: req.user, action: 'staff_created', resourceType: 'User', resourceId: newStaff._id, newValue: { name: newStaff.name, email: newStaff.email, role: newStaff.role } }).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Staff member ${newStaff.name} (${newStaff.email}) added successfully.`,
      staff: {
        id: newStaff._id,
        email: newStaff.email,
        name: newStaff.name,
        role: newStaff.role
      }
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'A user already uses that email address.' });
    res.status(500).json({ success: false, error: 'Unable to add staff member.' });
  }
};

exports.listStaff = async (req, res) => {
  const data = await User.find({ role: 'staff' }).select('name email phone accountStatus createdAt').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
};

exports.setStaffStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid staff id.' });
  if (!['Active', 'Archived'].includes(req.body.accountStatus)) return res.status(400).json({ success: false, error: 'Choose Active or Archived.' });
  const staff = await User.findOneAndUpdate({ _id: req.params.id, role: 'staff' }, { $set: { accountStatus: req.body.accountStatus }, $inc: { sessionVersion: 1 } }, { new: true, runValidators: true }).select('name email phone accountStatus createdAt');
  if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found.' });
  recordAudit({ actor: req.user, action: 'staff_status_changed', resourceType: 'User', resourceId: staff._id, newValue: { accountStatus: staff.accountStatus } }).catch(() => {});
  res.json({ success: true, data: staff });
};
