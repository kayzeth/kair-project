import React from 'react';
import { render, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock component that uses the auth context
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="isLoggedIn">{auth.isLoggedIn ? 'true' : 'false'}</div>
      <div data-testid="userId">{auth.user?.id || 'no-id'}</div>
      <div data-testid="authToken">{auth.authToken || 'no-token'}</div>
      <button data-testid="loginButton" onClick={() => auth.login({ id: 'test-id', name: 'Test User' }, 'test-token')}>
        Login
      </button>
      <button data-testid="logoutButton" onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
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
  
  test('provides default auth state', () => {
    // Arrange & Act
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Assert
    expect(getByTestId('isLoggedIn').textContent).toBe('false');
    expect(getByTestId('userId').textContent).toBe('no-id');
    expect(getByTestId('authToken').textContent).toBe('no-token');
  });
  
  test('loads auth state from localStorage on mount', () => {
    // Arrange
    const mockToken = 'stored-token';
    const mockUserData = JSON.stringify({ id: 'stored-id', name: 'Stored User' });
    
    localStorageMock.getItem.mockImplementation(key => {
      if (key === 'authToken') return mockToken;
      if (key === 'userData') return mockUserData;
      return null;
    });
    
    // Act
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Assert
    expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('userData');
    expect(getByTestId('isLoggedIn').textContent).toBe('true');
    expect(getByTestId('userId').textContent).toBe('stored-id');
    expect(getByTestId('authToken').textContent).toBe('stored-token');
  });
  
  test('login updates auth state and localStorage', () => {
    // Arrange
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // Act - click login button
    act(() => {
      getByTestId('loginButton').click();
    });
    
    // Assert
    expect(getByTestId('isLoggedIn').textContent).toBe('true');
    expect(getByTestId('userId').textContent).toBe('test-id');
    expect(getByTestId('authToken').textContent).toBe('test-token');
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('userData', JSON.stringify({ id: 'test-id', name: 'Test User' }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'test-token');
  });
  
  test('logout clears auth state and localStorage', () => {
    // Arrange - first login
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    act(() => {
      getByTestId('loginButton').click();
    });
    
    // Verify logged in
    expect(getByTestId('isLoggedIn').textContent).toBe('true');
    
    // Act - logout
    act(() => {
      getByTestId('logoutButton').click();
    });
    
    // Assert
    expect(getByTestId('isLoggedIn').textContent).toBe('false');
    expect(getByTestId('userId').textContent).toBe('no-id');
    expect(getByTestId('authToken').textContent).toBe('no-token');
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('userData');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
  });
});
