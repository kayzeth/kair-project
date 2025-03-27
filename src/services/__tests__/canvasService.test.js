import canvasService from '../canvasService';

// Mock fetch globally
global.fetch = jest.fn();

describe('Canvas Service', () => {
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

  describe('testConnection', () => {
    test('successfully connects with valid credentials', async () => {
      // Set up localStorage with test credentials
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'canvasToken') return 'Bearer test-token';
        if (key === 'canvasDomain') return 'canvas.harvard.edu';
        return null;
      });

      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: 'Test User' })
      });

      const result = await canvasService.testConnection();
      expect(result).toBe(true);
      
      // Verify API call was made with correct domain format and Bearer token
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/canvas/users/self',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'x-canvas-domain': 'canvas.harvard.edu'
          }
        }
      );
    });

    test('fails with invalid credentials', async () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'canvasToken') return 'Bearer invalid-token';
        if (key === 'canvasDomain') return 'canvas.harvard.edu';
        return null;
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Invalid token')
      });

      await expect(canvasService.testConnection()).rejects.toThrow('Invalid token');
    });

    test('fails when credentials are missing', async () => {
      localStorage.getItem.mockReturnValue(null);

      await expect(canvasService.testConnection()).rejects.toThrow('Canvas credentials not found');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('handles network errors', async () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'canvasToken') return 'Bearer test-token';
        if (key === 'canvasDomain') return 'canvas.harvard.edu';
        return null;
      });

      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Temporarily silence console.error for this test
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        await expect(canvasService.testConnection()).rejects.toThrow('Network error');
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
  });

  describe('syncWithCalendar', () => {
    test('successfully syncs assignments to calendar', async () => {
      // Mock localStorage
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'canvasToken') return 'Bearer test-token';
        if (key === 'canvasDomain') return 'canvas.harvard.edu';
        if (key === 'calendarEvents') return '[]';
        return null;
      });

      // Mock courses response with enrollment_state
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { 
            id: 1, 
            name: 'Course 1', 
            enrollment_state: 'active',
            term: {
              start_at: '2025-01-01T00:00:00Z',
              end_at: '2025-12-31T23:59:59Z'
            }
          }
        ])
      });

      // Mock assignments response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 1,
            name: 'Assignment 1',
            due_at: '2025-04-01T23:59:59Z',
            description: 'Test assignment',
            points_possible: 100,
            course_id: 1,
            html_url: 'https://canvas.harvard.edu/courses/1/assignments/1'
          }
        ])
      });

      const eventCount = await canvasService.syncWithCalendar();
      expect(eventCount).toBe(1);
      
      // Verify calendar events were stored
      const expectedEvents = [{
        id: 'canvas-1',
        title: 'Course 1: Assignment 1',
        start: new Date('2025-04-01T23:59:59Z'),
        end: new Date('2025-04-01T23:59:59Z'),
        description: 'Test assignment',
        type: 'canvas',
        allDay: false,
        color: '#4287f5',
        metadata: {
          courseId: 1,
          assignmentId: 1,
          points: 100,
          url: 'https://canvas.harvard.edu/courses/1/assignments/1'
        }
      }];

      expect(localStorage.setItem).toHaveBeenCalledWith('calendarEvents', JSON.stringify(expectedEvents));
    });
  });

  describe('credential management', () => {
    test('setCredentials stores token and formats domain correctly', () => {
      canvasService.setCredentials('test-token', 'harvard');
      
      expect(localStorage.setItem).toHaveBeenCalledWith('canvasToken', 'Bearer test-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('canvasDomain', 'canvas.harvard.edu');
    });

    test('setCredentials preserves domain if already in correct format', () => {
      canvasService.setCredentials('test-token', 'canvas.harvard.edu');
      
      expect(localStorage.setItem).toHaveBeenCalledWith('canvasToken', 'Bearer test-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('canvasDomain', 'canvas.harvard.edu');
    });

    test('clearCredentials removes token and domain', () => {
      canvasService.clearCredentials();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('canvasToken');
      expect(localStorage.removeItem).toHaveBeenCalledWith('canvasDomain');
    });
  });
});
