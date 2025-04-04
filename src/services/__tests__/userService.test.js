import { getCurrentUserId, getCurrentUser } from '../userService';
import { jwtDecode } from 'jwt-decode';

// Mock jwt-decode module
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn()
}));

describe('userService', () => {
  // Save original localStorage methods
  let localStorageMock;
  
  beforeEach(() => {
    // Create localStorage mock
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    
    // Apply mock to global
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('getCurrentUserId', () => {
    test('should return id from userData in localStorage', () => {
      // Arrange
      const mockUserData = JSON.stringify({ id: '123abc', name: 'Test User' });
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'userData') return mockUserData;
        return null;
      });
      
      // Act
      const result = getCurrentUserId();
      
      // Assert
      expect(result).toBe('123abc');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('userData');
      expect(jwtDecode).not.toHaveBeenCalled();
    });
    
    test('should return id from JWT token if userData not found', () => {
      // Arrange
      const mockToken = 'mockToken';
      const mockDecodedToken = { userId: '456def' };
      
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'authToken') return mockToken;
        return null;
      });
      
      jwtDecode.mockReturnValue(mockDecodedToken);
      
      // Act
      const result = getCurrentUserId();
      
      // Assert
      expect(result).toBe('456def');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('userData');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
      expect(jwtDecode).toHaveBeenCalledWith(mockToken);
    });
    
    test('should try sessionStorage if localStorage token not found', () => {
      // Arrange
      const mockToken = 'mockTokenFromSession';
      const mockDecodedToken = { userId: '789ghi' };
      
      localStorageMock.getItem.mockReturnValue(null);
      
      // Mock sessionStorage
      const sessionStorageMock = {
        getItem: jest.fn().mockReturnValue(mockToken)
      };
      
      Object.defineProperty(window, 'sessionStorage', {
        value: sessionStorageMock,
        writable: true
      });
      
      jwtDecode.mockReturnValue(mockDecodedToken);
      
      // Act
      const result = getCurrentUserId();
      
      // Assert
      expect(result).toBe('789ghi');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('userData');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('authToken');
      expect(jwtDecode).toHaveBeenCalledWith(mockToken);
    });
    
    test('should handle different token payload formats', () => {
      // Arrange
      const testCases = [
        { payload: { userId: 'id-from-userId' }, expected: 'id-from-userId' },
        { payload: { sub: 'id-from-sub' }, expected: 'id-from-sub' },
        { payload: { id: 'id-from-id' }, expected: 'id-from-id' }
      ];
      
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'authToken') return 'mockToken';
        return null;
      });
      
      for (const testCase of testCases) {
        jwtDecode.mockReturnValue(testCase.payload);
        
        // Act
        const result = getCurrentUserId();
        
        // Assert
        expect(result).toBe(testCase.expected);
      }
    });
    
    test('should return null if no data available', () => {
      // Arrange
      localStorageMock.getItem.mockReturnValue(null);
      
      // Mock sessionStorage to also return null
      const sessionStorageMock = {
        getItem: jest.fn().mockReturnValue(null)
      };
      
      Object.defineProperty(window, 'sessionStorage', {
        value: sessionStorageMock,
        writable: true
      });
      
      // Act
      const result = getCurrentUserId();
      
      // Assert
      expect(result).toBeNull();
    });
    
    test('should handle errors and return null', () => {
      // Arrange
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Mock console.error to avoid test output noise
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Act
      const result = getCurrentUserId();
      
      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('getCurrentUser', () => {
    test('should return user data from localStorage', () => {
      // Arrange
      const mockUserData = { id: '123abc', name: 'Test User', email: 'test@example.com' };
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'userData') return JSON.stringify(mockUserData);
        return null;
      });
      
      // Act
      const result = getCurrentUser();
      
      // Assert
      expect(result).toEqual(mockUserData);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('userData');
    });
    
    test('should extract user data from token if userData not found', () => {
      // Arrange
      const mockToken = 'mockToken';
      const mockDecodedToken = { 
        userId: '456def',
        name: 'Token User',
        email: 'token@example.com'
      };
      
      localStorageMock.getItem.mockImplementation(key => {
        if (key === 'authToken') return mockToken;
        return null;
      });
      
      jwtDecode.mockReturnValue(mockDecodedToken);
      
      // Act
      const result = getCurrentUser();
      
      // Assert
      expect(result).toEqual({
        id: '456def',
        name: 'Token User',
        email: 'token@example.com'
      });
    });
    
    test('should return null if no data available', () => {
      // Arrange
      localStorageMock.getItem.mockReturnValue(null);
      
      // Mock sessionStorage to also return null
      const sessionStorageMock = {
        getItem: jest.fn().mockReturnValue(null)
      };
      
      Object.defineProperty(window, 'sessionStorage', {
        value: sessionStorageMock,
        writable: true
      });
      
      // Act
      const result = getCurrentUser();
      
      // Assert
      expect(result).toBeNull();
    });
  });
});
