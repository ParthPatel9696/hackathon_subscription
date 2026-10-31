const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'brightloop_super_secret_hackathon_key_2024';

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register (New Customer Sign Up - Problem Statement Page 2)
exports.register = async (req, res) => {
  try {
    const { email, password, name, companyName } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required.'
      });
    }

    // Email unique check
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in.'
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

    const newUser = new User({
      email: email.toLowerCase(),
      password,
      name,
      companyName: companyName || '',
      role: 'customer' // Public registrations are always customers
    });

    await newUser.save();
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to Brightloop.',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        companyName: newUser.companyName,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User not found.'
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

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        companyName: user.companyName,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
        role: req.user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/forgot-password (Page 2: "reset link should arrive at their registered email")
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });

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

    // In a production app, nodemailer sends email. In hackathon mode, provide the simulated link:
    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    console.log(`[PASSWORD RESET SIMULATION] Reset link for ${user.email}: ${resetUrl}`);

    res.json({
      success: true,
      message: `Password reset link generated and dispatched to ${user.email}.`,
      simulatedResetUrl: resetUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
    res.status(500).json({ success: false, error: err.message });
  }
};
