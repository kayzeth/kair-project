// __tests__/Onboarding.test.js

// Mock react-router-dom before importing any components
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import Onboarding from '../Onboarding';
import googleCalendarService from '../../services/googleCalendarService';
import googleCalendarDbService from '../../services/googleCalendarDbService';
import canvasService from '../../services/canvasService';
import { isConfigured } from '../../config/googleCalendarConfig';

// Mock dependencies
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    isLoggedIn: true
  })
}));

jest.mock('../../services/googleCalendarService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(),
    isSignedIn: jest.fn().mockReturnValue(false),
    getCurrentUser: jest.fn().mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
      imageUrl: 'https://example.com/image.jpg'
    }),
    addSignInListener: jest.fn(),
    signIn: jest.fn(),
  },
}));

jest.mock('../../services/googleCalendarDbService', () => ({
  __esModule: true,
  default: {
    syncGoogleCalendarWithDb: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('../../services/canvasService', () => ({
  __esModule: true,
  default: {
    setCredentials: jest.fn().mockResolvedValue(),
    syncWithCalendar: jest.fn().mockResolvedValue(5),
  },
}));

jest.mock('../../config/googleCalendarConfig', () => ({
  isConfigured: jest.fn().mockReturnValue(true),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ syncToken: 'mock-sync-token' })
  })
);

describe('Onboarding Component', () => {
  const navigateMock = jest.fn();
  let signInListener;

  beforeEach(() => {
    jest.clearAllMocks();
    require('react-router-dom').useNavigate.mockReturnValue(navigateMock);
    // Capture the Google sign-in listener
    googleCalendarService.addSignInListener.mockImplementation((cb) => {
      signInListener = cb;
    });
  });

  test('shows error when Google API is not configured', async () => {
    isConfigured.mockReturnValue(false);
    render(<Onboarding />);

    await waitFor(() => {
      const errorMessage = screen.getByTestId('google-error-message');
      expect(errorMessage).toHaveTextContent(/Google Calendar API credentials are not configured/i);
    });
  });

  test('shows error when initialize throws', async () => {
    isConfigured.mockReturnValue(true);
    googleCalendarService.initialize.mockRejectedValue(new Error('init error'));
    
    render(<Onboarding />);

    await waitFor(() => {
      const errorMessage = screen.getByTestId('google-error-message');
      expect(errorMessage).toHaveTextContent(/init error/);
    });
  });

  test('renders sign-in button when not signed in and handles click', async () => {
    googleCalendarService.isSignedIn.mockReturnValue(false);
    
    render(<Onboarding />);

    // Find the sign-in button without waiting for initialize
    const signInButton = screen.getByTestId('google-signin-button');
    fireEvent.click(signInButton);

    expect(googleCalendarService.signIn).toHaveBeenCalled();
  });

  test('navigates between steps and skip/back/next functionality', async () => {
    render(<Onboarding />);

    // Step 1 -> Step 2
    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton);
    
    // Verify we're on step 2
    await waitFor(() => {
      expect(screen.getByTestId('canvas-title')).toBeInTheDocument();
    });

    // Step 2 -> Step 3
    fireEvent.click(nextButton);
    
    // Verify we're on step 3
    await waitFor(() => {
      expect(screen.getByTestId('sleep-schedule-title')).toBeInTheDocument();
    });

    // Back to Step 2
    const backButton = screen.getByTestId('back-button');
    fireEvent.click(backButton);
    
    // Verify we're back on step 2
    await waitFor(() => {
      expect(screen.getByTestId('canvas-title')).toBeInTheDocument();
    });

    // Skip to Step 3
    const skipButton = screen.getByTestId('skip-button');
    fireEvent.click(skipButton);
    
    // Verify we're on step 3
    await waitFor(() => {
      expect(screen.getByTestId('sleep-schedule-title')).toBeInTheDocument();
    });

    // Skip at Step 3 triggers complete and navigation
    fireEvent.click(skipButton);
    
    // Verify localStorage was set and navigation occurred
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'onboarding_complete_test-user-id',
      'true'
    );
    expect(navigateMock).toHaveBeenCalledWith('/calendar');
  });

  test('completes onboarding when clicking Go to Calendar', async () => {
    // Mock the fetch call for saving sleep schedule
    global.fetch.mockImplementation(() => Promise.resolve({ ok: true }));
    
    render(<Onboarding />);
    
    // Navigate to step 3
    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton); // Step 2
    fireEvent.click(nextButton); // Step 3
    
    // Verify we're on step 3
    await waitFor(() => {
      expect(screen.getByTestId('sleep-schedule-title')).toBeInTheDocument();
    });
    
    // Click the Go to Calendar button (which is the next button on step 3)
    await act(async () => {
      fireEvent.click(nextButton);
    });
    
    // Check that localStorage was set to mark onboarding as complete
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'onboarding_complete_test-user-id',
      'true'
    );
    
    // Check that navigation occurred
    expect(navigateMock).toHaveBeenCalledWith('/calendar');
  });

  test('handles sleep schedule changes and displays correct hours', async () => {
    render(<Onboarding />);

    // Go to step 3
    const nextButton = screen.getByTestId('next-button');
    fireEvent.click(nextButton); // Step 2
    fireEvent.click(nextButton); // Step 3

    // Verify we're on step 3
    await waitFor(() => {
      expect(screen.getByTestId('sleep-schedule-title')).toBeInTheDocument();
    });

    // Change bedtime and wakeupTime
    const bedtimeInput = screen.getByTestId('bedtime-input');
    const wakeupTimeInput = screen.getByTestId('wakeup-time-input');
    
    await act(async () => {
      fireEvent.change(bedtimeInput, {
        target: { name: 'bedtime', value: '22:30' },
      });
    });
    
    await act(async () => {
      fireEvent.change(wakeupTimeInput, {
        target: { name: 'wakeupTime', value: '06:15' },
      });
    });

    // Check that sleep hours are calculated correctly
    // Look for the text in the sleep-hours-note paragraph instead of using a data-testid
    const sleepHoursText = screen.getByText(/7 hours and 45 minutes/);
    expect(sleepHoursText).toBeInTheDocument();
  });

  describe('Canvas integration (step 2)', () => {
    beforeEach(async () => {
      render(<Onboarding />);
      // Advance to step 2
      const nextButton = screen.getByTestId('next-button');
      fireEvent.click(nextButton);
      
      // Wait for step 2 to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('canvas-title')).toBeInTheDocument();
      });
    });

    test('connects to Canvas successfully', async () => {
      // Get the form inputs using data-testid
      const tokenInput = screen.getByTestId('canvas-token-input');
      const domainInput = screen.getByTestId('canvas-domain-input');
      const connectButton = screen.getByTestId('canvas-connect-button');

      // Fill in the form
      fireEvent.change(tokenInput, {
        target: { value: 'tokenXYZ' },
      });
      fireEvent.change(domainInput, {
        target: { value: 'canvas.test.edu' },
      });
      
      // Submit the form
      fireEvent.click(connectButton);

      // Verify the service was called
      await waitFor(() => {
        expect(canvasService.setCredentials).toHaveBeenCalledWith(
          'tokenXYZ',
          'canvas.test.edu',
          'test-user-id'
        );
      });
      
      // Check for success message
      await waitFor(() => {
        const successMessage = screen.getByTestId('canvas-success-message');
        expect(successMessage).toBeInTheDocument();
      });

      // Sync button should appear
      const syncButton = screen.getByTestId('canvas-sync-button');
      expect(syncButton).toBeInTheDocument();
    });

    test('handles Canvas connection failure', async () => {
      // Mock a failure
      canvasService.setCredentials.mockRejectedValue(new Error('fail'));
      
      // Get the form inputs
      const tokenInput = screen.getByTestId('canvas-token-input');
      const domainInput = screen.getByTestId('canvas-domain-input');
      const connectButton = screen.getByTestId('canvas-connect-button');

      // Fill in the form
      fireEvent.change(tokenInput, {
        target: { value: 'badtoken' },
      });
      fireEvent.change(domainInput, {
        target: { value: 'canvas.bad.edu' },
      });
      
      // Submit the form
      fireEvent.click(connectButton);

      // Check for error message
      await waitFor(() => {
        const errorMessage = screen.getByTestId('canvas-error-message');
        expect(errorMessage).toHaveTextContent(/fail/i);
      });
      
      // Form should still be present
      expect(screen.getByTestId('canvas-token-input')).toBeInTheDocument();
    });
    
    // Test for handleCanvasSync method
    describe('Canvas sync functionality', () => {
      // Setup for sync tests - first connect to Canvas
      beforeEach(async () => {
        // Connect to Canvas first
        const tokenInput = screen.getByTestId('canvas-token-input');
        const domainInput = screen.getByTestId('canvas-domain-input');
        const connectButton = screen.getByTestId('canvas-connect-button');
        
        fireEvent.change(tokenInput, { target: { value: 'validToken' } });
        fireEvent.change(domainInput, { target: { value: 'canvas.valid.edu' } });
        fireEvent.click(connectButton);
        
        // Wait for connection to complete
        await waitFor(() => {
          expect(canvasService.setCredentials).toHaveBeenCalled();
        });
      });
      
      test('successfully syncs Canvas events', async () => {
        // Mock successful sync with 5 events
        canvasService.syncWithCalendar.mockResolvedValue(5);
        
        // Find and click the sync button
        const syncButton = screen.getByTestId('canvas-sync-button');
        expect(syncButton).toBeInTheDocument();
        
        // Click the sync button
        fireEvent.click(syncButton);
        
        // Verify the sync method was called with the user ID
        expect(canvasService.syncWithCalendar).toHaveBeenCalledWith('test-user-id');
        
        // Verify loading state was shown
        expect(screen.getByTestId('canvas-sync-loading')).toBeInTheDocument();
        
        // Wait for success message
        await waitFor(() => {
          const successMessage = screen.getByTestId('canvas-success-message');
          expect(successMessage).toBeInTheDocument();
        });
      });
      
      test('handles Canvas sync failure', async () => {
        // Mock sync failure
        canvasService.syncWithCalendar.mockRejectedValue(new Error('Sync failed'));
        
        // Find and click the sync button
        const syncButton = screen.getByTestId('canvas-sync-button');
        expect(syncButton).toBeInTheDocument();
        
        // Click the sync button
        fireEvent.click(syncButton);
        
        // Verify the sync method was called
        expect(canvasService.syncWithCalendar).toHaveBeenCalledWith('test-user-id');
        
        // Wait for error message
        await waitFor(() => {
          const errorMessage = screen.getByTestId('canvas-sync-error-message');
          expect(errorMessage).toBeInTheDocument();
        });
      });
    });
  });
});
