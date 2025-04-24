import googleCalendarDbService from '../googleCalendarDbService';

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to suppress logs during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Mock window.dispatchEvent
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, 'dispatchEvent', {
  writable: true,
  value: mockDispatchEvent
});

describe('googleCalendarDbService', () => {
  beforeEach(() => {
    global.fetch.mockClear();
    mockDispatchEvent.mockClear();
  });

  describe('storeGoogleEventsInDb', () => {
    it('should dispatch calendarDataUpdated event after each batch', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imported: 2,
          updated: 1,
          deleted: 0,
          skipped: 0,
          errors: []
        })
      });

      // Sample events (just enough for one batch)
      const events = [
        {
          title: 'Test Event 1',
          start: new Date(),
          end: new Date(Date.now() + 3600000),
          allDay: false,
          googleEventId: 'test_event_1'
        },
        {
          title: 'Test Event 2',
          start: new Date(),
          end: new Date(Date.now() + 7200000),
          allDay: true,
          googleEventId: 'test_event_2'
        }
      ];

      // Call the function
      await googleCalendarDbService.storeGoogleEventsInDb(events, 'test-user-id');

      // Check that window.dispatchEvent was called with the correct event
      expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
      expect(mockDispatchEvent.mock.calls[0][0].type).toBe('calendarDataUpdated');
    });

    it('should dispatch calendarDataUpdated event for each batch when processing multiple batches', async () => {
      // Create enough events to trigger multiple batches (using the default BATCH_SIZE of 200)
      // For testing, we'll use a small number like 250 events to trigger 2 batches
      const manyEvents = Array(250).fill().map((_, index) => ({
        title: `Test Event ${index}`,
        start: new Date(),
        end: new Date(Date.now() + 3600000),
        allDay: false,
        googleEventId: `test_event_${index}`
      }));

      // Mock successful responses for both batches
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imported: 200,
          updated: 0,
          deleted: 0,
          skipped: 0,
          errors: []
        })
      });
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imported: 50,
          updated: 0,
          deleted: 0,
          skipped: 0,
          errors: []
        })
      });

      // Call the function with many events
      await googleCalendarDbService.storeGoogleEventsInDb(manyEvents, 'test-user-id');

      // Check that window.dispatchEvent was called twice (once for each batch)
      expect(mockDispatchEvent).toHaveBeenCalledTimes(2);
      expect(mockDispatchEvent.mock.calls[0][0].type).toBe('calendarDataUpdated');
      expect(mockDispatchEvent.mock.calls[1][0].type).toBe('calendarDataUpdated');
    });

    it('should not dispatch calendarDataUpdated event if batch processing fails', async () => {
      // Mock a failed response
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Sample events
      const events = [
        {
          title: 'Test Event 1',
          start: new Date(),
          end: new Date(Date.now() + 3600000),
          allDay: false,
          googleEventId: 'test_event_1'
        }
      ];

      // Call the function (it will catch the error internally)
      await googleCalendarDbService.storeGoogleEventsInDb(events, 'test-user-id');

      // Check that window.dispatchEvent was not called
      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });

    it('should handle empty events array gracefully', async () => {
      // Call the function with empty events array
      await googleCalendarDbService.storeGoogleEventsInDb([], 'test-user-id');

      // Check that window.dispatchEvent was not called (no batches to process)
      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });
  });
});
