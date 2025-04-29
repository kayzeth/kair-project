import googleCalendarDbService from '../googleCalendarDbService';
import googleCalendarService from '../googleCalendarService';

// Mock fetch
global.fetch = jest.fn();

// Mock googleCalendarService
jest.mock('../googleCalendarService', () => ({
  isSignedIn: jest.fn(),
  importEvents: jest.fn()
}));

// Mock console methods to suppress logs during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
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
    jest.clearAllMocks();
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

  describe('getSyncToken', () => {
    it('should fetch and return the sync token for a user', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ syncToken: 'test-sync-token' })
      });

      const result = await googleCalendarDbService.getSyncToken('test-user-id');
      
      // Check fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith('/api/users/test-user-id/google-sync-token');
      
      // Check the result
      expect(result).toBe('test-sync-token');
    });

    it('should return null if the fetch fails', async () => {
      // Mock failed response
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await googleCalendarDbService.getSyncToken('test-user-id');
      
      // Check the result
      expect(result).toBeNull();
    });

    it('should return null if the response is not ok', async () => {
      // Mock unsuccessful response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await googleCalendarDbService.getSyncToken('test-user-id');
      
      // Check the result
      expect(result).toBeNull();
    });
  });

  describe('saveSyncToken', () => {
    it('should save the sync token for a user', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await googleCalendarDbService.saveSyncToken('test-user-id', 'test-sync-token');
      
      // Check fetch was called with correct URL and data
      expect(global.fetch).toHaveBeenCalledWith('/api/events/google-sync-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-id', syncToken: 'test-sync-token' }),
      });
      
      // Check the result
      expect(result).toBe(true);
    });

    it('should return false if the sync token is not provided', async () => {
      const result = await googleCalendarDbService.saveSyncToken('test-user-id', '');
      
      // Check fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Check the result
      expect(result).toBe(false);
    });

    it('should return false if the fetch fails', async () => {
      // Mock failed response
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await googleCalendarDbService.saveSyncToken('test-user-id', 'test-sync-token');
      
      // Check the result
      expect(result).toBe(false);
    });

    it('should return false if the response is not ok', async () => {
      // Mock unsuccessful response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await googleCalendarDbService.saveSyncToken('test-user-id', 'test-sync-token');
      
      // Check the result
      expect(result).toBe(false);
    });
  });

  describe('clearSyncData', () => {
    it('should clear the sync token for a user', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await googleCalendarDbService.clearSyncData('test-user-id');
      
      // Check fetch was called with correct URL and data
      expect(global.fetch).toHaveBeenCalledWith('/api/users/test-user-id/google-sync-token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncToken: '' }),
      });
      
      // Check the result
      expect(result).toBe(true);
    });

    it('should return false if the user ID is not provided', async () => {
      const result = await googleCalendarDbService.clearSyncData();
      
      // Function should return false, not throw
      expect(result).toBe(false);
      
      // Check fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return false if the fetch fails', async () => {
      // Mock failed response
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await googleCalendarDbService.clearSyncData('test-user-id');
      
      // Check the result
      expect(result).toBe(false);
    });

    it('should return false if the response is not ok', async () => {
      // Mock unsuccessful response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await googleCalendarDbService.clearSyncData('test-user-id');
      
      // Check the result
      expect(result).toBe(false);
    });
  });

  describe('storeGoogleEventsInDb - additional tests', () => {
    it('should throw an error if the user ID is not provided', async () => {
      await expect(googleCalendarDbService.storeGoogleEventsInDb([{ title: 'Test' }])).rejects.toThrow('User ID is required');
      
      // Check fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle server errors with status code 504', async () => {
      // Mock a 504 Gateway Timeout response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        statusText: 'Gateway Timeout'
      });

      const events = [{ title: 'Test Event', googleEventId: 'test_id' }];

      // Call the function and expect it to catch the error internally
      const result = await googleCalendarDbService.storeGoogleEventsInDb(events, 'test-user-id');
      
      // Check that the error was recorded
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Server timeout');
    });

    it('should handle server errors with JSON error response', async () => {
      // Mock an error response with JSON error details
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid event data' })
      });

      const events = [{ title: 'Test Event', googleEventId: 'test_id' }];

      // Call the function and expect it to catch the error internally
      const result = await googleCalendarDbService.storeGoogleEventsInDb(events, 'test-user-id');
      
      // Check that the error was recorded
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Invalid event data');
    });

    it('should handle server errors with text error response', async () => {
      // Mock an error response with text error details
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('Internal Server Error')
      });

      const events = [{ title: 'Test Event', googleEventId: 'test_id' }];

      // Call the function and expect it to catch the error internally
      const result = await googleCalendarDbService.storeGoogleEventsInDb(events, 'test-user-id');
      
      // Check that the error was recorded
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Server error: Internal Server Error');
    });
  });

  describe('syncGoogleCalendarWithDb', () => {
    beforeEach(() => {
      // Mock googleCalendarService.isSignedIn to return true
      googleCalendarService.isSignedIn.mockReturnValue(true);
    });

    it('should sync Google Calendar events with the database', async () => {
      // Mock getSyncToken to return null (full sync)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ syncToken: null })
      });

      // Mock googleCalendarService.importEvents
      const mockEvents = [{ id: 'event1', summary: 'Test Event' }];
      googleCalendarService.importEvents.mockResolvedValueOnce({
        events: mockEvents,
        nextSyncToken: 'new-sync-token'
      });

      // Mock storeGoogleEventsInDb
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imported: 1,
          updated: 0,
          deleted: 0,
          skipped: 0,
          errors: []
        })
      });

      // Mock saveSyncToken
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await googleCalendarDbService.syncGoogleCalendarWithDb('test-user-id');
      
      // Check that googleCalendarService.importEvents was called with correct parameters
      expect(googleCalendarService.importEvents).toHaveBeenCalled();
      
      // Check the result
      expect(result).toEqual({
        events: mockEvents,
        databaseResults: expect.any(Object),
        nextSyncToken: 'new-sync-token'
      });
    });

    it('should throw an error if the user ID is not provided', async () => {
      await expect(googleCalendarDbService.syncGoogleCalendarWithDb()).rejects.toThrow('User ID is required');
    });

    it('should throw an error if the user is not signed in to Google Calendar', async () => {
      // Mock googleCalendarService.isSignedIn to return false
      googleCalendarService.isSignedIn.mockReturnValue(false);

      await expect(googleCalendarDbService.syncGoogleCalendarWithDb('test-user-id')).rejects.toThrow('User is not signed in');
    });

    it('should handle 410 Gone error by clearing sync token and retrying', async () => {
      // Mock getSyncToken to return a sync token
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ syncToken: 'old-sync-token' })
      });

      // Mock googleCalendarService.importEvents to throw a 410 error
      googleCalendarService.importEvents.mockRejectedValueOnce({
        message: 'Sync token is no longer valid (410)'
      });

      // Mock clearSyncData
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      // Mock the second call to googleCalendarService.importEvents (after retry)
      const mockEvents = [{ id: 'event1', summary: 'Test Event' }];
      googleCalendarService.importEvents.mockResolvedValueOnce({
        events: mockEvents,
        nextSyncToken: 'new-sync-token'
      });

      // Mock storeGoogleEventsInDb
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          imported: 1,
          updated: 0,
          deleted: 0,
          skipped: 0,
          errors: []
        })
      });

      // Mock saveSyncToken
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await googleCalendarDbService.syncGoogleCalendarWithDb('test-user-id');
      
      // Check that googleCalendarService.importEvents was called twice
      expect(googleCalendarService.importEvents).toHaveBeenCalledTimes(2);
      
      // Check the result
      expect(result).toEqual({
        events: mockEvents,
        databaseResults: expect.any(Object),
        nextSyncToken: 'new-sync-token'
      });
    });

    it('should handle server timeout errors with descriptive message in the results', async () => {
      // Mock getSyncToken
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ syncToken: null })
      });

      // Mock googleCalendarService.importEvents
      const mockEvents = [{ id: 'event1', summary: 'Test Event' }];
      googleCalendarService.importEvents.mockResolvedValueOnce({
        events: mockEvents,
        nextSyncToken: 'new-sync-token'
      });

      // Mock storeGoogleEventsInDb to return a server timeout error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        statusText: 'Gateway Timeout'
      });

      // Call the function and expect it to resolve with error information
      const result = await googleCalendarDbService.syncGoogleCalendarWithDb('test-user-id');
      
      // Verify the result contains the error information
      expect(result.databaseResults.errors.length).toBeGreaterThan(0);
      expect(result.databaseResults.errors[0].message).toContain('Server timeout');
    });

    it('should handle other errors with generic message', async () => {
      // Mock getSyncToken
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ syncToken: null })
      });

      // Mock googleCalendarService.importEvents to throw a generic error
      googleCalendarService.importEvents.mockRejectedValueOnce(new Error('Network error'));

      await expect(googleCalendarDbService.syncGoogleCalendarWithDb('test-user-id')).rejects.toThrow('Failed to sync with Google Calendar: Network error');
    });
  });

  // Note: forceSyncGoogleCalendar tests have been moved to a separate file
  // to properly isolate and test the function with proper mocking

  describe('deleteAllGoogleEvents', () => {
    it('should delete all Google Calendar events for a user', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deletedCount: 5 })
      });

      // Mock clearSyncData
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await googleCalendarDbService.deleteAllGoogleEvents('test-user-id');
      
      // Check fetch was called with correct URL
      expect(global.fetch).toHaveBeenCalledWith('/api/events/google-delete-all/test-user-id', {
        method: 'DELETE',
      });
      
      // Check the result
      expect(result).toEqual({ deletedCount: 5 });
    });

    it('should throw an error if the user ID is not provided', async () => {
      await expect(googleCalendarDbService.deleteAllGoogleEvents()).rejects.toThrow('User ID is required');
      
      // Check fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw an error if the fetch fails', async () => {
      // Mock failed response
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(googleCalendarDbService.deleteAllGoogleEvents('test-user-id')).rejects.toThrow('Network error');
    });

    it('should throw an error if the response is not ok', async () => {
      // Mock unsuccessful response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      });

      await expect(googleCalendarDbService.deleteAllGoogleEvents('test-user-id')).rejects.toThrow('Failed to delete Google Calendar events');
    });
  });
});
