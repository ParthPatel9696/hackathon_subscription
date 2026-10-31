const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const AUTH_COOKIE = 'brightloop_session';

const getJwtSecret = () => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return JWT_SECRET;
};

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  const cookies = req.headers.cookie
    ? Object.fromEntries(req.headers.cookie.split(';').map(part => part.trim().split('=')))
    : {};
  return cookies[AUTH_COOKIE];
};

// Middleware to verify JWT token
exports.verifyToken = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in.'
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User associated with this session no longer exists.'
      });
    }

    if (user.role === 'customer' && user.accountStatus === 'Archived') {
      return res.status(401).json({ success: false, error: 'This customer account is archived. Contact support to restore access.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token. Please sign in again.'
    });
  }
};

exports.requireOwnership = (getOwnerId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Sign in required.' });
    }

    if (['admin', 'staff'].includes(req.user.role)) {
      return next();
    }

    const ownerId = getOwnerId(req);
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not have access to this resource.' });
    }

    next();
  };
};

// Middleware to enforce Role-Based Access Control (RBAC)
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Sign in required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires role: [${roles.join(', ')}]. Your role: ${req.user.role}`
      });
    }

    next();
  };
};
