import React from 'react';
import { format, addHours, startOfDay, parseISO, isAfter, isBefore } from 'date-fns';

const DayView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  // Create time slots
  const timeSlots = [];
  for (let i = 0; i < 24; i++) {
    timeSlots.push(
      <div className="time-slot" key={i} data-testid={`dayview-timeslot-${i}`}>
        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
      </div>
    );
  }

  // Helper function to check if an event should appear on a specific day
  const shouldShowEventOnDay = (event, day) => {
    // Parse event start date
    const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
    
    // If it's not a recurring event, just check if it's on the same day
    if (!event.recurring) {
      const eventDay = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
      const currentDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      return eventDay.getTime() === currentDay.getTime();
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
  
  // Filter events for this day, including recurring events
  const dayEvents = events.filter(event => shouldShowEventOnDay(event, currentDate));

  // All-day events
  const allDayEvents = dayEvents.filter(event => event.allDay);
  
  // Time-based events
  const timeEvents = dayEvents.filter(event => !event.allDay);
  
  // Create hour slots
  const hourSlots = [];
  for (let i = 0; i < 24; i++) {
    // Filter events for this hour
    const hourEvents = timeEvents.filter(event => {
      const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
      const eventHour = eventStart.getHours();
      return eventHour === i;
    });
    
    hourSlots.push(
      <div 
        className="hour-slot" 
        key={i}
        onClick={() => {
          const newDate = addHours(startOfDay(currentDate), i);
          onAddEvent(newDate);
        }}
      >
        {hourEvents.map(event => (
          <div
            key={event.id}
            className="time-event"
            data-testid={`dayview-event-${event.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onEditEvent(event);
            }}
            style={{ 
              backgroundColor: event.color || 'var(--primary-color)',
              top: `${(parseISO(event.start).getMinutes() / 60) * 100}%`,
              height: '30px'
            }}
          >
            {event.title}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="day-view" data-testid="day-view-container">
      <div className="time-column">
        <div className="day-header"></div>
        {timeSlots}
      </div>
      <div className="day-column">
        <div className="day-header" data-testid="dayview-date-header">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </div>
        <div>
          {allDayEvents.map(event => (
            <div
              key={event.id}
              className="event"
              data-testid={`dayview-event-${event.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onEditEvent(event);
              }}
              style={{ backgroundColor: event.color || 'var(--primary-color)' }}
            >
              {event.title}
            </div>
          ))}
          {hourSlots}
        </div>
      </div>
    </div>
  );
};

export default DayView;
