const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const groupsRouter = require('../routes/groups');
const Group = require('../models/Group');

// Increase Jest timeout for all tests in this file
jest.setTimeout(10000);

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/groups', groupsRouter);

describe('Groups API Routes', () => {
  let mongoServer;
  let testGroup;

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
    await Group.deleteMany({});
    
    // Create a test group before each test
    testGroup = new Group({
      name: 'Test Group',
      recurrence_rule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR'
    });
    await testGroup.save();
  });

  // GET /api/groups - Get all groups
  describe('GET /api/groups', () => {
    test('should return all groups', async () => {
      const response = await request(app).get('/api/groups');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Test Group');
    });

    test('should return multiple groups when they exist', async () => {
      // Create a second group
      const secondGroup = new Group({
        name: 'Second Group',
        recurrence_rule: 'FREQ=MONTHLY;INTERVAL=2;BYDAY=TU,TH'
      });
      await secondGroup.save();
      
      const response = await request(app).get('/api/groups');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[1].name).toBe('Second Group');
    });

    test('should handle server errors', async () => {
      // Create a spy to monitor console.error without affecting its behavior
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock Group.find to throw an error
      const originalFind = Group.find;
      Group.find = jest.fn().mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const response = await request(app).get('/api/groups');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Server error');
      
      // Restore mocks
      Group.find = originalFind;
      consoleSpy.mockRestore();
    });
  });

  // GET /api/groups/:id - Get group by ID
  describe('GET /api/groups/:id', () => {
    test('should return a specific group by ID', async () => {
      const response = await request(app).get(`/api/groups/${testGroup._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body._id).toBe(testGroup._id.toString());
      expect(response.body.name).toBe('Test Group');
      expect(response.body.recurrence_rule).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR');
    });

    test('should return 404 for non-existent group', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/groups/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Group not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app).get('/api/groups/invalid-id');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // POST /api/groups - Create new group
  describe('POST /api/groups', () => {
    test('should create a new group', async () => {
      const newGroup = {
        name: 'New Group',
        recurrence_rule: 'FREQ=DAILY;INTERVAL=1'
      };

      const response = await request(app)
        .post('/api/groups')
        .send(newGroup);
      
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Group');
      expect(response.body.recurrence_rule).toBe('FREQ=DAILY;INTERVAL=1');
      
      // Verify the group was added to the database
      const createdGroup = await Group.findById(response.body._id);
      expect(createdGroup).not.toBeNull();
      expect(createdGroup.name).toBe('New Group');
    });

    test('should handle validation errors', async () => {
      // Group without required name field
      const invalidGroup = {
        description: 'Invalid group without name'
      };

      const response = await request(app)
        .post('/api/groups')
        .send(invalidGroup);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // PUT /api/groups/:id - Update group
  describe('PUT /api/groups/:id', () => {
    test('should update an existing group', async () => {
      const updatedData = {
        name: 'Updated Group',
        recurrence_rule: 'FREQ=MONTHLY;INTERVAL=2;BYDAY=SA,SU'
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup._id}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Group');
      expect(response.body.recurrence_rule).toBe('FREQ=MONTHLY;INTERVAL=2;BYDAY=SA,SU');
      
      // Verify the group was updated in the database
      const updatedGroup = await Group.findById(testGroup._id);
      expect(updatedGroup.name).toBe('Updated Group');
    });

    test('should update partial fields', async () => {
      const partialUpdate = {
        name: 'Partially Updated Group'
      };

      const response = await request(app)
        .put(`/api/groups/${testGroup._id}`)
        .send(partialUpdate);
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Partially Updated Group');
      expect(response.body.recurrence_rule).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR'); // Unchanged
    });

    test('should return 404 for non-existent group', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/groups/${nonExistentId}`)
        .send({ name: 'Updated Title' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Group not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app)
        .put('/api/groups/invalid-id')
        .send({ name: 'Updated Title' });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // DELETE /api/groups/:id - Delete group
  describe('DELETE /api/groups/:id', () => {
    test('should delete an existing group', async () => {
      const response = await request(app).delete(`/api/groups/${testGroup._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Group deleted successfully');
      
      // Verify the group was deleted from the database
      const deletedGroup = await Group.findById(testGroup._id);
      expect(deletedGroup).toBeNull();
    });

    test('should return 404 for non-existent group', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).delete(`/api/groups/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Group not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app).delete('/api/groups/invalid-id');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });
});
