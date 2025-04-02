import React, { useRef, useEffect } from 'react';
import { format, getHours, getMinutes } from 'date-fns';
import '../styles/DayEventsPopup.css';

const DayEventsPopup = ({ day, events, onClose, onEditEvent, position }) => {
  const popupRef = useRef(null);
  
  // Custom time format function
  const formatTime = (date) => {
    const hours = getHours(date) % 12 || 12; // Convert 0 to 12 for 12 AM
    const minutes = getMinutes(date);
    const ampm = getHours(date) >= 12 ? 'pm' : 'am';
    
    // Only show minutes if they're not zero
    return minutes === 0 ? `${hours}${ampm}` : `${hours}:${minutes < 10 ? '0' + minutes : minutes}${ampm}`;
  };

  useEffect(() => {
    // Handle clicking outside the popup to close it
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div 
      className="day-events-popup"
      ref={popupRef}
      style={{
        top: position.top,
        left: position.left
      }}
    >
      <div className="day-events-popup-header">
        <div className="day-events-popup-date">
          <div className="day-name">{format(day, 'EEEE')}</div>
          <div className="day-number">{format(day, 'MMMM d, yyyy')}</div>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="day-events-popup-content">
        {events.length > 0 ? (
          events.map(event => {
            const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
            return (
              <div
                key={event.id}
                className={`popup-event ${event.type || ''}`}
                onClick={() => {
                  onEditEvent(event);
                  onClose();
                }}
                style={{ 
                  backgroundColor: event.allDay ? (event.color || 'var(--primary-color)') : 'transparent',
                  color: event.allDay ? 'white' : 'var(--text-color)',
                  border: !event.allDay ? '1px solid var(--border-color)' : 'none'
                }}
              >
                {!event.allDay && (
                  <div 
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: event.color || 'var(--primary-color)',
                      flexShrink: 0,
                      marginRight: '8px'
                    }}
                  />
                )}
                <div className="popup-event-time">
                  {event.allDay ? 'All day' : formatTime(eventStart)}
                </div>
                <div className="popup-event-title" style={{ fontWeight: 600 }}>{event.title}</div>
              </div>
            );
          })
        ) : (
          <div className="no-events">No events for this day</div>
        )}
      </div>
    </div>
  );
};

export default DayEventsPopup;
