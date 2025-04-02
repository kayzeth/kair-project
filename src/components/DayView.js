import React, { useState, useEffect, useRef } from 'react';
import { format, addHours, startOfDay, parseISO, isAfter, isBefore, getHours, getMinutes } from 'date-fns';

const DayView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  // State to track the height of all-day events container
  const [allDayEventsHeight, setAllDayEventsHeight] = useState(0);
  
  // Refs for the all-day events container and day view container
  const allDayEventsRef = useRef(null);
  const dayViewRef = useRef(null);
  
  // Custom time format function
  const formatTime = (date) => {
    const hours = getHours(date) % 12 || 12; // Convert 0 to 12 for 12 AM
    const minutes = getMinutes(date);
    const ampm = getHours(date) >= 12 ? 'pm' : 'am';
    
    // Only show minutes if they're not zero
    return minutes === 0 ? `${hours}${ampm}` : `${hours}:${minutes < 10 ? '0' + minutes : minutes}${ampm}`;
  };
  // Create time slots
  const timeSlots = [];
  for (let i = 0; i < 24; i++) {
    const timeLabel = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
    timeSlots.push(
      <div 
        className="time-slot" 
        key={i} 
        data-testid={`dayview-timeslot-${i}`}
      >
        <span className="time-label">{timeLabel}</span>
      </div>
    );
  }

  // Helper function to check if an event should appear on a specific day
  const shouldShowEventOnDay = (event, day) => {
    try {
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
    } catch (error) {
      console.error('Error in shouldShowEventOnDay:', error, event);
      return false;
    }
  };
  
  // Filter events for this day, including recurring events
  const dayEvents = events.filter(event => shouldShowEventOnDay(event, currentDate));

  // All-day events
  const allDayEvents = dayEvents.filter(event => event.allDay);
  
  // Time-based events
  const timeEvents = dayEvents.filter(event => !event.allDay);
  
  // Effect to measure the height of all-day events container
  useEffect(() => {
    if (allDayEventsRef.current) {
      const height = allDayEventsRef.current.scrollHeight;
      // Ensure minimum height for one event (approximately 30px)
      const minHeightForOneEvent = 30;
      const newHeight = Math.max(height, minHeightForOneEvent);
      
      if (newHeight !== allDayEventsHeight) {
        setAllDayEventsHeight(newHeight);
      }
    }
  }, [events, allDayEventsHeight]);
  
  // Effect to scroll to 8am when the component is rendered
  useEffect(() => {
    if (dayViewRef.current) {
      // Calculate scroll position for 8am
      // Each hour is 60px tall, and we need to account for the header and all-day events
      const headerHeight = 40; // Height of the day-header
      const allDayEventsHeight = allDayEventsRef.current ? allDayEventsRef.current.scrollHeight : 0;
      const hourHeight = 60; // Height of each hour slot
      const scrollTo8am = headerHeight + allDayEventsHeight + (8 * hourHeight);
      
      // Scroll to 8am
      dayViewRef.current.scrollTop = scrollTo8am;
    }
  }, [allDayEventsHeight]);
  
  // Create hour slots
  const hourSlots = [];
  for (let i = 0; i < 24; i++) {
    // Filter events for this hour
    const hourEvents = timeEvents.filter(event => {
      try {
        const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
        const eventHour = eventStart.getHours();
        return eventHour === i;
      } catch (error) {
        console.error('Error parsing event start time:', error, event);
        return false;
      }
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
              top: `${(() => {
                try {
                  const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
                  return (eventStart.getMinutes() / 60) * 100;
                } catch (error) {
                  console.error('Error calculating event position:', error, event);
                  return 0;
                }
              })()}%`,
              height: `${(() => {
                try {
                  const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
                  const eventEnd = typeof event.end === 'string' ? parseISO(event.end) : event.end;
                  
                  // If no end time, default to 1 hour
                  if (!eventEnd) {
                    return 60;
                  }
                  
                  // Calculate duration in minutes
                  const durationMinutes = (eventEnd - eventStart) / (1000 * 60);
                  
                  // Calculate height based on duration (60px per hour)
                  const heightInPixels = (durationMinutes / 60) * 60;
                  
                  // Ensure minimum height
                  return Math.max(heightInPixels, 30);
                } catch (error) {
                  console.error('Error calculating event height:', error, event);
                  return 30; // Default height
                }
              })()}px`
            }}
          >
            <div className="time-event-content">
              <div className="time-event-title">{event.title}</div>
              {(() => {
                try {
                  const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
                  const eventEnd = typeof event.end === 'string' ? parseISO(event.end) : event.end;
                  
                  // If no end time, default to 1 hour
                  if (!eventEnd) {
                    return null;
                  }
                  
                  // Calculate duration in minutes
                  const durationMinutes = (eventEnd - eventStart) / (1000 * 60);
                  
                  // Only show time if event is at least 45 minutes long (enough space for two lines)
                  if (durationMinutes >= 45) {
                    return (
                      <div className="time-event-time">
                        {formatTime(eventStart)} - {formatTime(eventEnd)}
                      </div>
                    );
                  }
                  return null;
                } catch (error) {
                  console.error('Error calculating event duration:', error, event);
                  return null;
                }
              })()}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="day-view" data-testid="day-view-container" ref={dayViewRef}>
      <div className="time-column">
        <div className="day-header"></div>
        {/* Empty space for all-day events */}
        <div 
          className="time-column-all-day-spacer"
          style={{ 
            minHeight: allDayEventsHeight > 0 ? `${allDayEventsHeight}px` : undefined,
            fontSize: 'var(--font-size-xs)',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
          }}
        >All Day</div>
        <div>
          {timeSlots}
        </div>
      </div>
      <div className="day-column">
        <div className="day-header" data-testid="dayview-date-header">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </div>
        {/* All-day events container */}
        <div 
          className="day-all-day-events"
          ref={allDayEventsRef}
          style={{ 
            minHeight: allDayEventsHeight > 0 ? `${allDayEventsHeight}px` : undefined
          }}
        >
          {allDayEvents.map(event => (
            <div
              key={event.id}
              className="event all-day"
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
        </div>
        <div className="day-content">
          {hourSlots}
        </div>
      </div>
    </div>
  );
};

export default DayView;
