/**
 * Migration script to add sleep schedule fields to existing users
 * 
 * Run this script with: node server/scripts/migrateSleepSchedule.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected for migration'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

async function migrateSleepSchedule() {
  try {
    console.log('Starting sleep schedule migration...');
    
    // Find all users without bedtime or wakeupTime fields
    const users = await User.find({
      $or: [
        { bedtime: { $exists: false } },
        { wakeupTime: { $exists: false } }
      ]
    });
    
    console.log(`Found ${users.length} users that need migration`);
    
    // Update each user with default values
    for (const user of users) {
      console.log(`Updating user: ${user.name} (${user.email})`);
      
      // Set default values if not present
      if (!user.bedtime) user.bedtime = '00:00';
      if (!user.wakeupTime) user.wakeupTime = '08:00';
      
      // Save the updated user
      await user.save();
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateSleepSchedule();
