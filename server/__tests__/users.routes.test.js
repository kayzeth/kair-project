const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const usersRouter = require('../routes/users');
const User = require('../models/User');

// Increase Jest timeout for all tests in this file
jest.setTimeout(10000);

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';

describe('Users API Routes', () => {
  let mongoServer;
  let testUser;
  let testUserId;

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
  beforeEach(async () => {
    await User.deleteMany({});
    
    // Create a test user for tests that require an existing user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'password123', // Will be hashed by pre-save middleware
      bedtime: '23:00',
      wakeupTime: '07:00',
      google_calendar_sync_token: 'test-sync-token'
    });
    await testUser.save();
    testUserId = testUser._id;
  });

  // POST /api/users/register - Register a new user
  describe('POST /api/users/register', () => {
    test('should register a new user and return a token', async () => {
      const newUser = {
        name: 'New User',
        email: 'new@example.com',
        password: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(newUser);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.name).toBe('New User');
      expect(response.body.user.email).toBe('new@example.com');
      expect(response.body.message).toBe('User created successfully');
      
      // Verify the user was added to the database
      const createdUser = await User.findOne({ email: 'new@example.com' });
      expect(createdUser).not.toBeNull();
      expect(createdUser.name).toBe('New User');
      
      // Verify password was hashed
      expect(createdUser.password_hash).not.toBe('newpassword123');
    });

    test('should not register a user with an existing email', async () => {
      const duplicateUser = {
        name: 'Duplicate User',
        email: 'test@example.com', // Same as testUser
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(duplicateUser);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User already exists');
    });

    test('should handle server errors during registration', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock User.findOne to throw an error
      const originalFindOne = User.findOne;
      User.findOne = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const newUser = {
        name: 'Error User',
        email: 'error@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(newUser);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      User.findOne = originalFindOne;
      consoleSpy.mockRestore();
    });
  });

  // POST /api/users/login - Login user
  describe('POST /api/users/login', () => {
    test('should login a user with valid credentials and return a token', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(credentials);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.message).toBe('Login successful');
    });

    test('should not login a user with invalid email', async () => {
      const invalidCredentials = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(invalidCredentials);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should not login a user with invalid password', async () => {
      const invalidCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(invalidCredentials);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    });

    test('should handle server errors during login', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock User.findOne to throw an error
      const originalFindOne = User.findOne;
      User.findOne = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(credentials);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      User.findOne = originalFindOne;
      consoleSpy.mockRestore();
    });
  });

  // PUT /api/users/:userId/google-sync-token - Update Google Calendar sync token
  describe('PUT /api/users/:userId/google-sync-token', () => {
    test('should update Google Calendar sync token for a user', async () => {
      const syncData = {
        syncToken: 'new-sync-token'
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/google-sync-token`)
        .send(syncData);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Google Calendar sync token updated successfully');
      expect(response.body.syncToken).toBe('new-sync-token');
      
      // Verify the token was updated in the database
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser.google_calendar_sync_token).toBe('new-sync-token');
    });

    test('should return 400 if sync token is missing', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/google-sync-token`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Sync token is required');
    });

    test('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/users/${nonExistentId}/google-sync-token`)
        .send({ syncToken: 'new-sync-token' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock User.findByIdAndUpdate to throw an error
      const originalFindByIdAndUpdate = User.findByIdAndUpdate;
      User.findByIdAndUpdate = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const response = await request(app)
        .put(`/api/users/${testUserId}/google-sync-token`)
        .send({ syncToken: 'new-sync-token' });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
      consoleSpy.mockRestore();
    });
  });

  // GET /api/users/:userId/google-sync-token - Get Google Calendar sync token
  describe('GET /api/users/:userId/google-sync-token', () => {
    test('should get Google Calendar sync token for a user', async () => {
      const response = await request(app).get(`/api/users/${testUserId}/google-sync-token`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('syncToken');
      expect(response.body.syncToken).toBe('test-sync-token');
    });

    test('should return null for user without sync token', async () => {
      // Create a user without a sync token
      const userWithoutToken = new User({
        name: 'No Token User',
        email: 'notoken@example.com',
        password_hash: 'password123'
      });
      await userWithoutToken.save();

      const response = await request(app).get(`/api/users/${userWithoutToken._id}/google-sync-token`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('syncToken');
      expect(response.body.syncToken).toBeNull();
    });

    test('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/users/${nonExistentId}/google-sync-token`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock User.findById to throw an error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const response = await request(app).get(`/api/users/${testUserId}/google-sync-token`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      User.findById = originalFindById;
      consoleSpy.mockRestore();
    });
  });

  // GET /api/users/:userId/sleep-schedule - Get user's sleep schedule
  describe('GET /api/users/:userId/sleep-schedule', () => {
    test('should get sleep schedule for a user', async () => {
      const response = await request(app).get(`/api/users/${testUserId}/sleep-schedule`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bedtime');
      expect(response.body).toHaveProperty('wakeupTime');
      expect(response.body.bedtime).toBe('23:00');
      expect(response.body.wakeupTime).toBe('07:00');
    });

    test('should return default values for user without sleep schedule', async () => {
      // Create a user without sleep schedule
      const userWithoutSchedule = new User({
        name: 'No Schedule User',
        email: 'noschedule@example.com',
        password_hash: 'password123'
      });
      await userWithoutSchedule.save();

      const response = await request(app).get(`/api/users/${userWithoutSchedule._id}/sleep-schedule`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bedtime');
      expect(response.body).toHaveProperty('wakeupTime');
      expect(response.body.bedtime).toBe('00:00'); // Default
      expect(response.body.wakeupTime).toBe('08:00'); // Default
    });

    test('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/users/${nonExistentId}/sleep-schedule`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock User.findById to throw an error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const response = await request(app).get(`/api/users/${testUserId}/sleep-schedule`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      User.findById = originalFindById;
      consoleSpy.mockRestore();
    });
  });

  // PUT /api/users/:userId/sleep-schedule - Update user's sleep schedule
  describe('PUT /api/users/:userId/sleep-schedule', () => {
    test('should update sleep schedule for a user', async () => {
      const scheduleData = {
        bedtime: '22:30',
        wakeupTime: '06:30'
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/sleep-schedule`)
        .send(scheduleData);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Sleep schedule updated successfully');
      expect(response.body.bedtime).toBe('22:30');
      expect(response.body.wakeupTime).toBe('06:30');
      
      // Verify the schedule was updated in the database
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser.bedtime).toBe('22:30');
      expect(updatedUser.wakeupTime).toBe('06:30');
    });

    test('should update partial sleep schedule fields', async () => {
      const partialUpdate = {
        bedtime: '22:00'
        // wakeupTime not provided
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/sleep-schedule`)
        .send(partialUpdate);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Sleep schedule updated successfully');
      expect(response.body.bedtime).toBe('22:00');
      expect(response.body.wakeupTime).toBe('07:00'); // Unchanged
    });

    test('should return 400 for invalid bedtime format', async () => {
      const invalidData = {
        bedtime: '25:00', // Invalid hour
        wakeupTime: '07:00'
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/sleep-schedule`)
        .send(invalidData);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid bedtime format. Use HH:MM in 24-hour format.');
    });

    test('should return 400 for invalid wakeupTime format', async () => {
      const invalidData = {
        bedtime: '23:00',
        wakeupTime: '07:60' // Invalid minute
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/sleep-schedule`)
        .send(invalidData);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid wakeupTime format. Use HH:MM in 24-hour format.');
    });

    test('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/users/${nonExistentId}/sleep-schedule`)
        .send({ bedtime: '23:00', wakeupTime: '07:00' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock User.findByIdAndUpdate to throw an error
      const originalFindByIdAndUpdate = User.findByIdAndUpdate;
      User.findByIdAndUpdate = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const response = await request(app)
        .put(`/api/users/${testUserId}/sleep-schedule`)
        .send({ bedtime: '23:00', wakeupTime: '07:00' });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
      consoleSpy.mockRestore();
    });
  });
});
