import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import Account from '../../components/Account';
import { useAuth } from '../../context/AuthContext';
import googleCalendarService from '../../services/googleCalendarService';
import { isConfigured } from '../../config/googleCalendarConfig';
import canvasService from '../../services/canvasService';
import googleCalendarDbService from '../../services/googleCalendarDbService';
import { act } from 'react-dom/test-utils';
import { HelmetProvider } from 'react-helmet-async';

// Mock services and context
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/googleCalendarService', () => ({
  initialize: jest.fn(),
  isSignedIn: jest.fn(),
  getCurrentUser: jest.fn(),
  addSignInListener: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../services/canvasService', () => ({
  setCredentials: jest.fn(),
  syncWithCalendar: jest.fn(),
  clearCredentials: jest.fn(),
}));

jest.mock('../../config/googleCalendarConfig', () => ({
  isConfigured: jest.fn(),
}));

jest.mock('../../services/googleCalendarDbService', () => ({
  syncGoogleCalendarWithDb: jest.fn(),
  deleteAllGoogleEvents: jest.fn(),
}));

describe('Account Component', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  
    // 1. Override localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => JSON.stringify({ id: '123' })),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  
    // 2. Ensure localhost to show delete button
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
    });
  
    // 3. Mock config + auth
    isConfigured.mockReturnValue(true);
    useAuth.mockReturnValue({
      user: { id: '123', name: 'Test User', email: 'test@example.com' },
      isLoggedIn: true,
    });
  
    // 4. Indicate Google is signed in
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
    });
    googleCalendarService.addSignInListener.mockImplementation(() => {});
    googleCalendarDbService.clearSyncData = jest.fn().mockResolvedValue(undefined);
  });  

  it('renders Account title and user info', async () => {
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
    expect(await screen.findByTestId('account-title')).toBeInTheDocument();
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });

  it('shows sign-in button when not signed in', async () => {
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
    expect(await screen.findByTestId('google-sign-in-button')).toBeInTheDocument();
  });

  it('displays API credential warning if not configured', async () => {
    isConfigured.mockReturnValue(false);
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
    expect(await screen.findByTestId('api-credentials-warning')).toBeInTheDocument();
  });

  test('handles Google sign-in errors gracefully', async () => {
    googleCalendarService.signIn.mockRejectedValue(new Error('mock sign-in failure'));
    googleCalendarService.isSignedIn.mockReturnValue(false);
    
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
  
    fireEvent.click(await screen.findByTestId('google-sign-in-button'));
  
    await waitFor(() => {
      expect(screen.getByTestId('sync-message')).toHaveTextContent(
        'Failed to sign in with Google'
      );
    });
  });  
  
  it('handles successful Canvas sync', async () => {
    // Mock fetch before rendering, so useEffect sets isCanvasConnected = true
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { user_id: '123', lms_type: 'CANVAS' } // mock Canvas integration
      ],
    });
  
    canvasService.syncWithCalendar.mockResolvedValue(5); // pretend 5 events were added
  
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
  
    // Wait for the sync button to appear
    const syncButton = await screen.findByTestId('account-sync-canvas-button');
    fireEvent.click(syncButton);
  
    await waitFor(() => {
      expect(screen.getByTestId('canvas-error-message')).toHaveTextContent('Successfully synced 5 events from Canvas');
    });
  });  
  
  it('handles Canvas sync failure', async () => {
    // Simulate Canvas connected state
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { user_id: '123', lms_type: 'CANVAS' } // simulate Canvas integration exists
      ],
    });
  
    canvasService.syncWithCalendar.mockRejectedValue(new Error('Canvas sync failed'));
  
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
    const syncButton = await screen.findByTestId('account-sync-canvas-button');
    fireEvent.click(syncButton);
  
    await waitFor(() => {
      expect(screen.getByTestId('canvas-error-message')).toHaveTextContent('Canvas sync failed');
    });
  });

  it('handles Google Calendar incremental sync, full sync, event deletion, and sign out', async () => {
    // 1. Set up mocks
    isConfigured.mockReturnValue(true);
    useAuth.mockReturnValue({
      user: { id: '123', name: 'Test User', email: 'test@example.com' },
      isLoggedIn: true,
    });
  
    googleCalendarService.isSignedIn.mockReturnValue(true);
    googleCalendarService.getCurrentUser.mockReturnValue({ name: 'Test User', email: 'test@example.com' });
    googleCalendarService.addSignInListener.mockImplementation(() => {});
    googleCalendarService.signOut = jest.fn();
  
    googleCalendarDbService.syncGoogleCalendarWithDb = jest.fn().mockResolvedValue({
      events: [{}],
      databaseResults: { imported: 1, updated: 0, deleted: 0 }
    });
  
    googleCalendarDbService.deleteAllGoogleEvents = jest.fn().mockResolvedValue({ deletedCount: 3 }); 
  
    // 3. Make localhost button visible
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
    });
  
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
  
    await screen.findByTestId('google-disconnect-button');
  
    // 🟢 Incremental sync
    fireEvent.click(screen.getByTestId('sync-button'));
    await waitFor(() => {
      expect(screen.getByTestId('sync-message')).toHaveTextContent('Successfully synced with Google Calendar');
    });
  
    // 🟡 Full sync
    fireEvent.click(screen.getByTestId('force-sync-button'));
    await waitFor(() => {
      expect(screen.getByTestId('sync-message')).toHaveTextContent('Successfully synced with Google Calendar');
    });
  
    // 🔴 Delete events
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByTestId('delete-google-events-button'));
    await waitFor(() => {
      expect(screen.getByTestId('sync-message')).toHaveTextContent('Successfully deleted 3 Google Calendar events');
    });
  
    // ❎ Disconnect
    fireEvent.click(screen.getByTestId('google-disconnect-button'));
    expect(googleCalendarService.signOut).toHaveBeenCalled();
  });

  test('allows user to input and submit Canvas credentials', async () => {
    // Mock canvasService call
    canvasService.setCredentials = jest.fn().mockResolvedValue();
  
    // Ensure Canvas is not yet connected so the form shows
    useAuth.mockReturnValue({
      user: { id: '123', name: 'Test User', email: 'test@example.com' },
      isLoggedIn: true,
    });
  
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
  
    // Fill out Canvas token input
    const tokenInput = await screen.findByTestId('account-canvas-token-input');
    fireEvent.change(tokenInput, { target: { value: 'test_token_123' } });
    expect(tokenInput.value).toBe('test_token_123');
  
    // Fill out Canvas domain input
    const domainInput = screen.getByTestId('account-canvas-domain-input');
    fireEvent.change(domainInput, { target: { value: 'canvas.harvard.edu' } });
    expect(domainInput.value).toBe('canvas.harvard.edu');
  
    // Click Connect button
    const connectButton = screen.getByTestId('account-connect-canvas-button');
    fireEvent.click(connectButton);
  
    await waitFor(() => {
      expect(canvasService.setCredentials).toHaveBeenCalledWith(
        'test_token_123',
        'canvas.harvard.edu',
        '123'
      );
    });
  });

  it('disconnects Canvas successfully when user is logged in', async () => {
    useAuth.mockReturnValue({
      user: { id: '123', name: 'Test User', email: 'test@example.com' },
      isLoggedIn: true,
    });
  
    // Simulate successful connection and disconnection
    canvasService.connect = jest.fn().mockResolvedValueOnce(); // for the form
    canvasService.clearCredentials = jest.fn().mockResolvedValueOnce();
  
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
  
    // Fill in Canvas form to simulate a connection
    fireEvent.change(screen.getByTestId('account-canvas-token-input'), {
      target: { value: 'mock-token' },
    });
    fireEvent.change(screen.getByTestId('account-canvas-domain-input'), {
      target: { value: 'canvas.harvard.edu' },
    });
  
    fireEvent.click(screen.getByTestId('account-connect-canvas-button'));
  
    // Wait until component reflects connected state
    const disconnectBtn = await screen.findByTestId('account-disconnect-canvas-button');
  
    // Click disconnect
    fireEvent.click(disconnectBtn);
  
    // Expect canvasService.clearCredentials to be called
    await waitFor(() => {
      expect(canvasService.clearCredentials).toHaveBeenCalledWith('123');
    });
  });  

  it('shows error if disconnecting Canvas fails', async () => {
    // Simulate user is logged in
    useAuth.mockReturnValue({ user: { id: '123' }, isLoggedIn: true });
  
    // Mock connect to succeed so we reach connected state
    canvasService.connect = jest.fn().mockResolvedValue(true);
  
    // Mock disconnect to fail
    canvasService.clearCredentials = jest.fn().mockRejectedValue(new Error('Failed'));
  
    render(
      <HelmetProvider>
        <Account />
      </HelmetProvider>
    );
  
    // Fill in Canvas form
    fireEvent.change(screen.getByTestId('account-canvas-token-input'), {
      target: { value: 'mock-token' },
    });
    fireEvent.change(screen.getByTestId('account-canvas-domain-input'), {
      target: { value: 'canvas.harvard.edu' },
    });
  
    // Submit form to connect
    fireEvent.click(screen.getByTestId('account-connect-canvas-button'));
  
    // Wait for disconnect button to appear
    const disconnectBtn = await screen.findByTestId('account-disconnect-canvas-button');
  
    // Click disconnect
    fireEvent.click(disconnectBtn);
  
    // Verify error appears
    await waitFor(() => {
      expect(screen.getByTestId('canvas-error-message')).toHaveTextContent(
        'Failed to disconnect Canvas account'
      );
    });
  });  
});

describe('Account Component – Google Sign-In Listener', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => JSON.stringify({ id: 'test-user-id' })),
        setItem: jest.fn(),
      },
      writable: true,
    });

    googleCalendarService.getCurrentUser.mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
    });

    useAuth.mockReturnValue({
      user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
      isLoggedIn: true,
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ syncToken: 'dummy-token' }),
      })
    );

    googleCalendarDbService.syncGoogleCalendarWithDb.mockResolvedValue();
  });

  it('handles Google sign-out correctly', async () => {
    const mockListener = jest.fn();
  
    isConfigured.mockReturnValue(true); // 👈 prevent credentials warning from showing
  
    // Setup listener interception
    googleCalendarService.addSignInListener.mockImplementation((cb) => {
      mockListener.mockImplementation(cb);
    });
  
    render(
  <HelmetProvider>
    <Account />
  </HelmetProvider>
);
  
    // Simulate sign-out
    act(() => {
      mockListener(false); // call the captured listener with "false" (signed out)
    });
  
    // Check that sync message was cleared
    await waitFor(() => {
      expect(screen.getByTestId('sync-message')).toBeEmptyDOMElement();
    });
  });
});
