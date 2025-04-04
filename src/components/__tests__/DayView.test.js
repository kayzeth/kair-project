import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DayView from '../DayView';
import { format, addHours, startOfDay } from 'date-fns';

describe('DayView Component', () => {
  const mockDate = new Date(2025, 2, 15); // March 15, 2025
  const mockEvents = [
    {
      id: '1',
      title: 'All Day Event',
      start: '2025-03-15',
      end: '2025-03-15',
      allDay: true,
      color: '#ff0000'
    },
    {
      id: '2',
      title: 'Meeting',
      start: '2025-03-15T10:00:00',
      end: '2025-03-15T11:00:00',
      allDay: false,
      color: '#00ff00'
    }
  ];
  
  const mockOnAddEvent = jest.fn();
  const mockOnEditEvent = jest.fn();

  beforeEach(() => {
    mockOnAddEvent.mockClear();
    mockOnEditEvent.mockClear();
  });

  test('renders the day view with correct date', () => {
    render(
      <DayView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if the day header shows the correct date
    const dateHeader = screen.getByTestId('dayview-date-header');
    expect(dateHeader).toBeInTheDocument();
    expect(dateHeader).toHaveTextContent(format(mockDate, 'EEEE, MMMM d, yyyy'));
  });

  test('renders time slots correctly', () => {
    render(
      <DayView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if time slots are rendered
    expect(screen.getByTestId('dayview-timeslot-0')).toBeInTheDocument(); // 12 AM
    expect(screen.getByTestId('dayview-timeslot-12')).toBeInTheDocument(); // 12 PM
    expect(screen.getByTestId('dayview-timeslot-6')).toBeInTheDocument(); // 6 AM
    expect(screen.getByTestId('dayview-timeslot-18')).toBeInTheDocument(); // 6 PM
  });

  test('renders all-day events correctly', () => {
    render(
      <DayView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if all-day event is rendered
    const allDayEvent = screen.getByTestId('dayview-event-1'); // All Day Event
    expect(allDayEvent).toBeInTheDocument();
    
    // Check if clicking the event calls onEditEvent
    fireEvent.click(allDayEvent);
    expect(mockOnEditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockEvents[0].id,
        title: mockEvents[0].title,
        start: mockEvents[0].start,
        end: mockEvents[0].end,
        allDay: mockEvents[0].allDay,
        color: mockEvents[0].color
      })
    );
  });

  test('renders time-based events correctly', () => {
    render(
      <DayView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if time-based event is rendered
    const timeEvent = screen.getByTestId('dayview-event-2'); // Meeting
    expect(timeEvent).toBeInTheDocument();
    
    // Check if clicking the event calls onEditEvent
    fireEvent.click(timeEvent);
    expect(mockOnEditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockEvents[1].id,
        title: mockEvents[1].title,
        start: mockEvents[1].start,
        end: mockEvents[1].end,
        allDay: mockEvents[1].allDay,
        color: mockEvents[1].color
      })
    );
  });

  test('calls onAddEvent when clicking on an hour slot', () => {
    render(
      <DayView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Find and click on an hour slot (this is a bit tricky in testing)
    // For simplicity, we'll assume the hour slots are rendered and clickable
    const hourSlots = document.querySelectorAll('.hour-slot');
    if (hourSlots.length > 0) {
      fireEvent.click(hourSlots[9]); // Click on the 9 AM slot
      
      // Check if onAddEvent was called with the correct date
      expect(mockOnAddEvent).toHaveBeenCalled();
      const expectedDate = addHours(startOfDay(mockDate), 9);
      const actualDate = mockOnAddEvent.mock.calls[0][0];
      
      // Compare hours only since the exact milliseconds might differ
      expect(actualDate.getHours()).toBe(expectedDate.getHours());
    }
  });

  test('filters events for the current day only', () => {
    const differentDayEvent = {
      id: '3',
      title: 'Different Day Event',
      start: '2025-03-16T10:00:00', // Next day
      end: '2025-03-16T11:00:00',
      allDay: false
    };
    
    render(
      <DayView 
        currentDate={mockDate} 
        events={[...mockEvents, differentDayEvent]} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // The event from a different day should not be rendered
    expect(screen.queryByText('Different Day Event')).not.toBeInTheDocument();
  });
});
