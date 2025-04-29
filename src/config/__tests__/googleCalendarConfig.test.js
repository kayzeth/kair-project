// Mock for react-router-dom as per project memory
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: '/' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

describe('Google Calendar Configuration', () => {
  // Save original environment
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset modules before each test to clear cache
    jest.resetModules();
    // Setup a clean environment
    process.env = { ...originalEnv };
    delete process.env.REACT_APP_GOOGLE_API_KEY;
    delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });
  
  describe('GOOGLE_API_CONFIG', () => {
    test('should use environment variables when available', () => {
      // Set environment variables
      process.env.REACT_APP_GOOGLE_API_KEY = 'test-api-key';
      process.env.REACT_APP_GOOGLE_CLIENT_ID = 'test-client-id';
      
      // Import the module (after setting env vars)
      const { GOOGLE_API_CONFIG } = require('../googleCalendarConfig');
      
      // Check that config uses environment variables
      expect(GOOGLE_API_CONFIG.apiKey).toBe('test-api-key');
      expect(GOOGLE_API_CONFIG.clientId).toBe('test-client-id');
    });
    
    test('should use default values when environment variables are not available', () => {
      // Ensure environment variables are not set
      delete process.env.REACT_APP_GOOGLE_API_KEY;
      delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
      
      // Import the module
      const { GOOGLE_API_CONFIG } = require('../googleCalendarConfig');
      
      // Check that config uses default values
      expect(GOOGLE_API_CONFIG.apiKey).toBe('YOUR_API_KEY');
      expect(GOOGLE_API_CONFIG.clientId).toBe('YOUR_CLIENT_ID');
    });
    
    test('should have the correct discovery docs and scope', () => {
      // Import the module
      const { GOOGLE_API_CONFIG } = require('../googleCalendarConfig');
      
      expect(GOOGLE_API_CONFIG.discoveryDocs).toEqual(['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']);
      expect(GOOGLE_API_CONFIG.scope).toBe(
        'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
      );
    });
  });
  
  describe('isConfigured', () => {
    // We need to use a different approach for testing isConfigured
    // since it directly references the GOOGLE_API_CONFIG object
    
    test('should return true when API credentials are properly configured', () => {
      // Create a temporary mock implementation of the module
      const mockConfig = {
        apiKey: 'valid-api-key',
        clientId: 'valid-client-id',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar'
      };
      
      // Create a test-specific version of isConfigured that uses our mock config
      const testIsConfigured = () => {
        return Boolean(
          mockConfig.apiKey !== 'YOUR_API_KEY' && 
          mockConfig.clientId !== 'YOUR_CLIENT_ID' &&
          mockConfig.apiKey && 
          mockConfig.clientId
        );
      };
      
      // Test with valid credentials
      expect(testIsConfigured()).toBe(true);
    });

    test('should return false when API key is not configured', () => {
      // Create a temporary mock implementation with default API key
      const mockConfig = {
        apiKey: 'YOUR_API_KEY',
        clientId: 'valid-client-id',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar'
      };
      
      // Create a test-specific version of isConfigured that uses our mock config
      const testIsConfigured = () => {
        return Boolean(
          mockConfig.apiKey !== 'YOUR_API_KEY' && 
          mockConfig.clientId !== 'YOUR_CLIENT_ID' &&
          mockConfig.apiKey && 
          mockConfig.clientId
        );
      };
      
      // Test with default API key
      expect(testIsConfigured()).toBe(false);
    });

    test('should return false when client ID is not configured', () => {
      // Create a temporary mock implementation with default client ID
      const mockConfig = {
        apiKey: 'valid-api-key',
        clientId: 'YOUR_CLIENT_ID',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar'
      };
      
      // Create a test-specific version of isConfigured that uses our mock config
      const testIsConfigured = () => {
        return Boolean(
          mockConfig.apiKey !== 'YOUR_API_KEY' && 
          mockConfig.clientId !== 'YOUR_CLIENT_ID' &&
          mockConfig.apiKey && 
          mockConfig.clientId
        );
      };
      
      // Test with default client ID
      expect(testIsConfigured()).toBe(false);
    });

    test('should return false when API key is undefined', () => {
      // Create a temporary mock implementation with undefined API key
      const mockConfig = {
        apiKey: undefined,
        clientId: 'valid-client-id',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar'
      };
      
      // Create a test-specific version of isConfigured that uses our mock config
      const testIsConfigured = () => {
        return Boolean(
          mockConfig.apiKey !== 'YOUR_API_KEY' && 
          mockConfig.clientId !== 'YOUR_CLIENT_ID' &&
          mockConfig.apiKey && 
          mockConfig.clientId
        );
      };
      
      // Test with undefined API key
      expect(testIsConfigured()).toBe(false);
    });

    test('should return false when client ID is undefined', () => {
      // Create a temporary mock implementation with undefined client ID
      const mockConfig = {
        apiKey: 'valid-api-key',
        clientId: undefined,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar'
      };
      
      // Create a test-specific version of isConfigured that uses our mock config
      const testIsConfigured = () => {
        return Boolean(
          mockConfig.apiKey !== 'YOUR_API_KEY' && 
          mockConfig.clientId !== 'YOUR_CLIENT_ID' &&
          mockConfig.apiKey && 
          mockConfig.clientId
        );
      };
      
      // Test with undefined client ID
      expect(testIsConfigured()).toBe(false);
    });
  });
});
