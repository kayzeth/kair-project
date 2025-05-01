const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Event = require('../models/Event');
const lmsintegration = require('../routes/lmsintegration');

// Mock the Canvas API functions to avoid actual HTTP requests
jest.mock('node-fetch', () => jest.fn());


// Set up MongoDB Memory Server for testing
let mongoServer;

beforeAll(async () => {
  // Set up MongoDB in-memory server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Canvas Integration', () => {
  // Clear the database before each test
  beforeEach(async () => {
    await Event.deleteMany({});
  });

  describe('Canvas event creation', () => {
    it('should create Canvas events with requires_hours set to null when requires_preparation is true', async () => {
      // This test directly tests the event creation logic without mocking API calls
      
      // Create a test event with the properties we're interested in
      const userId = new mongoose.Types.ObjectId().toString();
      const testEvent = new Event({
        user_id: userId,
        title: 'Test Canvas Assignment',
        all_day: false,
        start_time: new Date(),
        end_time: new Date(),
        description: 'Test description',
        source: 'CANVAS',
        requires_preparation: true,
        // We're not setting requires_hours to verify the default is null
        study_suggestions_shown: false,
        study_suggestions_accepted: false
      });
      
      // Save the event to the database
      await testEvent.save();
      
      // Retrieve the event from the database
      const savedEvent = await Event.findById(testEvent._id);
      
      // Verify the event has the correct properties
      expect(savedEvent).toBeDefined();
      expect(savedEvent.source).toBe('CANVAS');
      expect(savedEvent.requires_preparation).toBe(true);
      
      // This is the key test: requires_hours should be null or undefined, not 0
      // This verifies that the schema doesn't default to 0
      expect(savedEvent.requires_hours === null || savedEvent.requires_hours === undefined).toBe(true);
      
      // Verify study suggestions flags are properly set
      expect(savedEvent.study_suggestions_shown).toBe(false);
      expect(savedEvent.study_suggestions_accepted).toBe(false);
    });
    
    it('should respect explicitly set requires_hours values for Canvas events', async () => {
      // Create a test event with requires_hours explicitly set to 0
      const userId = new mongoose.Types.ObjectId().toString();
      const testEvent = new Event({
        user_id: userId,
        title: 'Test Canvas Assignment with Hours',
        all_day: false,
        start_time: new Date(),
        end_time: new Date(),
        description: 'Test description',
        source: 'CANVAS',
        requires_preparation: true,
        requires_hours: 0, // Explicitly set to 0
        study_suggestions_shown: false,
        study_suggestions_accepted: false
      });
      
      // Save the event to the database
      await testEvent.save();
      
      // Retrieve the event from the database
      const savedEvent = await Event.findById(testEvent._id);
      
      // Verify the event has the correct properties
      expect(savedEvent).toBeDefined();
      expect(savedEvent.source).toBe('CANVAS');
      expect(savedEvent.requires_preparation).toBe(true);
      
      // Verify that the explicitly set value is preserved
      expect(savedEvent.requires_hours).toBe(0);
    });
  });
});
