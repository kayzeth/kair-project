import React, { useRef, useEffect } from 'react';
import { format } from 'date-fns';
import '../styles/DayEventsPopup.css';

const DayEventsPopup = ({ day, events, onClose, onEditEvent, position }) => {
  const popupRef = useRef(null);

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
                style={{ backgroundColor: event.color || 'var(--primary-color)' }}
              >
                <div className="popup-event-time">
                  {event.allDay ? 'All day' : format(eventStart, 'h:mm a')}
                </div>
                <div className="popup-event-title">{event.title}</div>
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
