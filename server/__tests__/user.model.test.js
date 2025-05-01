const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Use in-memory MongoDB server for testing
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('User Model', () => {
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
  });

  // Clear the database between tests
  afterEach(async () => {
    await User.deleteMany({});
  });

  test('should create a user with all required fields', async () => {
    // Arrange
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'password123'
    };

    // Act
    const user = new User(userData);
    const savedUser = await user.save();

    // Assert
    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(userData.name);
    expect(savedUser.email).toBe(userData.email);
    // Password should be hashed
    expect(savedUser.password_hash).not.toBe(userData.password_hash);
    expect(savedUser.bedtime).toBe('00:00'); // Default value
    expect(savedUser.wakeupTime).toBe('08:00'); // Default value
    expect(savedUser.createdAt).toBeDefined();
    expect(savedUser.updatedAt).toBeDefined();
  });

  test('should create a user with custom sleep schedule', async () => {
    // Arrange
    const userData = {
      name: 'Night Owl',
      email: 'owl@example.com',
      password_hash: 'password123',
      bedtime: '02:00',
      wakeupTime: '10:00'
    };

    // Act
    const user = new User(userData);
    const savedUser = await user.save();

    // Assert
    expect(savedUser._id).toBeDefined();
    expect(savedUser.bedtime).toBe('02:00');
    expect(savedUser.wakeupTime).toBe('10:00');
  });

  test('should hash password before saving', async () => {
    // Arrange
    const plainPassword = 'password123';
    const userData = {
      name: 'Hash Test',
      email: 'hash@example.com',
      password_hash: plainPassword
    };

    // Act
    const user = new User(userData);
    const savedUser = await user.save();

    // Assert
    expect(savedUser.password_hash).not.toBe(plainPassword);
    // Verify it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    expect(savedUser.password_hash).toMatch(/^\$2[aby]\$\d+\$/);
  });

  test('should correctly compare passwords', async () => {
    // Arrange
    const plainPassword = 'password123';
    const userData = {
      name: 'Compare Test',
      email: 'compare@example.com',
      password_hash: plainPassword
    };
    const user = new User(userData);
    const savedUser = await user.save();

    // Act & Assert
    const correctPasswordResult = await savedUser.comparePassword(plainPassword);
    const wrongPasswordResult = await savedUser.comparePassword('wrongpassword');

    expect(correctPasswordResult).toBe(true);
    expect(wrongPasswordResult).toBe(false);
  });

  test('should not create a user without required fields', async () => {
    // Arrange - missing name
    const userDataNoName = {
      email: 'noname@example.com',
      password_hash: 'password123'
    };

    // Arrange - missing email
    const userDataNoEmail = {
      name: 'No Email',
      password_hash: 'password123'
    };

    // Arrange - missing password
    const userDataNoPassword = {
      name: 'No Password',
      email: 'nopassword@example.com'
    };

    // Act & Assert
    await expect(async () => {
      const user = new User(userDataNoName);
      await user.save();
    }).rejects.toThrow(mongoose.Error.ValidationError);

    await expect(async () => {
      const user = new User(userDataNoEmail);
      await user.save();
    }).rejects.toThrow(mongoose.Error.ValidationError);

    await expect(async () => {
      const user = new User(userDataNoPassword);
      await user.save();
    }).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test('should enforce email uniqueness', async () => {
    // Arrange
    const userData1 = {
      name: 'User One',
      email: 'duplicate@example.com',
      password_hash: 'password123'
    };

    const userData2 = {
      name: 'User Two',
      email: 'duplicate@example.com', // Same email
      password_hash: 'password456'
    };

    // Act & Assert
    await new User(userData1).save();

    await expect(async () => {
      await new User(userData2).save();
    }).rejects.toThrow(mongoose.mongo.MongoServerError);
  });

  test('should store Google Calendar sync token', async () => {
    // Arrange
    const userData = {
      name: 'Google User',
      email: 'google@example.com',
      password_hash: 'password123',
      google_calendar_sync_token: 'some-sync-token-value'
    };

    // Act
    const user = new User(userData);
    const savedUser = await user.save();

    // Assert
    expect(savedUser.google_calendar_sync_token).toBe('some-sync-token-value');
  });

  test('should update user fields', async () => {
    // Arrange
    const userData = {
      name: 'Original Name',
      email: 'original@example.com',
      password_hash: 'password123'
    };
    const user = new User(userData);
    const savedUser = await user.save();

    // Act
    savedUser.name = 'Updated Name';
    savedUser.email = 'updated@example.com';
    savedUser.bedtime = '23:00';
    savedUser.wakeupTime = '07:00';
    
    // Add a small delay to ensure timestamps will be different
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const updatedUser = await savedUser.save();

    // Assert
    const refetchedUser = await User.findById(updatedUser._id);
    expect(refetchedUser.name).toBe('Updated Name');
    expect(refetchedUser.email).toBe('updated@example.com');
    expect(refetchedUser.bedtime).toBe('23:00');
    expect(refetchedUser.wakeupTime).toBe('07:00');
  });

  test('should not rehash password if it was not modified', async () => {
    // Arrange
    const userData = {
      name: 'Hash Test',
      email: 'hashtest@example.com',
      password_hash: 'password123'
    };
    const user = new User(userData);
    const savedUser = await user.save();
    const originalHash = savedUser.password_hash;

    // Act - update something other than password
    savedUser.name = 'New Name';
    const updatedUser = await savedUser.save();

    // Assert - password hash should remain the same
    expect(updatedUser.password_hash).toBe(originalHash);
  });

  test('should rehash password if it was modified', async () => {
    // Arrange
    const userData = {
      name: 'Hash Test',
      email: 'hashtest@example.com',
      password_hash: 'password123'
    };
    const user = new User(userData);
    const savedUser = await user.save();
    const originalHash = savedUser.password_hash;

    // Act - update password
    savedUser.password_hash = 'newpassword456';
    const updatedUser = await savedUser.save();

    // Assert - password hash should be different
    expect(updatedUser.password_hash).not.toBe(originalHash);
    expect(updatedUser.password_hash).not.toBe('newpassword456');
  });
});
