const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const bodyParser = require('body-parser');
const Event = require('../models/Event');
const eventRoutes = require('../routes/events');

// Set up MongoDB Memory Server for testing
let mongoServer;
let app;

beforeAll(async () => {
  // Set up MongoDB in-memory server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Set up Express app for testing
  app = express();
  app.use(bodyParser.json());
  app.use('/api/events', eventRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Events API Routes', () => {
  // Clear the database before each test
  beforeEach(async () => {
    await Event.deleteMany({});
  });

  describe('POST /api/events/google-import', () => {
    it('should import Google Calendar events', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const events = [
        {
          title: 'Google Event 1',
          description: 'Description 1',
          location: 'Location 1',
          start: new Date(),
          end: new Date(Date.now() + 3600000),
          allDay: false,
          color: '#d2b48c',
          googleEventId: 'google_event_1'
        },
        {
          title: 'Google Event 2',
          description: 'Description 2',
          location: 'Location 2',
          start: new Date(),
          end: new Date(Date.now() + 7200000),
          allDay: true,
          color: '#3a86ff',
          googleEventId: 'google_event_2'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({ events, userId })
        .expect(200);

      expect(response.body.message).toBe('Google Calendar import completed');
      expect(response.body.results.imported).toBe(2);
      expect(response.body.results.skipped).toBe(0);
      expect(response.body.results.updated).toBe(0);

      // Check that events were saved to the database
      const savedEvents = await Event.find({ source: 'GOOGLE_CALENDAR' });
      expect(savedEvents.length).toBe(2);
      expect(savedEvents[0].google_event_id).toBe('google_event_1');
      expect(savedEvents[1].google_event_id).toBe('google_event_2');
      
      // Verify group_id is not required
      expect(savedEvents[0].group_id).toBeUndefined();
    });

    it('should update existing events with the same google_event_id', async () => {
      // First, create an event
      const userId = new mongoose.Types.ObjectId().toString();
      const existingEvent = new Event({
        user_id: userId,
        title: 'Existing Google Event',
        all_day: false,
        start_time: new Date(),
        end_time: new Date(Date.now() + 3600000),
        source: 'GOOGLE_CALENDAR',
        description: 'Original description',
        location: 'Original location',
        google_event_id: 'existing_google_event'
      });
      await existingEvent.save();

      // Now try to import the same event with updated details
      const events = [
        {
          title: 'Updated Google Event',
          description: 'Updated description',
          location: 'Updated location',
          start: new Date(),
          end: new Date(Date.now() + 3600000),
          allDay: false,
          color: '#ff6f61',
          googleEventId: 'existing_google_event'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({ events, userId })
        .expect(200);

      expect(response.body.results.updated).toBe(1);
      expect(response.body.results.imported).toBe(0);

      // Check that the event was updated
      const updatedEvent = await Event.findOne({ google_event_id: 'existing_google_event' });
      expect(updatedEvent.title).toBe('Updated Google Event');
      expect(updatedEvent.description).toBe('Updated description');
    });

    it('should handle invalid request data', async () => {
      // Missing userId
      const response1 = await request(app)
        .post('/api/events/google-import')
        .send({ events: [] })
        .expect(400);

      expect(response1.body.message).toContain('userId is required');

      // Events not an array
      const response2 = await request(app)
        .post('/api/events/google-import')
        .send({ events: 'not an array', userId: 'user123' })
        .expect(400);

      expect(response2.body.message).toContain('Events must be an array');
    });

    it('should handle validation errors on event creation', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const events = [
        {
          // Missing title (required field)
          description: 'Description without title',
          start: new Date(),
          end: new Date(Date.now() + 3600000),
          allDay: false,
          googleEventId: 'invalid_event'
        }
      ];

      const response = await request(app)
        .post('/api/events/google-import')
        .send({ events, userId })
        .expect(200);

      // The endpoint should handle the validation error and continue
      expect(response.body.results.errors).toBeInstanceOf(Array);
      expect(response.body.results.errors.length).toBe(1);
      expect(response.body.results.errors[0]).toHaveProperty('eventId', 'invalid_event');
      expect(response.body.results.errors[0]).toHaveProperty('error', 'Missing required fields');
    });
  });
});
