import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, getHours, getMinutes } from 'date-fns';
import DayEventsPopup from './DayEventsPopup';

const MonthView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  const [popupDay, setPopupDay] = useState(null);
  const [popupEvents, setPopupEvents] = useState([]);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

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
    // Special handling for all-day events
    if (event.allDay) {
      // For all-day events, use the stored date strings to avoid timezone issues
      const startDate = event.start instanceof Date ? format(event.start, 'yyyy-MM-dd') : event.start.split('T')[0];
      const endDate = event.end instanceof Date ? format(event.end, 'yyyy-MM-dd') : event.end.split('T')[0];
      
      // Format the day we're checking to yyyy-MM-dd for string comparison
      const dayString = format(day, 'yyyy-MM-dd');
      
      // Check if the day is between start and end dates (inclusive)
      return dayString >= startDate && dayString <= endDate;
    }
    
    // Handle both Date objects and ISO strings for non-all-day events
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
      
      // Sort events chronologically by start time
      dayEvents.sort((a, b) => {
        const aStart = a.start instanceof Date ? a.start : new Date(a.start);
        const bStart = b.start instanceof Date ? b.start : new Date(b.start);
        
        // Put all-day events first
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        
        // Then sort by start time
        return aStart.getTime() - bStart.getTime();
      });

      days.push(
        <div
          className={`calendar-day ${
            !isSameMonth(day, monthStart) ? 'other-month' : ''
          } ${isSameDay(day, new Date()) ? 'today' : ''}`}
          key={day}
          data-testid={`monthview-day-${format(day, 'yyyy-MM-dd')}`}
          onClick={() => onAddEvent(cloneDay)}
          style={{ overflow: 'auto' }}
        >
          <div className="day-number-container">
            <div className="day-number" data-testid={`monthview-day-number-${format(day, 'yyyy-MM-dd')}`}>{dayNumber}</div>
          </div>
          <div className="day-events">
            {/* Show first 2 events if there are more than 3, otherwise show all (up to 3) */}
            {dayEvents.slice(0, dayEvents.length > 3 ? 2 : 3).map(event => {
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
            {dayEvents.length > 3 && (
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
                +{dayEvents.length - 2} more
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
    <div className="month-view-container">
      <div className="calendar-day-names">{dayNames}</div>
      <div className="month-rows-container">
        {rows}
      </div>
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
