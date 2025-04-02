import React, { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, getHours, getMinutes } from 'date-fns';
import DayEventsPopup from './DayEventsPopup';

const MonthView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  const [cellHeight, setCellHeight] = useState('auto');
  const [popupDay, setPopupDay] = useState(null);
  const [popupEvents, setPopupEvents] = useState([]);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  
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

  // Custom time format function
  const formatTime = (date) => {
    const hours = getHours(date) % 12 || 12; // Convert 0 to 12 for 12 AM
    const minutes = getMinutes(date);
    const ampm = getHours(date) >= 12 ? 'pm' : 'am';
    
    // Only show minutes if they're not zero
    return minutes === 0 ? `${hours}${ampm}` : `${hours}:${minutes < 10 ? '0' + minutes : minutes}${ampm}`;
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
            {dayEvents.slice(0, 1).map(event => {
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
                    cursor: 'pointer',
                    padding: '2px 4px',
                    marginBottom: '2px',
                    borderRadius: '3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    backgroundColor: event.allDay ? (event.color || 'var(--primary-color)') : 'transparent',
                    color: event.allDay ? 'white' : 'var(--text-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title={`${event.title}${event.allDay ? ' (All day)' : ` - Due: ${formatTime(eventStart)}`}`}
                >
                  {!event.allDay && (
                    <>
                      <div 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: event.color || 'var(--primary-color)',
                          flexShrink: 0
                        }}
                      />
                      <span>{formatTime(eventStart)} </span>
                    </>
                  )}
                  <span style={{ fontWeight: 600 }}>{event.title}</span>
                </div>
              );
            })}
            {dayEvents.length > 1 && (
              <div 
                className="more-events"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.target.getBoundingClientRect();
                  setPopupPosition({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX
                  });
                  setPopupDay(cloneDay);
                  setPopupEvents(dayEvents);
                }}
              >
                +{dayEvents.length - 1} more
              </div>
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
      {popupDay && (
        <DayEventsPopup
          day={popupDay}
          events={popupEvents}
          onClose={() => setPopupDay(null)}
          onEditEvent={onEditEvent}
          position={popupPosition}
        />
      )}
    </div>
  );
};

export default MonthView;
