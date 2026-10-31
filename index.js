require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;
const clientOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)[0] || 'http://localhost:5173';

// Middleware
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

// Performance measurement middleware (< 2s SLA guarantee)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn(`[WARN - SLA EXCEEDED] ${req.method} ${req.originalUrl} took ${duration}ms!`);
    }
  });
  next();
});

// Send browser visitors to the React client; backend endpoints remain under /api.
app.get('/', (req, res) => {
  res.redirect(clientOrigin);
});

// API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Brightloop Subscription Management API',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

const start = async () => {
  await connectDB();
  return app.listen(PORT, () => {
    console.log(`[Brightloop Server] Running on http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  start().catch(err => {
    console.error(`[Brightloop Server] Startup error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { app, start };
