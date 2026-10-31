const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightloop_subscriptions');
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} @ ${conn.connection.host}:${conn.connection.port}`);
  } catch (err) {
    console.error(`[MongoDB] Connection error:`, err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
