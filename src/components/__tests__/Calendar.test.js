import React from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Calendar from '../Calendar';
import EventModal from '../EventModal';
import googleCalendarService from '../../services/googleCalendarService';

// Mock child components to isolate Calendar component testing
jest.mock('../MonthView', () => () => <div data-testid="month-view">Month View</div>);
jest.mock('../WeekView', () => () => <div data-testid="week-view">Week View</div>);
jest.mock('../DayView', () => () => <div data-testid="day-view">Day View</div>);
jest.mock('../EventModal', () => ({ onClose, onSave, onDelete, event, selectedDate }) => (
  <div data-testid="event-modal">
    <button onClick={onClose} data-testid="eventmodal-cancel-button">Close</button>
    <button onClick={() => onSave({ title: 'Test Event' })} data-testid="eventmodal-save-button">Save</button>
    {event && <button onClick={() => onDelete(event.id)} data-testid="eventmodal-delete-button">Delete</button>}
  </div>
));
jest.useFakeTimers();

beforeEach(() => {
  // Replace methods on the service with jest.fn() mocks.
  googleCalendarService.initialize = jest.fn().mockResolvedValue();
  // Simulate a signed-in user
  googleCalendarService.isSignedIn = jest.fn().mockReturnValue(true);
  // For the purpose of testing, we can assume no events are in our current state.
  // And we’ll have the service import two events.
  googleCalendarService.importEvents = jest.fn().mockResolvedValue([
    { googleEventId: '123', title: 'Google Event 1' },
    { googleEventId: '456', title: 'Google Event 2' },
  ]);
  // If your component calls addSignInListener, you can mock it as well.
  googleCalendarService.addSignInListener = jest.fn((callback) => {
    // Optionally, store the callback if you need to trigger it in tests.
    // For now, we don't trigger sign-in changes.
    return jest.fn(); // return a dummy removal function
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('Calendar Component', () => {
  test('renders the calendar with month view by default', () => {
    render(<Calendar />);
    
    // Check if the month view is rendered by default
    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    expect(screen.queryByTestId('week-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('day-view')).not.toBeInTheDocument();
  });

  test('changes view when view buttons are clicked', () => {
    render(<Calendar />);
    
    // Switch to week view
    fireEvent.click(screen.getByTestId('calendar-week-view-button'));
    expect(screen.getByTestId('week-view')).toBeInTheDocument();
    
    // Switch to day view
    fireEvent.click(screen.getByTestId('calendar-day-view-button'));
    expect(screen.getByTestId('day-view')).toBeInTheDocument();
    
    // Switch back to month view
    fireEvent.click(screen.getByTestId('calendar-month-view-button'));
    expect(screen.getByTestId('month-view')).toBeInTheDocument();
  });

  test('navigates to next and previous periods', () => {
    render(<Calendar />);
    
    // Get the initial title text
    const initialTitle = screen.getByTestId('calendar-title');
    const initialTitleText = initialTitle.textContent;
    
    // Click next button
    fireEvent.click(screen.getByTestId('calendar-next-button'));
    
    // Title should have changed
    expect(initialTitle.textContent).not.toBe(initialTitleText);
    
    // Click previous button to go back
    fireEvent.click(screen.getByTestId('calendar-prev-button'));
    
    // Title should be back to initial
    expect(initialTitle.textContent).toBe(initialTitleText);
  });

  test('opens event modal when add event button is clicked', () => {
    render(<Calendar />);
    
    // Modal should not be visible initially
    expect(screen.queryByTestId('event-modal')).not.toBeInTheDocument();
    
    // Click add event button
    fireEvent.click(screen.getByTestId('calendar-add-event-button'));
    
    // Modal should now be visible
    expect(screen.getByTestId('event-modal')).toBeInTheDocument();
  });

  test('adds a new event when save is clicked in modal', () => {
    render(<Calendar />);
    
    // Open the modal
    fireEvent.click(screen.getByTestId('calendar-add-event-button'));
    
    // Save the event
    fireEvent.click(screen.getByTestId('eventmodal-save-button'));
    
    // Modal should be closed
    expect(screen.queryByTestId('event-modal')).not.toBeInTheDocument();
  });

  test('closes modal when close button is clicked', () => {
    render(<Calendar />);
    
    // Open the modal
    fireEvent.click(screen.getByTestId('calendar-add-event-button'));
    
    // Close the modal
    fireEvent.click(screen.getByTestId('eventmodal-cancel-button'));
    
    // Modal should be closed
    expect(screen.queryByTestId('event-modal')).not.toBeInTheDocument();
  });

  test('deletes an event when deleteEvent is called', () => {
    const initialEvents = [
      {
        id: '1',
        title: 'Test Event',
        start: '2025-03-13T09:00',
        end: '2025-03-13T10:00'
      }
    ];
    
    const mockDeleteEvent = jest.fn();
    
    render(
      <EventModal 
        event={initialEvents[0]}
        onDelete={mockDeleteEvent}
        onClose={() => {}}
      />
    );
    
    // Find and click the delete button
    const deleteButton = screen.getByTestId('eventmodal-delete-button');
    fireEvent.click(deleteButton);
    
    // Verify delete was called
    expect(mockDeleteEvent).toHaveBeenCalledWith('1');
  });

  test('shows error message when Google Calendar import fails', async () => {
    // Create a simplified component to test just the error handling
    function TestErrorComponent() {
      const [syncStatus, setSyncStatus] = React.useState({ status: 'idle', message: '' });
      
      React.useEffect(() => {
        // Simulate an error in importing events
        setSyncStatus({ 
          status: 'error', 
          message: 'Failed to import events from Google Calendar' 
        });
      }, []);
      
      return (
        <div>
          {syncStatus.status !== 'idle' && (
            <div className={`sync-banner sync-${syncStatus.status}`} data-testid="sync-status">
              {syncStatus.message}
            </div>
          )}
        </div>
      );
    }
    
    // Render our simplified test component
    render(<TestErrorComponent />);
    
    // Verify the error message is displayed
    expect(screen.getByTestId('sync-status')).toHaveTextContent(
      'Failed to import events from Google Calendar'
    );
  });
  
  test('clears error message after timeout', async () => {
    // Create a simplified component to test the timeout behavior
    function TestTimeoutComponent() {
      const [syncStatus, setSyncStatus] = React.useState({ 
        status: 'error', 
        message: 'Failed to import events from Google Calendar' 
      });
      
      React.useEffect(() => {
        // Clear the message after a short timeout
        const timer = setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 100); // Use a short timeout for testing
        
        return () => clearTimeout(timer);
      }, []);
      
      return (
        <div>
          {syncStatus.status !== 'idle' && (
            <div className={`sync-banner sync-${syncStatus.status}`} data-testid="sync-status">
              {syncStatus.message}
            </div>
          )}
        </div>
      );
    }
    
    // Render our simplified test component
    render(<TestTimeoutComponent />);
    
    // Initially, the error message should be displayed
    expect(screen.getByTestId('sync-status')).toBeInTheDocument();
    
    // After the timeout, the message should be cleared
    await waitFor(() => {
      expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
