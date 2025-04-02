import React, { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addDays, addHours, startOfDay, isSameDay, parseISO, isAfter, isBefore, getHours, getMinutes } from 'date-fns';

const WeekView = ({ currentDate, events, onAddEvent, onEditEvent }) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Monday
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  
  // State to track the maximum height of all-day events containers
  const [maxAllDayHeight, setMaxAllDayHeight] = useState(0);
  
  // Refs to track all-day event containers
  const allDayContainersRef = useRef([]);
  
  // Ref for the week view container to enable scrolling
  const weekViewRef = useRef(null);
  
  // Initialize the refs array
  const initializeRefs = (dayCount) => {
    allDayContainersRef.current = Array(dayCount).fill().map(() => React.createRef());
  };
  
  // Calculate the number of days in the week view
  const dayCount = 7; // 7 days in a week
  
  // Initialize refs for each day
  initializeRefs(dayCount);
  
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
        data-testid={`weekview-timeslot-${i}`}
      >
        <span className="time-label">{timeLabel}</span>
      </div>
    );
  }

  // Effect to scroll to 8am when the component is rendered
  useEffect(() => {
    if (weekViewRef.current) {
      // Calculate scroll position for 8am
      // Each hour is 60px tall, and we need to account for the header and all-day events
      const headerHeight = 40; // Height of the week-day-header
      const allDayEventsHeight = maxAllDayHeight || 0;
      const hourHeight = 60; // Height of each hour slot
      const scrollTo8am = headerHeight + allDayEventsHeight + (8 * hourHeight);
      
      // Scroll to 8am with a small offset to show a bit of earlier hours
      weekViewRef.current.scrollTop = scrollTo8am; // Show 2 hours before 8am
    }
  }, [maxAllDayHeight]);
  
  // Effect to synchronize heights of all-day event containers
  useEffect(() => {
    // Function to calculate and set the maximum height
    const synchronizeAllDayContainerHeights = () => {
      // Get all refs that have a current value (i.e., the element exists)
      const validRefs = allDayContainersRef.current.filter(ref => ref.current);
      
      if (validRefs.length === 0) return;
      
      // Find the maximum height
      let maxHeight = 0;
      validRefs.forEach(ref => {
        const height = ref.current.scrollHeight;
        maxHeight = Math.max(maxHeight, height);
      });
      
      // Ensure minimum height for one event (approximately 30px)
      const minHeightForOneEvent = 30;
      maxHeight = Math.max(maxHeight, minHeightForOneEvent);
      
      // Set the maximum height in state
      if (maxHeight > 0 && maxHeight !== maxAllDayHeight) {
        setMaxAllDayHeight(maxHeight);
      }
    };
    
    // Run the synchronization after a short delay to ensure DOM is updated
    const timeoutId = setTimeout(synchronizeAllDayContainerHeights, 0);
    
    // Cleanup
    return () => clearTimeout(timeoutId);
  }, [events, maxAllDayHeight]);
  
  // Create day columns
  // Helper function to check if an event should appear on a specific day
  const shouldShowEventOnDay = (event, day) => {
    try {
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
    } catch (error) {
      console.error('Error in shouldShowEventOnDay:', error, event);
      return false;
    }
  };

  const dayColumns = [];
  let day = weekStart;
  let dayIndex = 0;
  
  // Always show space for all-day events, even if there are none
  const hasAnyAllDayEvents = true; // Always true to maintain consistent layout
  
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
            const newDate = addHours(startOfDay(currentDay), i);
            onAddEvent(newDate);
          }}
        >
          {hourEvents.map(event => {
            try {
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
                    height: `${(() => {
                      try {
                        const eventEnd = typeof stableEvent.end === 'string' ? parseISO(stableEvent.end) : stableEvent.end;
                        
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
                        console.error('Error calculating event height:', error, stableEvent);
                        return 30; // Default height
                      }
                    })()}px`
                  }}
                >
                  <div className="time-event-content">
                    <div className="time-event-title">{stableEvent.title}</div>
                    {(() => {
                      try {
                        const eventEnd = typeof stableEvent.end === 'string' ? parseISO(stableEvent.end) : stableEvent.end;
                        
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
                        console.error('Error calculating event duration:', error, stableEvent);
                        return null;
                      }
                    })()}
                  </div>
                </div>
              );
            } catch (error) {
              console.error('Error rendering event:', error, event);
              return null; // Skip rendering this event
            }
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
        {/* All-day events container */}
        {(hasAnyAllDayEvents) && (
          <div 
            className="week-day-all-day-events"
            ref={allDayContainersRef.current[dayIndex]}
            style={{ 
              minHeight: maxAllDayHeight > 0 ? `${maxAllDayHeight}px` : undefined,
              // Maintain consistent padding regardless of events
              padding: undefined
            }}
          >
            {allDayEvents.map(event => (
              <div
                key={event.id}
                className="event all-day"
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
          </div>
        )}
        {/* Time grid */}
        <div className="week-day-content">
          {hourSlots}
        </div>
      </div>
    );
    
    day = addDays(day, 1);
    dayIndex++;
  }

  return (
    <div className="week-view" data-testid="week-view-container" ref={weekViewRef}>
      <div className="time-column">
        <div className="week-day-header"></div>
        {/* Empty space for all-day events - height matches the all-day events containers */}
        {hasAnyAllDayEvents && (
          <div 
            className="time-column-all-day-spacer"
            style={{ 
              minHeight: maxAllDayHeight > 0 ? `${maxAllDayHeight}px` : undefined,
              fontSize: 'var(--font-size-xs)',
              alignItems: 'center',
              justifyContent: 'center',
              display: 'flex',
            }}
          >All Day</div>
        )}
        <div>
          {timeSlots}
        </div>
      </div>
      {dayColumns}
    </div>
  );
};

export default WeekView;
