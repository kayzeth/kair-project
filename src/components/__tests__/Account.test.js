import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Account from '../Account';
// Import the real AuthContext to see its implementation
import { useAuth, AuthProvider } from '../../context/AuthContext';

// Mock the dependencies before importing them
jest.mock('../../services/googleCalendarService');
jest.mock('../../config/googleCalendarConfig');
jest.mock('../../services/canvasService');
jest.mock('../../config/canvasConfig');

// Import the mocked modules after mocking
import googleCalendarService from '../../services/googleCalendarService';
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
    
    // Wait for the import method to be called
    await waitFor(() => {
      expect(googleCalendarService.importEvents).toHaveBeenCalled();
    });
  });

  test('displays sync status messages', async () => {
    // Mock signed-in state
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue({
      name: 'Test User',
      email: 'test@example.com'
    });
    
    // Mock the initialize method to resolve immediately
    googleCalendarService.initialize.mockResolvedValue();
  
    // Mock the importEvents method which is called by the component's syncWithGoogleCalendar function
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
    
    // Click the sync button to trigger status update
    await act(async () => {
      fireEvent.click(screen.getByTestId('sync-button'));
    });
    
    // Wait for success message - the component will set this message after successful import
    await waitFor(() => {
      expect(screen.getByTestId('sync-message')).toHaveTextContent('Successfully synced with Google Calendar');
    }, { timeout: 3000 });
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

describe('Canvas Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isCanvasConfigured.mockReturnValue(false);
    
    // Mock localStorage
    const localStorageMock = {
      store: {},
      getItem: jest.fn(key => localStorageMock.store[key]),
      setItem: jest.fn((key, value) => { localStorageMock.store[key] = value; }),
      removeItem: jest.fn(key => { delete localStorageMock.store[key]; }),
      clear: jest.fn(() => { localStorageMock.store = {}; }),
    };
    global.localStorage = localStorageMock;
  });

  test('shows connect form when not connected', async () => {
    // Ensure localStorage returns null for Canvas credentials
    localStorage.getItem.mockImplementation(key => {
      if (key === 'canvasToken' || key === 'canvasDomain') return null;
      return localStorage.store[key];
    });

    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Form should be visible since we're not connected
    expect(screen.getByTestId('canvas-token-label')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-domain-label')).toBeInTheDocument();
    expect(screen.getByTestId('account-connect-canvas-button')).toBeInTheDocument();
  });

  test('can connect with valid credentials', async () => {
    // Ensure localStorage returns null for Canvas credentials
    localStorage.getItem.mockImplementation(key => {
      if (key === 'canvasToken' || key === 'canvasDomain') return null;
      return localStorage.store[key];
    });

    // Mock successful connection
    canvasService.testConnection.mockResolvedValue(true);
    
    renderWithAuth(<Account />);
    
    // Fill in the form
    const tokenInput = screen.getByTestId('account-canvas-token-input');
    const domainInput = screen.getByTestId('account-canvas-domain-input');
    
    fireEvent.change(tokenInput, { target: { value: 'test-token' } });
    fireEvent.change(domainInput, { target: { value: 'harvard' } });
    
    // Submit form
    const connectButton = screen.getByTestId('account-connect-canvas-button');
    await act(async () => {
      fireEvent.click(connectButton);
    });
    
    // Check that service was called with raw values (formatting happens in service)
    expect(canvasService.setCredentials).toHaveBeenCalledWith('test-token', 'harvard');
    expect(canvasService.testConnection).toHaveBeenCalled();
  });

  test('shows error message with invalid credentials', async () => {
    // Ensure localStorage returns null for Canvas credentials
    localStorage.getItem.mockImplementation(key => {
      if (key === 'canvasToken' || key === 'canvasDomain') return null;
      return localStorage.store[key];
    });

    // Mock failed connection
    canvasService.testConnection.mockRejectedValue(new Error('Invalid token'));
    
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Fill in the form
    const tokenInput = screen.getByTestId('account-canvas-token-input');
    const domainInput = screen.getByTestId('account-canvas-domain-input');
    
    fireEvent.change(tokenInput, { target: { value: 'invalid-token' } });
    fireEvent.change(domainInput, { target: { value: 'harvard' } });
    
    // Submit form
    const connectButton = screen.getByTestId('account-connect-canvas-button');
    await act(async () => {
      fireEvent.click(connectButton);
    });
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByTestId('canvas-error-message')).toBeInTheDocument();
    });
  });

  test('can disconnect after successful connection', async () => {
    // Mock Canvas as initially connected
    isCanvasConfigured.mockReturnValue(true);
    localStorage.getItem.mockImplementation(key => {
      if (key === 'canvasToken') return 'Bearer test-token';
      if (key === 'canvasDomain') return 'canvas.harvard.edu';
      return localStorage.store[key];
    });
    
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Click disconnect button
    await act(async () => {
      fireEvent.click(screen.getByTestId('account-disconnect-canvas-button'));
    });
    
    expect(canvasService.clearCredentials).toHaveBeenCalled();
    expect(screen.getByTestId('account-connect-canvas-button')).toBeInTheDocument();
  });

  test('can sync assignments after connection', async () => {
    // Mock Canvas as connected
    isCanvasConfigured.mockReturnValue(true);
    localStorage.getItem.mockImplementation(key => {
      if (key === 'canvasToken') return 'Bearer test-token';
      if (key === 'canvasDomain') return 'canvas.harvard.edu';
      return localStorage.store[key];
    });
    
    // Mock successful sync
    canvasService.syncWithCalendar.mockResolvedValue(5);
    
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Click sync button
    const syncButton = screen.getByTestId('account-sync-canvas-button');
    await act(async () => {
      fireEvent.click(syncButton);
    });
    
    expect(canvasService.syncWithCalendar).toHaveBeenCalled();
    expect(await screen.findByText('Successfully imported 5 Canvas assignments!')).toBeInTheDocument();
  });

  test('shows error on sync failure', async () => {
    // Mock Canvas as connected
    isCanvasConfigured.mockReturnValue(true);
    localStorage.getItem.mockImplementation(key => {
      if (key === 'canvasToken') return 'Bearer test-token';
      if (key === 'canvasDomain') return 'canvas.harvard.edu';
      return localStorage.store[key];
    });
    
    // Mock sync failure
    canvasService.syncWithCalendar.mockRejectedValue(new Error('Sync failed'));
    
    await act(async () => {
      renderWithAuth(<Account />);
    });
    
    // Click sync button
    const syncButton = screen.getByTestId('account-sync-canvas-button');
    await act(async () => {
      fireEvent.click(syncButton);
    });
    
    expect(await screen.findByText('Failed to sync Canvas assignments. Please try again.')).toBeInTheDocument();
  });
});
