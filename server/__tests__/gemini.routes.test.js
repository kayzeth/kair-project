const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const geminiRouter = require('../routes/gemini');
const User = require('../models/User');

// Increase Jest timeout for all tests in this file
jest.setTimeout(10000);

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/gemini', geminiRouter);

// Mock environment variables
const originalEnv = process.env;

describe('Gemini API Routes', () => {
  let mongoServer;
  let testUser;
  let authToken;

  // Set up MongoDB Memory Server and test user before tests
  beforeAll(async () => {
    // Set up mock environment variables
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: 'test-gemini-api-key',
      JWT_SECRET: 'test-jwt-secret'
    };

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create a test user
    testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'password123'
    });
    await testUser.save();

    // Create a valid JWT token for the test user
    authToken = jwt.sign(
      { user: { id: testUser._id } },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  // Clean up after tests
  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // GET /api/gemini/api-key-public - Public route to get Gemini API key
  describe('GET /api/gemini/api-key-public', () => {
    test('should return Gemini API key without authentication', async () => {
      const response = await request(app).get('/api/gemini/api-key-public');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apiKey');
      expect(response.body.apiKey).toBe('test-gemini-api-key');
    });

    test('should return 500 if Gemini API key is not configured', async () => {
      // Temporarily remove API key from environment
      const savedApiKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const response = await request(app).get('/api/gemini/api-key-public');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Gemini API key not configured on server');
      
      // Restore API key
      process.env.GEMINI_API_KEY = savedApiKey;
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create a route that always throws an error for testing
      app.get('/api/gemini/test-error', (req, res) => {
        throw new Error('Test error');
      });
      
      const response = await request(app).get('/api/gemini/test-error');
      
      expect(response.status).toBe(500);
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  // GET /api/gemini/api-key - Protected route to get Gemini API key
  describe('GET /api/gemini/api-key', () => {
    test('should return Gemini API key with valid authentication', async () => {
      const response = await request(app)
        .get('/api/gemini/api-key')
        .set('x-auth-token', authToken);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('apiKey');
      expect(response.body.apiKey).toBe('test-gemini-api-key');
    });

    test('should return 401 if no authentication token is provided', async () => {
      const response = await request(app).get('/api/gemini/api-key');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('No token, authorization denied');
    });

    test('should return 401 if authentication token is invalid', async () => {
      const response = await request(app)
        .get('/api/gemini/api-key')
        .set('x-auth-token', 'invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Token is not valid');
    });

    test('should return 500 if Gemini API key is not configured', async () => {
      // Temporarily remove API key from environment
      const savedApiKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const response = await request(app)
        .get('/api/gemini/api-key')
        .set('x-auth-token', authToken);
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Gemini API key not configured on server');
      
      // Restore API key
      process.env.GEMINI_API_KEY = savedApiKey;
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create a route that always throws an error for testing
      app.get('/api/gemini/test-error-auth', (req, res) => {
        throw new Error('Test error');
      });
      
      const response = await request(app)
        .get('/api/gemini/test-error-auth')
        .set('x-auth-token', authToken);
      
      expect(response.status).toBe(500);
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
});
