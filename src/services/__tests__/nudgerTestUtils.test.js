import { createTestEvent, generateTestEvents, testNudger } from '../nudgerTestUtils';
import * as nudgerService from '../nudgerService';

// Mock the nudgerService functions
jest.mock('../nudgerService', () => ({
  identifyUpcomingEvents: jest.fn(),
  getStudyPlan: jest.fn()
}));

describe('Nudger Test Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTestEvent', () => {
    test('should create a test event with the specified title and date', () => {
      const title = 'Test Event';
      const date = new Date('2025-04-01');
      
      const event = createTestEvent(title, date);
      
      expect(event.title).toBe(title);
      expect(event.start).toContain('2025-04-01T09:00');
      expect(event.end).toContain('2025-04-01T10:00');
      expect(event.allDay).toBe(false);
    });

    test('should accept a date string', () => {
      const title = 'Test Event';
      const dateString = '2025-04-01';
      
      const event = createTestEvent(title, dateString);
      
      expect(event.title).toBe(title);
      expect(event.start).toContain('2025-04-01T09:00');
    });

    test('should apply additional options', () => {
      const title = 'Test Event';
      const date = new Date('2025-04-01');
      const options = {
        description: 'Test description',
        allDay: true,
        location: 'Test location'
      };
      
      const event = createTestEvent(title, date, options);
      
      expect(event.title).toBe(title);
      expect(event.description).toBe('Test description');
      expect(event.allDay).toBe(true);
      expect(event.location).toBe('Test location');
    });
  });

  describe('generateTestEvents', () => {
    test('should generate multiple test events', () => {
      const events = generateTestEvents();
      
      // Should generate events (exact count may vary due to weekends being skipped)
      expect(events.length).toBeGreaterThan(10);
      
      // Check that different types of events are generated
      const eventTypes = new Set(events.map(e => e.title));
      expect(eventTypes.size).toBeGreaterThan(1);
      
      // Check for specific event types that are guaranteed to be generated
      const titles = events.map(e => e.title);
      expect(titles).toContain('Lecture');
      expect(titles).toContain('Quiz');
      
      // Verify that events have the expected properties
      const sampleEvent = events[0];
      expect(sampleEvent).toHaveProperty('id');
      expect(sampleEvent).toHaveProperty('title');
      expect(sampleEvent).toHaveProperty('start');
      expect(sampleEvent).toHaveProperty('end');
      expect(sampleEvent).toHaveProperty('description');
    });
  });

  describe('testNudger', () => {
    test('should call nudger service functions with test events', () => {
      // Mock the nudger service functions to return test data
      nudgerService.identifyUpcomingEvents.mockReturnValue([
        { id: '1', title: 'Test Event 1', requiresStudy: true },
        { id: '2', title: 'Test Event 2', requiresStudy: true }
      ]);
      
      nudgerService.getStudyPlan.mockReturnValue({
        events: [
          { id: '1', title: 'Test Event 1', requiresStudy: true },
          { id: '2', title: 'Test Event 2', requiresStudy: true }
        ],
        totalStudyHours: 8,
        eventCount: 2,
        eventsByDate: {
          '2025-04-01': [{ id: '1', title: 'Test Event 1', requiresStudy: true }],
          '2025-04-02': [{ id: '2', title: 'Test Event 2', requiresStudy: true }]
        }
      });
      
      const result = testNudger();
      
      // Check that the nudger service functions were called
      expect(nudgerService.identifyUpcomingEvents).toHaveBeenCalled();
      expect(nudgerService.getStudyPlan).toHaveBeenCalled();
      
      // Check the result structure
      expect(result).toHaveProperty('allEvents');
      expect(result).toHaveProperty('studyEvents');
      expect(result).toHaveProperty('studyPlan');
      
      // Check that the study events were returned
      expect(result.studyEvents.length).toBe(2);
      expect(result.studyPlan.eventCount).toBe(2);
      expect(result.studyPlan.totalStudyHours).toBe(8);
    });
  });
});
