/**
 * Migration module to add sleep schedule fields to existing users
 * 
 * This is a modular version of the migrateSleepSchedule script
 * that can be imported and tested.
 */

const User = require('../models/User');

/**
 * Migrates sleep schedule for users who don't have it set
 * @returns {Promise<void>}
 */
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
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

module.exports = migrateSleepSchedule;
