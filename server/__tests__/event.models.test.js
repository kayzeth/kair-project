const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Event = require('../models/Event');

// Set up MongoDB Memory Server for testing
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Event Model', () => {
  // Clear the database before each test
  beforeEach(async () => {
    await Event.deleteMany({});
  });

  it('should create an event with all required fields', async () => {
    const eventData = {
      user_id: new mongoose.Types.ObjectId(),
      title: 'Test Event',
      all_day: false,
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000), // 1 hour later
      source: 'GOOGLE_CALENDAR',
      description: 'Test description',
      location: 'Test location'
    };

    const event = new Event(eventData);
    const savedEvent = await event.save();
    
    expect(savedEvent._id).toBeDefined();
    expect(savedEvent.title).toBe(eventData.title);
    expect(savedEvent.source).toBe(eventData.source);
  });

  it('should create an event with group_id when provided', async () => {
    const eventData = {
      user_id: new mongoose.Types.ObjectId(),
      group_id: new mongoose.Types.ObjectId(),
      title: 'Test Event with Group',
      all_day: false,
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000),
      source: 'GOOGLE_CALENDAR'
    };

    const event = new Event(eventData);
    const savedEvent = await event.save();
    
    expect(savedEvent._id).toBeDefined();
    expect(savedEvent.group_id).toEqual(eventData.group_id);
  });

  it('should create an event without group_id', async () => {
    const eventData = {
      user_id: new mongoose.Types.ObjectId(),
      title: 'Test Event without Group',
      all_day: false,
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000),
      source: 'GOOGLE_CALENDAR'
    };

    const event = new Event(eventData);
    const savedEvent = await event.save();
    
    expect(savedEvent._id).toBeDefined();
    expect(savedEvent.group_id).toBeUndefined();
  });

  it('should not create an event without required fields', async () => {
    const eventData = {
      // Missing user_id
      title: 'Test Event without User',
      all_day: false,
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000),
      source: 'GOOGLE_CALENDAR'
    };

    const event = new Event(eventData);
    
    await expect(event.save()).rejects.toThrow();
  });

  it('should create a Google Calendar event with all fields', async () => {
    const eventData = {
      user_id: new mongoose.Types.ObjectId(),
      title: 'Google Calendar Event',
      all_day: false,
      start_time: new Date(),
      end_time: new Date(Date.now() + 3600000),
      source: 'GOOGLE_CALENDAR',
      description: 'Imported from Google Calendar',
      location: 'Google Meet',
      requires_preparation: false,
      color: '#d2b48c',
      google_event_id: 'google_event_123456'
    };

    const event = new Event(eventData);
    const savedEvent = await event.save();
    
    expect(savedEvent._id).toBeDefined();
    expect(savedEvent.source).toBe('GOOGLE_CALENDAR');
    expect(savedEvent.google_event_id).toBe('google_event_123456');
    expect(savedEvent.group_id).toBeUndefined();
  });
});
