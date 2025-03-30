import eventService from '../eventService';

// Mock fetch globally
global.fetch = jest.fn();

describe('Event Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('saveEvents', () => {
    test('successfully saves events to MongoDB', async () => {
      const testEvents = [
        {
          userId: 'test-user-1',
          title: 'Test Assignment',
          description: 'Test Description',
          startDate: new Date('2025-04-01T23:59:59Z'),
          endDate: new Date('2025-04-01T23:59:59Z'),
          canvasEventId: '123',
          courseId: '456',
          type: 'canvas',
          color: '#4287f5',
          isCompleted: false
        }
      ];

      // Mock successful MongoDB save
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, count: 1 })
      });

      const result = await eventService.saveEvents(testEvents, 'test-user-1');
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      // Verify the correct endpoint was called with the right data
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            events: testEvents,
            userId: 'test-user-1'
          })
        })
      );
    });

    test('handles MongoDB save failure', async () => {
      const testEvents = [
        {
          userId: 'test-user-1',
          title: 'Test Assignment',
          type: 'canvas'
        }
      ];

      // Mock MongoDB error
      fetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Database error')
      });

      await expect(eventService.saveEvents(testEvents, 'test-user-1'))
        .rejects
        .toThrow('Database error');
    });

    test('handles network errors', async () => {
      const testEvents = [
        {
          userId: 'test-user-1',
          title: 'Test Assignment',
          type: 'canvas'
        }
      ];

      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(eventService.saveEvents(testEvents, 'test-user-1'))
        .rejects
        .toThrow('Network error');
    });
  });

  describe('getEvents', () => {
    test('successfully retrieves events from MongoDB', async () => {
      const mockEvents = [
        {
          _id: '123',
          userId: 'test-user-1',
          title: 'Test Assignment',
          description: 'Test Description',
          startDate: '2025-04-01T23:59:59Z',
          endDate: '2025-04-01T23:59:59Z',
          canvasEventId: '123',
          courseId: '456',
          type: 'canvas',
          color: '#4287f5',
          isCompleted: false
        }
      ];

      // Mock successful MongoDB query
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents)
      });

      const events = await eventService.getEvents('test-user-1');
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Test Assignment');
      expect(events[0].type).toBe('canvas');

      // Verify the correct endpoint was called
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events/test-user-1'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    test('handles empty result from MongoDB', async () => {
      // Mock empty result
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const events = await eventService.getEvents('test-user-1');
      expect(events).toHaveLength(0);
    });

    test('handles MongoDB query failure', async () => {
      // Mock MongoDB error
      fetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Database error')
      });

      await expect(eventService.getEvents('test-user-1'))
        .rejects
        .toThrow('Database error');
    });
  });
});
