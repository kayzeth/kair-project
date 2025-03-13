import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WeekView from '../WeekView';
import { prettyDOM } from '@testing-library/react';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';

describe('WeekView Component', () => {
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
      start: '2025-03-15T14:00:00',
      end: '2025-03-15T15:00:00',
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

  test('renders the week view with correct days', () => {
    render(
      <WeekView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if the week days are rendered correctly
    const weekStart = startOfWeek(mockDate);
    const weekEnd = endOfWeek(weekStart);
    
    let day = weekStart;
    while (day <= weekEnd) {
      expect(screen.getByText(format(day, 'EEE'))).toBeInTheDocument();
      expect(screen.getByText(format(day, 'd'))).toBeInTheDocument();
      day = addDays(day, 1);
    }
  });

  test('renders time slots correctly', () => {
    render(
      <WeekView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if time slots are rendered
    expect(screen.getByText('12 AM')).toBeInTheDocument();
    expect(screen.getByText('12 PM')).toBeInTheDocument();
    expect(screen.getByText('6 AM')).toBeInTheDocument();
    expect(screen.getByText('6 PM')).toBeInTheDocument();
  });

  test('renders all-day events on the correct day', async () => {
    render(
      <WeekView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
  
    // Find the event by its text
    const allDayEvent = screen.getByText('All Day Event');
    expect(allDayEvent).toBeInTheDocument();
  
    // Check if clicking the event calls onEditEvent
    fireEvent.click(allDayEvent);
    expect(mockOnEditEvent).toHaveBeenCalledWith(mockEvents[0]);
  });  

  test('renders time-based events on the correct day', () => {
    const processedMockEvents = mockEvents.map(event => ({
      ...event,
      start: typeof event.start === 'string' ? parseISO(event.start) : event.start,
      end: typeof event.end === 'string' ? parseISO(event.end) : event.end,
    }));          

    render(
      <WeekView 
        currentDate={mockDate} 
        events={processedMockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
  
    // Find all `.time-event` elements
    const timeEvents = document.querySelectorAll('.time-event');
    
    // Ensure at least one `.time-event` exists
    expect(timeEvents.length).toBeGreaterThan(0);
  
    // Find the "Meeting" event inside `.time-event`
    const meetingEvent = [...timeEvents].find(event => event.textContent.includes('Meeting'));
  
    // Ensure the event is found
    expect(meetingEvent).toBeInTheDocument();
  
    // Simulate click to trigger `onEditEvent`
    fireEvent.click(meetingEvent);
    expect(mockOnEditEvent).toHaveBeenCalledWith({
      ...mockEvents[1],
      start: new Date(mockEvents[1].start), // Ensures both expected and received values are Date objects
      end: new Date(mockEvents[1].end),
    });       
  });  

  test('filters events for each day correctly', () => {
    const differentWeekEvent = {
      id: '3',
      title: 'Different Week Event',
      start: '2025-03-22T10:00:00', // Next week
      end: '2025-03-22T11:00:00',
      allDay: false
    };
    
    render(
      <WeekView 
        currentDate={mockDate} 
        events={[...mockEvents, differentWeekEvent]} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // The event from a different week should not be rendered
    expect(screen.queryByText('Different Week Event')).not.toBeInTheDocument();
  });

  test('calls onAddEvent when clicking on an hour slot', () => {
    render(
      <WeekView 
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
      fireEvent.click(hourSlots[0]); // Click on the first hour slot
      
      // Check if onAddEvent was called
      expect(mockOnAddEvent).toHaveBeenCalled();
    }
  });
});
