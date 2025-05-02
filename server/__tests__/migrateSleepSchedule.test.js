const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');

// Import the migration function directly instead of the whole script
// We'll need to modify the script slightly to make it testable
const migrateSleepSchedule = require('../scripts/migrateSleepScheduleModule');

// Increase Jest timeout for all tests in this file
jest.setTimeout(10000);

// Mock console methods to prevent cluttering test output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Sleep Schedule Migration Script', () => {
  let mongoServer;

  // Set up MongoDB Memory Server before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
  });

  // Clear the database between tests
  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('should add default sleep schedule to users without it', async () => {
    // Create test users without sleep schedule fields
    const users = [
      {
        name: 'User 1',
        email: 'user1@example.com',
        password_hash: 'password123'
      },
      {
        name: 'User 2',
        email: 'user2@example.com',
        password_hash: 'password123'
      },
      {
        name: 'User 3',
        email: 'user3@example.com',
        password_hash: 'password123',
        bedtime: '23:00' // Has bedtime but no wakeupTime
      }
    ];

    // Insert test users
    await User.insertMany(users);

    // Run the migration
    await migrateSleepSchedule();

    // Check if all users now have sleep schedule fields
    const updatedUsers = await User.find({}).sort({ email: 1 });
    
    expect(updatedUsers.length).toBe(3);
    
    // User 1 should have default values
    expect(updatedUsers[0].email).toBe('user1@example.com');
    expect(updatedUsers[0].bedtime).toBe('00:00');
    expect(updatedUsers[0].wakeupTime).toBe('08:00');
    
    // User 2 should have default values
    expect(updatedUsers[1].email).toBe('user2@example.com');
    expect(updatedUsers[1].bedtime).toBe('00:00');
    expect(updatedUsers[1].wakeupTime).toBe('08:00');
    
    // User 3 should keep custom bedtime but get default wakeupTime
    expect(updatedUsers[2].email).toBe('user3@example.com');
    expect(updatedUsers[2].bedtime).toBe('23:00');
    expect(updatedUsers[2].wakeupTime).toBe('08:00');
  });

  test('should not modify users that already have sleep schedule fields', async () => {
    // Create a user with complete sleep schedule
    const user = new User({
      name: 'Complete User',
      email: 'complete@example.com',
      password_hash: 'password123',
      bedtime: '22:30',
      wakeupTime: '06:30'
    });
    await user.save();

    // Run the migration
    await migrateSleepSchedule();

    // Check if the user's sleep schedule is unchanged
    const updatedUser = await User.findOne({ email: 'complete@example.com' });
    
    expect(updatedUser.bedtime).toBe('22:30');
    expect(updatedUser.wakeupTime).toBe('06:30');
  });

  test('should handle empty database gracefully', async () => {
    // Make sure database is empty
    await User.deleteMany({});

    // Run the migration
    await migrateSleepSchedule();

    // Verify no errors were thrown
    const userCount = await User.countDocuments();
    expect(userCount).toBe(0);
  });

  test('should handle database errors', async () => {
    // Mock User.find to throw an error
    const originalFind = User.find;
    User.find = jest.fn().mockImplementationOnce(() => {
      throw new Error('Test database error');
    });

    // Run the migration and expect it to handle the error
    await expect(migrateSleepSchedule()).rejects.toThrow('Test database error');

    // Restore the original function
    User.find = originalFind;
  });
});
