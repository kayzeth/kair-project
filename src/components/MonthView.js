import React, { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';

const MonthView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  const [cellHeight, setCellHeight] = useState('auto');
  
  // Calculate the height of each cell based on the available space
  useEffect(() => {
    const calculateCellHeight = () => {
      const viewportHeight = window.innerHeight;
      const headerHeight = 160; // Approximate header height including margins
      const availableHeight = viewportHeight - headerHeight;
      const rowCount = 6; // Maximum number of rows in a month view
      const dayNameHeight = 40; // Approximate height of day names row
      
      // Calculate height per cell and subtract borders
      const height = Math.floor((availableHeight - dayNameHeight) / rowCount) - 2;
      setCellHeight(`${height}px`);
    };
    
    calculateCellHeight();
    window.addEventListener('resize', calculateCellHeight);
    
    return () => {
      window.removeEventListener('resize', calculateCellHeight);
    };
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const rows = [];
  let days = [];
  let day = startDate;

  // Create day name headers
  const dayNames = [];
  for (let i = 0; i < 7; i++) {
    dayNames.push(
      <div className="day-name" key={i} data-testid={`monthview-weekday-${i}`}>
        {format(addDays(startDate, i), 'EEE')}
      </div>
    );
  }

  // Helper function to check if an event should appear on a specific day
  const shouldShowEventOnDay = (event, day) => {
    // Handle both Date objects and ISO strings
    const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
    
    // If it's not a recurring event, just check if it's on the same day
    if (!event.recurring) {
      return isSameDay(eventStart, day);
    }
    
    // For recurring events, check if the day of week matches
    const eventDayOfWeek = eventStart.getDay();
    const targetDayOfWeek = day.getDay();
    
    // If days of week don't match, event doesn't occur on this day
    if (eventDayOfWeek !== targetDayOfWeek) {
      return false;
    }
    
    // Check if the target day is after the event start date
    if (day < eventStart) {
      return false;
    }
    
    // Check if the event has an end date for recurrence
    if (event.repeatUntil) {
      const repeatUntilDate = event.repeatUntil instanceof Date ? 
        event.repeatUntil : new Date(event.repeatUntil);
      
      // Check if the target day is before or on the repeatUntil date
      return day <= repeatUntilDate;
    }
    
    // If no repeatUntil is specified, the event recurs indefinitely
    return true;
  };

  // Create calendar days
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const dayNumber = format(day, 'd');
      
      // Filter events for this day, including recurring events
      const dayEvents = events.filter(event => shouldShowEventOnDay(event, cloneDay));

      days.push(
        <div
          className={`calendar-day ${
            !isSameMonth(day, monthStart) ? 'other-month' : ''
          } ${isSameDay(day, new Date()) ? 'today' : ''}`}
          key={day}
          data-testid={`monthview-day-${format(day, 'yyyy-MM-dd')}`}
          onClick={() => onAddEvent(cloneDay)}
          style={{ height: cellHeight, overflow: 'hidden' }}
        >
          <div className="day-number" data-testid={`monthview-day-number-${format(day, 'yyyy-MM-dd')}`}>{dayNumber}</div>
          <div className="day-events">
            {dayEvents.slice(0, 3).map(event => {
              const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
              return (
                <div
                  key={event.id}
                  data-testid={`monthview-event-${event.id}`}
                  className={`event ${event.type || ''} ${event.allDay ? 'all-day' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditEvent(event);
                  }}
                  style={{ 
                    backgroundColor: event.color || 'var(--primary-color)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    marginBottom: '2px',
                    borderRadius: '3px',
                    fontSize: '0.85em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={`${event.title}${event.allDay ? ' (All day)' : ` - Due: ${format(eventStart, 'h:mm a')}`}`}
                >
                  {!event.allDay && `${format(eventStart, 'h:mm a')} `}{event.title}
                </div>
              );
            })}
            {dayEvents.length > 3 && (
              <div className="more-events">+{dayEvents.length - 3} more</div>
            )}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="calendar-grid" key={`row-${format(day, 'yyyy-MM-dd')}`}>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div>
      <div className="calendar-day-names">{dayNames}</div>
      {rows}
    </div>
  );
};

export default MonthView;
