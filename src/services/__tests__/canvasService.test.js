import canvasService from '../canvasService';

// Mock fetch globally
global.fetch = jest.fn();

describe('Canvas Service', () => {
  const testUserId = 'test-user-id';
  const testToken = 'test-token';
  const testDomain = 'harvard';

  beforeEach(() => {
    // Create storage mock
    const storageMock = {
      store: {},
      getItem: jest.fn((key) => storageMock.store[key] || null),
      setItem: jest.fn((key, value) => { storageMock.store[key] = value; }),
      removeItem: jest.fn((key) => { delete storageMock.store[key]; }),
      clear: jest.fn(() => { storageMock.store = {}; })
    };

    // Replace localStorage with our mock
    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      writable: true
    });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('credential management', () => {
    test('setCredentials stores token and formats domain correctly', async () => {
      // Mock POST to create integration
      fetch.mockImplementationOnce(async (url, options) => {
        if (url.endsWith('/api/lmsintegration') && options.method === 'POST') {
          return {
            ok: true,
            json: () => Promise.resolve({ success: true })
          };
        }
      });

      // Mock GET for testConnection
      fetch.mockImplementationOnce(async (url) => {
        if (url.endsWith('/api/lmsintegration')) {
          return {
            ok: true,
            json: () => Promise.resolve([{
              user_id: testUserId,
              lms_type: 'CANVAS',
              token: `Bearer ${testToken}`,
              domain: `canvas.${testDomain}.edu`
            }])
          };
        }
      });

      // Mock Canvas API test connection
      fetch.mockImplementationOnce(async () => ({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: 'Test User' })
      }));

      // This should complete without throwing an error
      await expect(canvasService.setCredentials(testToken, testDomain, testUserId)).resolves.not.toThrow();

      // Verify the POST request was made with correct data
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/lmsintegration'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(testToken)
        })
      );
    });

    test('clearCredentials removes integration', async () => {
      // Mock GET to find integration
      fetch.mockImplementationOnce(async () => ({
        ok: true,
        json: () => Promise.resolve([{
          _id: 'test-integration-id',
          user_id: testUserId,
          lms_type: 'CANVAS'
        }])
      }));

      // Mock DELETE integration
      fetch.mockImplementationOnce(async () => ({
        ok: true,
        json: () => Promise.resolve({ success: true })
      }));

      await canvasService.clearCredentials(testUserId);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/lmsintegration/test-integration-id'), expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('syncWithCalendar', () => {
    test('successfully syncs assignments', async () => {
      // Mock sync endpoint
      fetch.mockImplementationOnce(async () => ({
        ok: true,
        json: () => Promise.resolve({ eventsAdded: 5 })
      }));

      const result = await canvasService.syncWithCalendar(testUserId);
      expect(result).toBe(5);
    });

    test('handles sync failure', async () => {
      fetch.mockImplementationOnce(async () => ({
        ok: false,
        json: () => Promise.resolve({ message: 'Sync failed' })
      }));

      await expect(canvasService.syncWithCalendar(testUserId)).rejects.toThrow('Sync failed');
    });
  });
});
