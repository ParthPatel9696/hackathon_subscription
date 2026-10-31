require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const demoAccounts = [
  { email: 'admin@brightloop.com', password: 'Admin@Secure2024!', role: 'admin', name: 'Alex Morgan', companyName: 'Brightloop Admin Team' },
  { email: 'jordan.lee@brightloop.com', password: 'Staff@Secure2024!', role: 'staff', name: 'Jordan Lee', companyName: 'Brightloop Sales & Ops' },
  { email: 'finance@acmeretail.com', password: 'Acme@Customer2024!', role: 'customer', name: 'Sarah Jenkins', companyName: 'Acme Retail Corp', termsAcceptedAt: new Date() }
];

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('The demo-user seed is disabled in production.');
  await connectDB();
  try {
    const existingUsers = await User.find({ email: { $in: demoAccounts.map((account) => account.email) } });
    const byEmail = new Map(existingUsers.map((user) => [user.email, user]));
    for (const account of demoAccounts) {
      const existing = byEmail.get(account.email);
      if (existing && existing.role !== account.role) throw new Error(`Refusing to change the role of existing account ${account.email}.`);
    }
    for (const account of demoAccounts) {
      const user = byEmail.get(account.email) || new User({ email: account.email });
      Object.assign(user, account, { accountStatus: 'Active' });
      if (byEmail.has(account.email)) user.sessionVersion = (user.sessionVersion || 0) + 1;
      await user.save();
      console.log(`Ready: ${account.role} demo account ${account.email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(`Unable to seed demo accounts: ${error.message}`);
  process.exitCode = 1;
});
