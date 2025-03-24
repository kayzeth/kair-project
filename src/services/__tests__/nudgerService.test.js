import { identifyUpcomingEvents, getStudyPlan } from '../nudgerService';

// Mock date for consistent testing
const mockDate = new Date('2025-03-15T12:00:00');
const originalDate = global.Date;

describe('Nudger Service', () => {
  // Setup mock date
  beforeAll(() => {
    global.Date = class extends Date {
      constructor(date) {
        if (date) {
          return new originalDate(date);
        }
        return new originalDate(mockDate);
      }
      
      static now() {
        return mockDate.getTime();
      }
    };
  });

  // Restore original Date
  afterAll(() => {
    global.Date = originalDate;
  });

  describe('identifyUpcomingEvents', () => {
    test('should return an empty array when no events are provided', () => {
      const result = identifyUpcomingEvents(null);
      expect(result).toEqual([]);
      
      const result2 = identifyUpcomingEvents([]);
      expect(result2).toEqual([]);
    });

    test('should identify events requiring preparation within the next two weeks', () => {
      // Create dates relative to the mock date
      const today = new Date(mockDate);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const twoWeeksFromNow = new Date(today);
      twoWeeksFromNow.setDate(today.getDate() + 14);
      
      const threeWeeksFromNow = new Date(today);
      threeWeeksFromNow.setDate(today.getDate() + 21);
      
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      // Create test events with requiresPreparation flag
      const events = [
        {
          id: '1',
          title: 'Past Event',
          start: `${yesterday.toISOString().split('T')[0]}T09:00`,
          end: `${yesterday.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true
        },
        {
          id: '2',
          title: 'Today Event',
          start: `${today.toISOString().split('T')[0]}T09:00`,
          end: `${today.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: false
        },
        {
          id: '3',
          title: 'Exam Tomorrow',
          start: `${tomorrow.toISOString().split('T')[0]}T09:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true
        },
        {
          id: '4',
          title: 'Quiz Next Week',
          start: `${nextWeek.toISOString().split('T')[0]}T09:00`,
          end: `${nextWeek.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true
        },
        {
          id: '5',
          title: 'Assignment Due',
          start: `${twoWeeksFromNow.toISOString().split('T')[0]}T09:00`,
          end: `${twoWeeksFromNow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true
        },
        {
          id: '6',
          title: 'Three Weeks Event',
          start: `${threeWeeksFromNow.toISOString().split('T')[0]}T09:00`,
          end: `${threeWeeksFromNow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true
        },
      ];
      
      const result = identifyUpcomingEvents(events);
      
      // Should identify 3 events within the next two weeks that require preparation
      expect(result.length).toBe(3);
      
      // Check that the correct events were identified
      expect(result.some(e => e.title === 'Exam Tomorrow')).toBe(true);
      expect(result.some(e => e.title === 'Quiz Next Week')).toBe(true);
      expect(result.some(e => e.title === 'Assignment Due')).toBe(true);
      
      // Check that past, far future, and non-preparation events are not included
      expect(result.some(e => e.title === 'Past Event')).toBe(false);
      expect(result.some(e => e.title === 'Today Event')).toBe(false);
      expect(result.some(e => e.title === 'Three Weeks Event')).toBe(false);
    });

    test('should only identify events with requiresPreparation flag set to true', () => {
      const today = new Date(mockDate);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const events = [
        {
          id: '1',
          title: 'Regular Meeting',
          start: `${tomorrow.toISOString().split('T')[0]}T09:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: false
        },
        {
          id: '2',
          title: 'Exam in Math',
          start: `${tomorrow.toISOString().split('T')[0]}T11:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T12:00`,
          requiresPreparation: true
        },
        {
          id: '3',
          title: 'Quiz on Chapter 5',
          start: `${tomorrow.toISOString().split('T')[0]}T13:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T14:00`,
          requiresPreparation: true
        },
        {
          id: '4',
          title: 'Assignment Due',
          start: `${tomorrow.toISOString().split('T')[0]}T15:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T16:00`,
          requiresPreparation: false
        },
        {
          id: '5',
          title: 'Project Presentation',
          start: `${tomorrow.toISOString().split('T')[0]}T17:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T18:00`,
          requiresPreparation: true
        },
      ];
      
      const result = identifyUpcomingEvents(events);
      
      // Should identify 3 events with requiresPreparation set to true
      expect(result.length).toBe(3);
      
      // Check that the correct events were identified
      expect(result.some(e => e.title === 'Exam in Math')).toBe(true);
      expect(result.some(e => e.title === 'Quiz on Chapter 5')).toBe(true);
      expect(result.some(e => e.title === 'Project Presentation')).toBe(true);
      
      // Check that events without requiresPreparation are not included
      expect(result.some(e => e.title === 'Regular Meeting')).toBe(false);
      expect(result.some(e => e.title === 'Assignment Due')).toBe(false);
    });

    test('should flag events that need preparation hours input', () => {
      const today = new Date(mockDate);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const events = [
        {
          id: '1',
          title: 'Event with Preparation Hours',
          start: `${tomorrow.toISOString().split('T')[0]}T09:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true,
          preparationHours: '5'
        },
        {
          id: '2',
          title: 'Event without Preparation Hours',
          start: `${tomorrow.toISOString().split('T')[0]}T11:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T12:00`,
          requiresPreparation: true
        },
        {
          id: '3',
          title: 'Event with Empty Preparation Hours',
          start: `${tomorrow.toISOString().split('T')[0]}T13:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T14:00`,
          requiresPreparation: true,
          preparationHours: ''
        }
      ];
      
      const result = identifyUpcomingEvents(events);
      
      // Should identify all 3 events
      expect(result.length).toBe(3);
      
      // Check needsPreparationInput flag
      const eventWithHours = result.find(e => e.title === 'Event with Preparation Hours');
      expect(eventWithHours.needsPreparationInput).toBe(false);
      
      const eventWithoutHours = result.find(e => e.title === 'Event without Preparation Hours');
      expect(eventWithoutHours.needsPreparationInput).toBe(true);
      
      const eventWithEmptyHours = result.find(e => e.title === 'Event with Empty Preparation Hours');
      expect(eventWithEmptyHours.needsPreparationInput).toBe(true);
    });
  });

  describe('getStudyPlan', () => {
    test('should return empty plan when no events are provided', () => {
      const result = getStudyPlan([]);
      expect(result).toEqual({
        events: [],
        totalStudyHours: 0,
        eventCount: 0,
        eventsByDate: {}
      });
    });

    test('should calculate correct study hours and group events by date', () => {
      const today = new Date(mockDate);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(today.getDate() + 2);
      
      const events = [
        {
          id: '1',
          title: 'Exam Tomorrow',
          start: `${tomorrow.toISOString().split('T')[0]}T09:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true,
          preparationHours: '5'
        },
        {
          id: '2',
          title: 'Quiz Tomorrow',
          start: `${tomorrow.toISOString().split('T')[0]}T11:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T12:00`,
          requiresPreparation: true,
          preparationHours: '3'
        },
        {
          id: '3',
          title: 'Project Due',
          start: `${dayAfterTomorrow.toISOString().split('T')[0]}T09:00`,
          end: `${dayAfterTomorrow.toISOString().split('T')[0]}T10:00`,
          requiresPreparation: true,
          preparationHours: '4'
        },
        {
          id: '4',
          title: 'Regular Meeting',
          start: `${tomorrow.toISOString().split('T')[0]}T13:00`,
          end: `${tomorrow.toISOString().split('T')[0]}T14:00`,
          requiresPreparation: false
        }
      ];
      
      const result = getStudyPlan(events);
      
      // Should have 3 events that require preparation
      expect(result.eventCount).toBe(3);
      
      // Total study hours should be 12 (5 + 3 + 4)
      expect(result.totalStudyHours).toBe(12);
      
      // Events should be grouped by date
      const tomorrowDate = tomorrow.toISOString().split('T')[0];
      const dayAfterTomorrowDate = dayAfterTomorrow.toISOString().split('T')[0];
      
      expect(result.eventsByDate[tomorrowDate].length).toBe(2);
      expect(result.eventsByDate[dayAfterTomorrowDate].length).toBe(1);
    });
  });
});
