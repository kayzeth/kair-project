import React from 'react';
import { format, startOfWeek, endOfWeek, addDays, addHours, startOfDay, isSameDay, parseISO, isAfter, isBefore } from 'date-fns';

const WeekView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Monday
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  
  // Create time slots
  const timeSlots = [];
  for (let i = 0; i < 24; i++) {
    timeSlots.push(
      <div className="time-slot" key={i} data-testid={`weekview-timeslot-${i}`}>
        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
      </div>
    );
  }

  // Create day columns
  // Helper function to check if an event should appear on a specific day
  const shouldShowEventOnDay = (event, day) => {
    // Parse event start date
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    
    // If it's not a recurring event, just check if it's on the same day
    if (!event.recurring) {
      return isSameDay(eventStart, day);
    }
    
    // For recurring events, check if the day of week matches
    const eventDayOfWeek = eventStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDayOfWeek = day.getDay();
    
    // If days of week don't match, event doesn't occur on this day
    if (eventDayOfWeek !== targetDayOfWeek) {
      return false;
    }
    
    // Check if the target day is after the event start date
    if (isBefore(day, eventStart)) {
      return false;
    }
    
    // Check if the event has an end date for recurrence
    if (event.repeatUntil) {
      let repeatUntilDate;
      
      // Parse the repeatUntil date
      if (typeof event.repeatUntil === 'string') {
        // Handle ISO string or date string
        try {
          repeatUntilDate = parseISO(event.repeatUntil);
        } catch (e) {
          console.error('Failed to parse repeatUntil date:', e);
          return false;
        }
      } else if (event.repeatUntil instanceof Date) {
        repeatUntilDate = event.repeatUntil;
      } else {
        // If repeatUntil is not a valid format, ignore it
        return true;
      }
      
      // Check if the target day is before or on the repeatUntil date
      return !isAfter(day, repeatUntilDate);
    }
    
    // If no repeatUntil is specified, the event recurs indefinitely
    return true;
  };

  const dayColumns = [];
  let day = weekStart;
  
  while (day <= weekEnd) {
    // Create a stable reference to the current day to avoid unsafe references in callbacks
    const currentDay = day;
    
    // Filter events for this day, including recurring events
    const dayEvents = events.filter(event => shouldShowEventOnDay(event, currentDay));
    
    const hourSlots = [];
    for (let i = 0; i < 24; i++) {
      // Capture day in a closure to avoid the loop reference issue
      const currentDay = day;
      
      // Filter events for this hour
      const hourEvents = dayEvents.filter(event => {
        if (event.allDay) return false;
        
        const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
        const eventHour = eventStart.getHours();
        return eventHour === i;
      });
      
      hourSlots.push(
        <div 
          className="hour-slot" 
          key={i}
          onClick={() => {
            const newDate = addHours(startOfDay(currentDay), i);
            onAddEvent(newDate);
          }}
        >
          {hourEvents.map(event => {
            // Create a stable reference to the event
            const stableEvent = event;
            const eventStart = typeof stableEvent.start === 'string' ? parseISO(stableEvent.start) : stableEvent.start;
            return (
              <div
                key={stableEvent.id}
                className="time-event"
                data-testid={`weekview-time-event-${stableEvent.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditEvent(stableEvent);
                }}
                style={{ 
                  backgroundColor: stableEvent.color || 'var(--primary-color)',
                  top: `${(eventStart.getMinutes() / 60) * 100}%`,
                  height: '30px'
                }}
              >
                {stableEvent.title}
              </div>
            );
          })}
        </div>
      );
    }
    
    // All-day events
    const allDayEvents = dayEvents.filter(event => event.allDay);
    
    dayColumns.push(
      <div className="week-day-column" key={day}>
        <div className="week-day-header" data-testid={`weekview-day-header-${format(day, 'yyyy-MM-dd')}`}>
          <div data-testid={`weekview-day-name-${format(day, 'EEE')}`}>{format(day, 'EEE')}</div>
          <div data-testid={`weekview-day-number-${format(day, 'd')}`}>{format(day, 'd')}</div>
        </div>
        <div className="week-day-content">
          {allDayEvents.map(event => (
            <div
              key={event.id}
              className="event"
              data-testid={`weekview-event-${event.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onEditEvent({
                  ...event,
                  start: event.start instanceof Date ? event.start.toISOString() : event.start,
                  end: event.end instanceof Date ? event.end.toISOString() : event.end,
                });                
              }}
              style={{ backgroundColor: event.color || 'var(--primary-color)' }}
            >
              {event.title}
            </div>
          ))}
          {hourSlots}
        </div>
      </div>
    );
    
    day = addDays(day, 1);
  }

  return (
    <div className="week-view" data-testid="week-view-container">
      <div className="time-column">
        <div className="week-day-header"></div>
        {timeSlots}
      </div>
      {dayColumns}
    </div>
  );
};

export default WeekView;
