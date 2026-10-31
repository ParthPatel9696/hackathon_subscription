require('dotenv').config();
const connectDB = require('../config/db');
const seedController = require('../controllers/seedController');

async function run() {
  await connectDB();
  const mockRes = {
    json: (data) => {
      console.log('✅', data.message);
      process.exit(0);
    },
    status: (code) => ({
      json: (err) => {
        console.error('❌ Error seeding database:', code, err);
        process.exit(1);
      }
    })
  };
  await seedController.seedDatabase({}, mockRes);
}

run();
