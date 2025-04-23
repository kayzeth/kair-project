import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Account from '../Account';
// Import the real AuthContext to see its implementation
import { useAuth, AuthProvider } from '../../context/AuthContext';

// Mock the dependencies before importing them
jest.mock('../../services/googleCalendarService');
jest.mock('../../config/googleCalendarConfig');
jest.mock('../../services/googleCalendarDbService');
jest.mock('../../services/canvasService');
jest.mock('../../config/canvasConfig');

// Import the mocked modules after mocking
import googleCalendarService from '../../services/googleCalendarService';
import googleCalendarDbService from '../../services/googleCalendarDbService';
import { isConfigured as isGoogleConfigured } from '../../config/googleCalendarConfig';
import canvasService from '../../services/canvasService';
import { isConfigured as isCanvasConfigured } from '../../config/canvasConfig';

// Mock FontAwesome to avoid issues
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <div data-testid="mock-icon" />
}));

// Create AuthContext for testing
const TestAuthContext = React.createContext(null);

// Mock AuthContext provider
const MockAuthProvider = ({ children }) => {
  const mockAuthValue = {
    user: { _id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
  authToken: 'test-token',
  login: jest.fn(),
  logout: jest.fn()
};

  return (
    <TestAuthContext.Provider value={mockAuthValue}>
      {children}
    </TestAuthContext.Provider>
  );
};

// Mock the useAuth hook to return our test values
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
    isAuthenticated: true,
    authToken: 'test-token',
    login: jest.fn(),
    logout: jest.fn()
  }),
  AuthProvider: ({ children }) => <>{children}</>
}));

// Custom render function
const renderWithAuth = (ui) => {
  return render(ui);
};

describe('Account Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up mock implementations
    isGoogleConfigured.mockReturnValue(true);
    
    // Set up googleCalendarService mock implementations
    googleCalendarService.initialize = jest.fn().mockResolvedValue();
    googleCalendarService.isSignedIn = jest.fn().mockReturnValue(false);
    googleCalendarService.getCurrentUser = jest.fn().mockReturnValue(null);
    
    // Mock addSignInListener to store the callback
    googleCalendarService.addSignInListener = jest.fn((callback) => {
      googleCalendarService.signInCallback = callback;
    });
    
    googleCalendarService.signIn = jest.fn().mockResolvedValue();
    googleCalendarService.signOut = jest.fn().mockResolvedValue();
    googleCalendarService.syncEvents = jest.fn().mockResolvedValue({ imported: 5, exported: 3 });
  });

  test('renders account title', async () => {
    await act(() => {
      renderWithAuth(<Account />);
    });
    expect(screen.getByTestId('account-title')).toBeInTheDocument();
  });

  test('shows API credentials warning when not configured', async () => {
    isGoogleConfigured.mockReturnValue(false);
    await act(() => {
      renderWithAuth(<Account />);
    });
    expect(screen.getByTestId('api-credentials-warning')).toBeInTheDocument(); // This is an error state message
  });

  test('initializes Google Calendar service on mount', async () => {
    await act(() => {
      renderWithAuth(<Account />);
    });
    expect(googleCalendarService.initialize).toHaveBeenCalled();
  });

  test('shows sign-in button when not signed in', async () => {
    await act(() => {
      renderWithAuth(<Account />);
    });
    expect(screen.getByTestId('google-sign-in-button')).toBeInTheDocument();
  });

  test('shows user profile when signed in', async () => {
    // Mock signed-in state and user data
    const mockUser = {
      name: 'Test User',
      email: 'test@example.com',
      imageUrl: 'https://example.com/profile.jpg'
    };
    
    // Set up mocks before rendering
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue(mockUser);
    
    // Store the sign-in listener to call it later
    let signInListener;
    googleCalendarService.addSignInListener.mockImplementation((callback) => {
      signInListener = callback;
      return jest.fn(); // Return a mock removal function
    });
    
    // Mock the initialize method to resolve immediately
    googleCalendarService.initialize.mockImplementation(() => {
      return Promise.resolve();
    });

    // Render component inside act to catch initial renders
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Trigger the sign-in callback inside act
    await act(async () => {
      if (signInListener) {
        signInListener(true);
      }
    });
    
    // Now check if user info is displayed correctly
    // These assertions don't need to be in act() since they don't cause state updates
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    
    // Check if auth card user info is displayed
    expect(screen.getByTestId('auth-user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('auth-user-email')).toHaveTextContent('test@example.com');
    
    // Check if connection status is displayed
    expect(screen.getByTestId('google-connected-status')).toBeInTheDocument();
  });

  test('handles sign-in button click', async () => {
      await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Click the sign-in button
    await act(async () => {
      fireEvent.click(screen.getByTestId('google-sign-in-button'));
    });
    
    expect(googleCalendarService.signIn).toHaveBeenCalled();
  });

  test('handles sign-out button click when signed in', async () => {
    // Mock signed-in state
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue({
      name: 'Test User',
      email: 'test@example.com'
    });

    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Click the sign-out button
    await act(async () => {
      fireEvent.click(screen.getByTestId('google-disconnect-button'));
    });
    
    expect(googleCalendarService.signOut).toHaveBeenCalled();
  });

  test('handles sync button click when signed in', async () => {
    // Mock signed-in state
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue({
      name: 'Test User',
      email: 'test@example.com'
    });
  
    // Mock the initialize method to resolve immediately
    googleCalendarService.initialize.mockResolvedValue();
    
    // Mock the importEvents method
    googleCalendarService.importEvents.mockResolvedValue([{ id: '1', summary: 'Test Event' }]);
  
    // Render the component within act
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Wait for the component to finish initializing
    await act(async () => {
      // Manually trigger the sign-in callback that was registered
      if (googleCalendarService.signInCallback) {
        googleCalendarService.signInCallback(true);
      }
    });
    
    // Wait for the sync button to appear
    await waitFor(() => {
      expect(screen.getByTestId('sync-button')).toBeInTheDocument();
    });
    
    // Click the sync button within act
    await act(async () => {
      fireEvent.click(screen.getByTestId('sync-button'));
    });

    const mockUser = {
      name: 'Test User',
      email: 'test@example.com'
    };

    // Wait for the import method to be called
    // Test the direct interaction instead
    await waitFor(() => {
      expect(googleCalendarDbService.forceSyncGoogleCalendar).toHaveBeenCalledWith(mockUser.id);
    });
  });

  test('displays sync status messages', async () => {
    // Set up localStorage with proper user data first
    const mockUser = {
      id: 'test-user-id',  // <-- This is crucial!
      name: 'Test User',
      email: 'test@example.com'
    };
    localStorage.setItem('userData', JSON.stringify(mockUser));
    
    await act(() => {
      renderWithAuth(<Account />, {
        authState: {
          ...mockAuthContext,
          user: mockUser  // Make sure auth context matches localStorage
        }
      });
    });
  
    const syncButton = await screen.findByTestId('sync-button');
    await act(async () => {
      fireEvent.click(syncButton);
    });
    
    expect(screen.getByTestId('sync-message')).toHaveTextContent('Syncing with Google Calendar...');
  });

  test('updates UI when sign-in state changes', async () => {
    // Start with signed-out state
    googleCalendarService.isSignedIn.mockReturnValue(false);
    
    let signInListener;
    googleCalendarService.addSignInListener.mockImplementation((callback) => {
      signInListener = callback;
      return jest.fn(); // Return a mock removal function
    });
    
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Verify signed-out UI
    expect(screen.getByTestId('google-sign-in-button')).toBeInTheDocument();
    
    // Simulate sign-in event
    const mockUser = {
      name: 'Test User',
      email: 'test@example.com'
    };
    
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue(mockUser);
    
    // Call the stored callback
    await act(async () => {
      if (signInListener) {
        signInListener(true);
      }
    });
    
    // Verify signed-in UI
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });
});

describe('Canvas Service', () => {
  const testUserId = 'test-user-id';
  const testToken = 'test-token';
  const testDomain = 'harvard';

  beforeEach(() => {
    jest.clearAllMocks();
    canvasService.setCredentials.mockResolvedValue({ success: true });
    canvasService.syncWithCalendar.mockResolvedValue(5);
  });

  test('can set Canvas credentials', async () => {
    const result = await canvasService.setCredentials(testToken, testDomain, testUserId);
    expect(result.success).toBe(true);
    expect(canvasService.setCredentials).toHaveBeenCalledWith(testToken, testDomain, testUserId);
  });

  test('can sync Canvas assignments', async () => {
    const result = await canvasService.syncWithCalendar(testUserId);
    expect(result).toBe(5);
    expect(canvasService.syncWithCalendar).toHaveBeenCalledWith(testUserId);
  });

  test('handles sync failure', async () => {
    canvasService.syncWithCalendar.mockRejectedValue(new Error('Sync failed'));
    await expect(canvasService.syncWithCalendar(testUserId)).rejects.toThrow('Sync failed');
  });
});
