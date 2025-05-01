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

  describe('course fetching', () => {
    // test('fetches all courses across multiple pages', async () => {
    //   // Mock first page of courses with Link header for pagination
    //   fetch.mockImplementationOnce(async () => ({
    //     ok: true,
    //     headers: {
    //       get: (header) => {
    //         if (header === 'Link') {
    //           return '<http://canvas/api/v1/courses?page=2>; rel="next", <http://canvas/api/v1/courses?page=3>; rel="last"';
    //         }
    //         return null;
    //       }
    //     },
    //     json: () => Promise.resolve([
    //       { id: 1, name: 'Course 1' },
    //       { id: 2, name: 'Course 2' }
    //     ])
    //   }));

    //   // Mock second page
    //   fetch.mockImplementationOnce(async () => ({
    //     ok: true,
    //     headers: {
    //       get: (header) => {
    //         if (header === 'Link') {
    //           return '<http://canvas/api/v1/courses?page=3>; rel="next", <http://canvas/api/v1/courses?page=3>; rel="last", <http://canvas/api/v1/courses?page=1>; rel="first", <http://canvas/api/v1/courses?page=1>; rel="prev"';
    //         }
    //         return null;
    //       }
    //     },
    //     json: () => Promise.resolve([
    //       { id: 3, name: 'Course 3' },
    //       { id: 4, name: 'Course 4' }
    //     ])
    //   }));

    //   // Mock third/final page
    //   fetch.mockImplementationOnce(async () => ({
    //     ok: true,
    //     headers: {
    //       get: (header) => {
    //         if (header === 'Link') {
    //           return '<http://canvas/api/v1/courses?page=1>; rel="first", <http://canvas/api/v1/courses?page=2>; rel="prev"';
    //         }
    //         return null;
    //       }
    //     },
    //     json: () => Promise.resolve([
    //       { id: 5, name: 'Course 5' }
    //     ])
    //   }));

    //   const courses = await canvasService.fetchEnrolledCourses();

    //   // Should have fetched all courses from all pages
    //   expect(courses.length).toBe(5);
    //   expect(courses.map(c => c.id)).toEqual([1, 2, 3, 4, 5]);

    //   // Should have made 3 fetch calls
    //   expect(fetch).toHaveBeenCalledTimes(3);
      
    //   // Verify first call includes per_page parameter
    //   expect(fetch).toHaveBeenCalledWith(
    //     expect.stringContaining('courses?include[]=term&per_page=100')
    //   );
    // });

    test('handles empty course list', async () => {
      fetch.mockImplementationOnce(async () => ({
        ok: true,
        headers: { get: () => null },
        json: () => Promise.resolve([])
      }));

      const courses = await canvasService.fetchEnrolledCourses();
      expect(courses).toEqual([]);
    });

    test('handles API errors', async () => {
      fetch.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error')
      }));

      await expect(canvasService.fetchEnrolledCourses())
        .rejects
        .toThrow('Failed to fetch courses');
    });
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
