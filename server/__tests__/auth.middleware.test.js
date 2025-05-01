const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

// Mock environment variable
process.env.JWT_SECRET = 'test-secret';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks before each test
    req = {
      header: jest.fn()
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('should add userId to request object when token is valid', () => {
    // Arrange
    const userId = '123456789';
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);
    req.header.mockReturnValue(token);

    // Act
    authMiddleware(req, res, next);

    // Assert
    expect(req.userId).toBe(userId);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('should return 401 if no token is provided', () => {
    // Arrange
    req.header.mockReturnValue(null);

    // Act
    authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is invalid', () => {
    // Arrange
    req.header.mockReturnValue('invalid-token');

    // Act
    authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is expired', () => {
    // Arrange
    const userId = '123456789';
    // Create a token that expired 1 hour ago
    const token = jwt.sign(
      { userId }, 
      process.env.JWT_SECRET, 
      { expiresIn: '-1h' }
    );
    req.header.mockReturnValue(token);

    // Mock console.error to prevent test output pollution
    const originalConsoleError = console.error;
    console.error = jest.fn();

    // Act
    authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();

    // Restore console.error
    console.error = originalConsoleError;
  });

  test('should return 401 if token is signed with wrong secret', () => {
    // Arrange
    const userId = '123456789';
    // Sign with a different secret
    const token = jwt.sign({ userId }, 'wrong-secret');
    req.header.mockReturnValue(token);

    // Mock console.error to prevent test output pollution
    const originalConsoleError = console.error;
    console.error = jest.fn();

    // Act
    authMiddleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();

    // Restore console.error
    console.error = originalConsoleError;
  });

  test('should verify token from x-auth-token header', () => {
    // Arrange
    const userId = '123456789';
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);
    req.header.mockReturnValue(token);

    // Act
    authMiddleware(req, res, next);

    // Assert
    expect(req.header).toHaveBeenCalledWith('x-auth-token');
    expect(req.userId).toBe(userId);
    expect(next).toHaveBeenCalled();
  });
});
