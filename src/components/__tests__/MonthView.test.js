import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MonthView from '../MonthView';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';

describe('MonthView Component', () => {
  const mockDate = new Date(2025, 2, 15); // March 15, 2025
  const mockEvents = [
    {
      id: '1',
      title: 'Monthly Meeting',
      start: '2025-03-15',
      end: '2025-03-15',
      allDay: true,
      color: '#ff0000'
    },
    {
      id: '2',
      title: 'Conference',
      start: '2025-03-20T10:00:00',
      end: '2025-03-20T16:00:00',
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

  test('renders all days of the month correctly', () => {
    render(<MonthView currentDate={mockDate} events={mockEvents} onAddEvent={jest.fn()} onEditEvent={jest.fn()} />);

    // Define startDate and endDate inside the test
    const startDate = startOfWeek(startOfMonth(mockDate));
    const endDate = endOfWeek(endOfMonth(mockDate));

    let day = startDate;
    while (day <= endDate) {
      const dayNumber = day.getDate().toString();
      
      // Get all matching elements with that day number
      const matchingElements = screen.getAllByText(dayNumber);
      
      // Filter to find the correct `.calendar-day` element, avoiding `.other-month`
      const correctDay = matchingElements.find(el => 
        el.closest('.calendar-day') && !el.closest('.other-month')
      );

      expect(correctDay).toBeInTheDocument();
      day = addDays(day, 1);
    }
  });

  test('renders events on the correct days', () => {
    render(
      <MonthView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Check if events are rendered
    expect(screen.getByText('Monthly Meeting')).toBeInTheDocument();
    expect(screen.getByText(/Conference/)).toBeInTheDocument();
  });

  test('calls onEditEvent when clicking on an event', () => {
    render(
      <MonthView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Click on an event
    fireEvent.click(screen.getByText('Monthly Meeting'));
    
    // Check if onEditEvent was called with the correct event
    expect(mockOnEditEvent).toHaveBeenCalledWith(mockEvents[0]);
  });

  test('calls onAddEvent when clicking on a day cell', () => {
    render(
      <MonthView 
        currentDate={mockDate} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
  
    // Find all elements containing "15" (for March 15, 2025)
    const dayCells = screen.getAllByText('15');
  
    // Find the correct `.calendar-day` element
    const validDayCell = dayCells.find(el => el.closest('.calendar-day'));
    
    // Ensure we found a valid day cell before clicking
    expect(validDayCell).toBeInTheDocument();
  
    // Click the day cell
    fireEvent.click(validDayCell);
  
    // Ensure onAddEvent was triggered
    expect(mockOnAddEvent).toHaveBeenCalled();
  });

  test('highlights the current day', () => {
    // Set the mock date to today to test current day highlighting
    const today = new Date();
    const todayStr = today.getDate().toString();
    
    render(
      <MonthView 
        currentDate={today} 
        events={mockEvents} 
        onAddEvent={mockOnAddEvent} 
        onEditEvent={mockOnEditEvent} 
      />
    );
    
    // Find all day cells for today's date
    const todayCells = screen.getAllByText(todayStr);
    
    // Find the cell that's in the current month (not other-month) and has the 'today' class
    const todayCell = todayCells.find(el => {
      const parent = el.closest('.calendar-day');
      return parent && parent.classList.contains('today');
    });
    
    // Verify that we found a cell with the 'today' class
    expect(todayCell).toBeInTheDocument();
    expect(todayCell.closest('.calendar-day')).toHaveClass('today');
  });

  test('shows different month days with different styling', () => {
    render(<MonthView currentDate={mockDate} events={mockEvents} onAddEvent={jest.fn()} onEditEvent={jest.fn()} />);
    
    // Get the first day of the current month
    const dayCells = screen.getAllByText('1');
    const firstDayCell = dayCells.find(el => el.closest('.calendar-day') && !el.closest('.other-month'));
    expect(firstDayCell).toBeInTheDocument();
  
    // Find a day from the previous month (e.g., first shown day)
    const startDate = startOfWeek(startOfMonth(mockDate));
    if (startDate.getMonth() !== mockDate.getMonth()) {
      const prevMonthDay = startDate.getDate().toString();
      const prevMonthDayCells = screen.getAllByText(prevMonthDay);
      
      // Find the one inside `.other-month`
      const prevMonthDayCell = prevMonthDayCells.find(el => el.closest('.other-month'));
      expect(prevMonthDayCell).toBeInTheDocument();
  
      // Ensure they have different styling
      const firstDayParent = firstDayCell.closest('.calendar-day');
      const prevMonthDayParent = prevMonthDayCell.closest('.calendar-day');
  
      if (firstDayParent && prevMonthDayParent) {
        expect(firstDayParent.className).not.toBe(prevMonthDayParent.className);
      }
    }
  });  
});
