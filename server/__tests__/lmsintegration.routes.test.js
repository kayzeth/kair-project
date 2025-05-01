const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const lmsIntegrationRouter = require('../routes/lmsintegration');
const LmsIntegration = require('../models/LmsIntegration');
const Event = require('../models/Event');

// Mock node-fetch
jest.mock('node-fetch');
const fetch = require('node-fetch');

// Increase Jest timeout for all tests in this file
jest.setTimeout(10000);

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/lms', lmsIntegrationRouter);

describe('LMS Integration API Routes', () => {
  let mongoServer;
  let testUser;
  let testIntegration;

  // Set up MongoDB Memory Server before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create a test user ID
    testUser = new mongoose.Types.ObjectId();
  });

  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Clear the database between tests
  beforeEach(async () => {
    await LmsIntegration.deleteMany({});
    await Event.deleteMany({});
    
    // Create a test LMS integration before each test
    testIntegration = new LmsIntegration({
      user_id: testUser,
      lms_type: 'CANVAS',
      token: 'Bearer test-token',
      domain: 'canvas.instructure.com'
    });
    await testIntegration.save();

    // Reset all mocks
    jest.clearAllMocks();
  });

  // GET /api/lms - Get all LMS integrations
  describe('GET /api/lms', () => {
    test('should return all LMS integrations', async () => {
      const response = await request(app).get('/api/lms');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].lms_type).toBe('CANVAS');
      expect(response.body[0].domain).toBe('canvas.instructure.com');
    });

    test('should return multiple integrations when they exist', async () => {
      // Create a second integration
      const secondIntegration = new LmsIntegration({
        user_id: new mongoose.Types.ObjectId(),
        lms_type: 'CANVAS',
        token: 'Bearer second-token',
        domain: 'second-canvas.instructure.com'
      });
      await secondIntegration.save();
      
      const response = await request(app).get('/api/lms');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock LmsIntegration.find to throw an error
      const originalFind = LmsIntegration.find;
      LmsIntegration.find = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const response = await request(app).get('/api/lms');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      LmsIntegration.find = originalFind;
      consoleSpy.mockRestore();
    });
  });

  // GET /api/lms/:id - Get LMS integration by ID
  describe('GET /api/lms/:id', () => {
    test('should return a specific LMS integration by ID', async () => {
      const response = await request(app).get(`/api/lms/${testIntegration._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body._id).toBe(testIntegration._id.toString());
      expect(response.body.lms_type).toBe('CANVAS');
      expect(response.body.domain).toBe('canvas.instructure.com');
    });

    test('should return 404 for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/lms/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('LMS integration not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app).get('/api/lms/invalid-id');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // POST /api/lms - Create new LMS integration
  describe('POST /api/lms', () => {
    test('should create a new LMS integration without triggering sync', async () => {
      // Mock fetch to simulate a failed API call during sync
      fetch.mockImplementation(() => {
        return Promise.reject(new Error('API Error'));
      });

      const newIntegration = {
        user_id: new mongoose.Types.ObjectId(),
        lms_type: 'CANVAS',
        token: 'Bearer new-token',
        domain: 'new-canvas.instructure.com'
      };

      const response = await request(app)
        .post('/api/lms')
        .send(newIntegration);
      
      expect(response.status).toBe(201);
      expect(response.body.lms_type).toBe('CANVAS');
      expect(response.body.domain).toBe('new-canvas.instructure.com');
      
      // Verify the integration was added to the database
      const createdIntegration = await LmsIntegration.findById(response.body._id);
      expect(createdIntegration).not.toBeNull();
      expect(createdIntegration.token).toBe('Bearer new-token');
      
      // Verify fetch was called but the sync was handled gracefully
      expect(fetch).toHaveBeenCalled();
    });

    test('should handle validation errors', async () => {
      // Integration without required token field
      const invalidIntegration = {
        user_id: new mongoose.Types.ObjectId(),
        lms_type: 'CANVAS',
        domain: 'invalid-canvas.instructure.com'
        // Missing token field
      };

      const response = await request(app)
        .post('/api/lms')
        .send(invalidIntegration);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // PUT /api/lms/:id - Update LMS integration
  describe('PUT /api/lms/:id', () => {
    test('should update an existing LMS integration', async () => {
      const updatedData = {
        token: 'Bearer updated-token',
        domain: 'updated-canvas.instructure.com'
      };

      const response = await request(app)
        .put(`/api/lms/${testIntegration._id}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.token).toBe('Bearer updated-token');
      expect(response.body.domain).toBe('updated-canvas.instructure.com');
      
      // Verify the integration was updated in the database
      const updatedIntegration = await LmsIntegration.findById(testIntegration._id);
      expect(updatedIntegration.domain).toBe('updated-canvas.instructure.com');
    });

    test('should update partial fields', async () => {
      const partialUpdate = {
        domain: 'partially-updated-canvas.instructure.com'
      };

      const response = await request(app)
        .put(`/api/lms/${testIntegration._id}`)
        .send(partialUpdate);
      
      expect(response.status).toBe(200);
      expect(response.body.domain).toBe('partially-updated-canvas.instructure.com');
      expect(response.body.token).toBe('Bearer test-token'); // Unchanged
    });

    test('should return 404 for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/lms/${nonExistentId}`)
        .send({ domain: 'updated-domain.com' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('LMS integration not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app)
        .put('/api/lms/invalid-id')
        .send({ domain: 'updated-domain.com' });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // DELETE /api/lms/:id - Delete LMS integration
  describe('DELETE /api/lms/:id', () => {
    test('should delete an existing LMS integration', async () => {
      const response = await request(app).delete(`/api/lms/${testIntegration._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('LMS integration deleted successfully');
      
      // Verify the integration was deleted from the database
      const deletedIntegration = await LmsIntegration.findById(testIntegration._id);
      expect(deletedIntegration).toBeNull();
    });

    test('should return 404 for non-existent integration', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).delete(`/api/lms/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('LMS integration not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app).delete('/api/lms/invalid-id');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // POST /api/lms/sync/canvas/:userId - Sync Canvas events for a user
  describe('POST /api/lms/sync/canvas/:userId', () => {
    test('should sync Canvas events successfully', async () => {
      // Mock successful responses for Canvas API calls
      const coursesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          { 
            id: 1, 
            name: 'Test Course',
            tab_configuration: null
          }
        ])
      };
      
      const assignmentsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 101,
            name: 'Test Assignment',
            due_at: '2025-05-15T23:59:59Z',
            description: '<p>This is a test assignment</p>'
          }
        ])
      };
      
      const calendarEventsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 201,
            title: 'Test Calendar Event',
            start_at: '2025-05-20T14:00:00Z',
            end_at: '2025-05-20T15:00:00Z',
            description: '<p>This is a test calendar event</p>'
          }
        ])
      };
      
      // Set up the fetch mock to return different responses based on the URL
      fetch.mockImplementation((url) => {
        if (url.includes('/courses?')) {
          return Promise.resolve(coursesResponse);
        } else if (url.includes('/assignments?')) {
          return Promise.resolve(assignmentsResponse);
        } else if (url.includes('/calendar_events?')) {
          return Promise.resolve(calendarEventsResponse);
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      
      const response = await request(app).post(`/api/lms/sync/canvas/${testUser}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Canvas sync completed successfully');
      
      // Verify fetch was called the expected number of times
      expect(fetch).toHaveBeenCalledTimes(3); // Courses, assignments, calendar events
      
      // Verify the integration's last_synced field was updated
      const updatedIntegration = await LmsIntegration.findById(testIntegration._id);
      expect(updatedIntegration.last_synced).not.toBeNull();
      
      // Verify events were created in the database
      const events = await Event.find({ user_id: testUser });
      expect(events.length).toBeGreaterThan(0);
    });

    test('should handle Canvas API errors', async () => {
      // Mock a failed response from Canvas API
      fetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        });
      });
      
      const response = await request(app).post(`/api/lms/sync/canvas/${testUser}`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error during Canvas sync');
    });

    test('should handle missing integration', async () => {
      // Use a user ID that doesn't have an integration
      const nonExistentUserId = new mongoose.Types.ObjectId();
      
      const response = await request(app).post(`/api/lms/sync/canvas/${nonExistentUserId}`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error during Canvas sync');
    });
  });
});
