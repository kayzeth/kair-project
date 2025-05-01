const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const eventsRouter = require('../routes/events');
const Event = require('../models/Event');
const User = require('../models/User');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/events', eventsRouter);

describe('Events API Routes', () => {
  let mongoServer;
  let testUser;
  let testEvent;

  // Set up MongoDB Memory Server before tests
  beforeAll(async () => {
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
  });

  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Clear the database between tests
  beforeEach(async () => {
    await Event.deleteMany({});
    
    // Create a test event before each test
    testEvent = new Event({
      user_id: testUser._id.toString(),
      title: 'Test Event',
      all_day: false,
      start_time: new Date('2025-05-01T10:00:00Z'),
      end_time: new Date('2025-05-01T12:00:00Z'),
      description: 'Test description',
      location: 'Test location',
      requires_preparation: false,
      color: '#ff0000',
      source: 'SYLLABUS'
    });
    await testEvent.save();
  });

  // GET /api/events - Get all events
  describe('GET /api/events', () => {
    test('should return all events', async () => {
      const response = await request(app).get('/api/events');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Test Event');
    });

    test('should handle server errors', async () => {
      // Mock Event.find to throw an error
      const originalFind = Event.find;
      Event.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get('/api/events');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');

      // Restore the original function
      Event.find = originalFind;
    });
  });

  // GET /api/events/user/:userId - Get events by user_id
  describe('GET /api/events/user/:userId', () => {
    test('should return events for a specific user', async () => {
      const response = await request(app).get(`/api/events/user/${testUser._id}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].user_id).toBe(testUser._id.toString());
    });

    test('should return empty array for user with no events', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/events/user/${nonExistentUserId}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    test('should handle server errors', async () => {
      // Mock Event.find to throw an error
      const originalFind = Event.find;
      Event.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get(`/api/events/user/${testUser._id}`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');

      // Restore the original function
      Event.find = originalFind;
    });
  });

  // GET /api/events/:id - Get event by ID
  describe('GET /api/events/:id', () => {
    test('should return a specific event by ID', async () => {
      const response = await request(app).get(`/api/events/${testEvent._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body._id).toBe(testEvent._id.toString());
      expect(response.body.title).toBe('Test Event');
    });

    test('should return 404 for non-existent event', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/events/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Event not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app).get('/api/events/invalid-id');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // POST /api/events - Create new event
  describe('POST /api/events', () => {
    test('should create a new event', async () => {
      const newEvent = {
        user_id: testUser._id.toString(),
        title: 'New Event',
        all_day: true,
        start_time: '2025-05-02T10:00:00Z',
        end_time: '2025-05-02T12:00:00Z',
        description: 'New description',
        location: 'New location',
        requires_preparation: true,
        color: '#00ff00',
        source: 'SYLLABUS'
      };

      const response = await request(app)
        .post('/api/events')
        .send(newEvent);
      
      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Event');
      expect(response.body.all_day).toBe(true);
      expect(response.body.requires_preparation).toBe(true);
      
      // Verify the event was saved to the database
      const savedEvent = await Event.findById(response.body._id);
      expect(savedEvent).not.toBeNull();
      expect(savedEvent.title).toBe('New Event');
    });

    test('should handle validation errors', async () => {
      // Missing required fields
      const invalidEvent = {
        user_id: testUser._id.toString(),
        // Missing title and other required fields
      };

      const response = await request(app)
        .post('/api/events')
        .send(invalidEvent);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // PUT /api/events/:id - Update event
  describe('PUT /api/events/:id', () => {
    test('should update an existing event', async () => {
      const updatedData = {
        title: 'Updated Event',
        description: 'Updated description',
        color: '#0000ff'
      };

      const response = await request(app)
        .put(`/api/events/${testEvent._id}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Event');
      expect(response.body.description).toBe('Updated description');
      expect(response.body.color).toBe('#0000ff');
      
      // Verify the event was updated in the database
      const updatedEvent = await Event.findById(testEvent._id);
      expect(updatedEvent.title).toBe('Updated Event');
    });

    test('should return 404 for non-existent event', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/events/${nonExistentId}`)
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Event not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app)
        .put('/api/events/invalid-id')
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // DELETE /api/events/:id - Delete event
  describe('DELETE /api/events/:id', () => {
    test('should delete an existing event', async () => {
      const response = await request(app).delete(`/api/events/${testEvent._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Event deleted successfully');
      
      // Verify the event was deleted from the database
      const deletedEvent = await Event.findById(testEvent._id);
      expect(deletedEvent).toBeNull();
    });

    test('should return 404 for non-existent event', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).delete(`/api/events/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Event not found');
    });

    test('should handle invalid ID format', async () => {
      const response = await request(app).delete('/api/events/invalid-id');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  // GET /api/events/related/:eventId - Get related study sessions
  describe('GET /api/events/related/:eventId', () => {
    test('should return empty array for event with no related study sessions', async () => {
      const response = await request(app).get(`/api/events/related/${testEvent._id}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    test('should handle server errors', async () => {
      // Mock Event.find to throw an error
      const originalFind = Event.find;
      Event.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get(`/api/events/related/${testEvent._id}`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');

      // Restore the original function
      Event.find = originalFind;
    });
  });

  // DELETE /api/events/google-delete-all/:userId - Delete all Google Calendar events for a user
  describe('DELETE /api/events/google-delete-all/:userId', () => {
    test('should delete all Google Calendar events for a user', async () => {
      // Create some Google Calendar events for the test user
      const googleEvent1 = new Event({
        user_id: testUser._id.toString(),
        title: 'Google Event 1',
        all_day: false,
        start_time: new Date('2025-05-03T10:00:00Z'),
        end_time: new Date('2025-05-03T12:00:00Z'),
        source: 'GOOGLE_CALENDAR',
        google_event_id: 'google-event-1'
      });
      await googleEvent1.save();

      const googleEvent2 = new Event({
        user_id: testUser._id.toString(),
        title: 'Google Event 2',
        all_day: false,
        start_time: new Date('2025-05-04T10:00:00Z'),
        end_time: new Date('2025-05-04T12:00:00Z'),
        source: 'GOOGLE_CALENDAR',
        google_event_id: 'google-event-2'
      });
      await googleEvent2.save();

      const response = await request(app).delete(`/api/events/google-delete-all/${testUser._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.deletedCount).toBe(2);
      
      // Verify the Google Calendar events were deleted
      const remainingGoogleEvents = await Event.find({
        user_id: testUser._id.toString(),
        $or: [{ source: 'GOOGLE_CALENDAR' }, { type: 'google' }]
      });
      expect(remainingGoogleEvents.length).toBe(0);
      
      // Verify the manual event still exists
      const manualEvent = await Event.findById(testEvent._id);
      expect(manualEvent).not.toBeNull();
    });

    test('should handle server errors', async () => {
      // Mock Event.deleteMany to throw an error
      const originalDeleteMany = Event.deleteMany;
      Event.deleteMany = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).delete(`/api/events/google-delete-all/${testUser._id}`);
      
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');

      // Restore the original function
      Event.deleteMany = originalDeleteMany;
    });
  });

  // POST /api/events/google-import - Import events from Google Calendar
  describe('POST /api/events/google-import', () => {
    test('should import Google Calendar events', async () => {
      const googleEvents = [
        {
          title: 'Google Event 1',
          allDay: false,
          start: '2025-05-05T10:00:00Z',
          end: '2025-05-05T12:00:00Z',
          description: 'Google description 1',
          location: 'Google location 1',
          color: '#ff00ff',
          googleEventId: 'google-event-id-1'
        },
        {
          title: 'Google Event 2',
          allDay: true,
          start: '2025-05-06T00:00:00Z',
          end: '2025-05-07T00:00:00Z',
          description: 'Google description 2',
          location: 'Google location 2',
          color: '#00ffff',
          googleEventId: 'google-event-id-2'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({
          events: googleEvents,
          userId: testUser._id.toString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Google Calendar import completed');
      expect(response.body.results.imported).toBe(2);
      expect(response.body.results.updated).toBe(0);
      
      // Verify the events were saved to the database
      const savedGoogleEvents = await Event.find({
        user_id: testUser._id.toString(),
        source: 'GOOGLE_CALENDAR'
      });
      expect(savedGoogleEvents.length).toBe(2);
    });

    test('should update existing events with the same google_event_id', async () => {
      // Create an existing Google Calendar event
      const existingGoogleEvent = new Event({
        user_id: testUser._id.toString(),
        title: 'Existing Google Event',
        all_day: false,
        start_time: new Date('2025-05-05T10:00:00Z'),
        end_time: new Date('2025-05-05T12:00:00Z'),
        source: 'GOOGLE_CALENDAR',
        google_event_id: 'existing-google-event-id'
      });
      await existingGoogleEvent.save();

      // Import an updated version of the same event
      const googleEvents = [
        {
          title: 'Updated Google Event',
          allDay: false,
          start: '2025-05-05T11:00:00Z',
          end: '2025-05-05T13:00:00Z',
          description: 'Updated description',
          location: 'Updated location',
          color: '#ff00ff',
          googleEventId: 'existing-google-event-id'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({
          events: googleEvents,
          userId: testUser._id.toString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.results.imported).toBe(0);
      expect(response.body.results.updated).toBe(1);
      
      // Verify the event was updated
      const updatedEvent = await Event.findById(existingGoogleEvent._id);
      expect(updatedEvent.title).toBe('Updated Google Event');
      expect(updatedEvent.description).toBe('Updated description');
    });

    test('should handle deleted events', async () => {
      // Create an existing Google Calendar event
      const existingGoogleEvent = new Event({
        user_id: testUser._id.toString(),
        title: 'Existing Google Event',
        all_day: false,
        start_time: new Date('2025-05-05T10:00:00Z'),
        end_time: new Date('2025-05-05T12:00:00Z'),
        source: 'GOOGLE_CALENDAR',
        google_event_id: 'deleted-google-event-id'
      });
      await existingGoogleEvent.save();

      // Import a deleted event
      const googleEvents = [
        {
          isDeleted: true,
          googleEventId: 'deleted-google-event-id'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({
          events: googleEvents,
          userId: testUser._id.toString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.results.deleted).toBe(1);
      
      // Verify the event was deleted
      const deletedEvent = await Event.findById(existingGoogleEvent._id);
      expect(deletedEvent).toBeNull();
    });

    test('should handle invalid request data', async () => {
      const response = await request(app)
        .post('/api/events/google-import')
        .send({
          // Missing events array and userId
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid request. Events must be an array and userId is required.');
    });

    test('should handle validation errors on event creation', async () => {
      const googleEvents = [
        {
          // Missing required fields
          googleEventId: 'invalid-event-id'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({
          events: googleEvents,
          userId: testUser._id.toString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.results.errors.length).toBe(1);
    });
  });

  // Google Calendar sync token routes
  describe('Google Calendar sync token routes', () => {
    test('should update Google Calendar sync token for a user', async () => {
      const response = await request(app)
        .post('/api/events/google-sync-token')
        .send({
          userId: testUser._id.toString(),
          syncToken: 'new-sync-token'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Google Calendar sync token updated successfully');
      expect(response.body.syncToken).toBe('new-sync-token');
      
      // Verify the sync token was updated in the database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.google_calendar_sync_token).toBe('new-sync-token');
    });

    test('should get Google Calendar sync token for a user', async () => {
      // Set a sync token for the user
      testUser.google_calendar_sync_token = 'test-sync-token';
      await testUser.save();

      const response = await request(app).get(`/api/events/google-sync-token/${testUser._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.syncToken).toBe('test-sync-token');
    });

    test('should return 404 for non-existent user when getting sync token', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app).get(`/api/events/google-sync-token/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    test('should return 404 for non-existent user when updating sync token', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/events/google-sync-token')
        .send({
          userId: nonExistentId.toString(),
          syncToken: 'new-sync-token'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    test('should return 400 when userId is missing for updating sync token', async () => {
      const response = await request(app)
        .post('/api/events/google-sync-token')
        .send({
          // Missing userId
          syncToken: 'new-sync-token'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID is required');
    });
  });
});
