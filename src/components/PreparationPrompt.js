import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBookOpen, faClock, faCheck } from '@fortawesome/free-solid-svg-icons';
import './PreparationPrompt.css';

/**
 * Component that prompts the user to enter preparation hours for events
 * [KAIR-16] This component is displayed when events require preparation but have no hours specified
 */
const PreparationPrompt = ({ events, onSave, onClose, onDismiss }) => {
  const [preparationHours, setPreparationHours] = useState({});
  const [errors, setErrors] = useState({});
  const inputRefs = useRef({});

  // Initialize preparation hours state
  useEffect(() => {
    if (events && events.length > 0) {
      const initialHours = {};
      events.forEach(event => {
        initialHours[event.id] = '';
      });
      setPreparationHours(initialHours);
    }
  }, [events]);

  // Focus the first input field when component mounts
  useEffect(() => {
    if (events && events.length > 0 && inputRefs.current[events[0].id]) {
      inputRefs.current[events[0].id].focus();
    }
  }, [events]);

  const handleChange = (eventId, value) => {
    // Input validation - allow empty or positive numbers
    if (value === '' || (Number(value) >= 0 && !isNaN(Number(value)))) {
      setPreparationHours(prev => ({
        ...prev,
        [eventId]: value
      }));
      
      // Clear error for this event if it exists
      if (errors[eventId]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[eventId];
          return newErrors;
        });
      }
    } else {
      setErrors(prev => ({
        ...prev,
        [eventId]: 'Please enter a positive number'
      }));
    }
  };

  const handleSubmit = (e, eventId) => {
    e.preventDefault();
    
    // Validate input before saving
    if (preparationHours[eventId] === undefined || preparationHours[eventId] === '') {
      setErrors(prev => ({
        ...prev,
        [eventId]: 'Please enter preparation hours'
      }));
      return;
    }
    
    const hours = Number(preparationHours[eventId]);
    if (isNaN(hours) || hours < 0) {
      setErrors(prev => ({
        ...prev,
        [eventId]: 'Please enter a valid positive number'
      }));
      return;
    }
    
    // Save the preparation hours
    onSave(eventId, hours);
    
    // Clear the input field after saving
    setPreparationHours(prev => ({
      ...prev,
      [eventId]: ''
    }));
    
    // Find the next event that still needs hours
    const remainingEvents = events.filter(
      event => event.id !== eventId && (preparationHours[event.id] === undefined || preparationHours[event.id] === '')
    );
    
    if (remainingEvents.length > 0 && inputRefs.current[remainingEvents[0].id]) {
      inputRefs.current[remainingEvents[0].id].focus();
    }
  };

  const handleKeyDown = (e, eventId) => {
    // Save when Enter key is pressed
    if (e.key === 'Enter') {
      handleSubmit(e, eventId);
    }
  };

  const handleDismiss = (eventId) => {
    if (onDismiss) {
      onDismiss(eventId);
    }
  };

  // If no events, don't render anything
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="preparation-prompt-container" data-testid="preparation-prompt-container">
      <div 
        className="preparation-prompt" 
        data-testid="preparation-prompt"
      >
        <button 
          className="close-button" 
          onClick={onClose}
          aria-label="Close"
          data-testid="preparation-close-button"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
        
        <div className="prompt-header">
          <FontAwesomeIcon icon={faBookOpen} className="prompt-icon" />
          <h3 data-testid="preparation-title">Study Preparation Required</h3>
        </div>
        
        <p className="prompt-instruction" data-testid="preparation-instruction">
          Please enter preparation hours for the following events:
        </p>
        
        <div className="events-list">
          {events.map(event => (
            <div key={event.id} className="event-item">
              <div className="event-details">
                <p className="event-title" data-testid={`preparation-event-title-${event.id}`}>{event.title}</p>
                <p className="event-date" data-testid={`preparation-event-date-${event.id}`}>
                  {new Date(event.start).toLocaleDateString()} at {
                    event.startTime || new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                  }
                </p>
              </div>
              
              <div className="event-input-container">
                <input
                  ref={el => inputRefs.current[event.id] = el}
                  type="number"
                  value={preparationHours[event.id] || ''}
                  onChange={(e) => handleChange(event.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, event.id)}
                  placeholder="Hours"
                  min="0"
                  step="0.5"
                  className="preparation-hours-input"
                  data-testid={`preparation-hours-input-${event.id}`}
                />
                
                <div className="event-buttons">
                  <button
                    type="button"
                    onClick={() => handleDismiss(event.id)}
                    className="button-secondary"
                    title="Remind me later"
                    data-testid={`preparation-remind-later-${event.id}`}
                  >
                    <FontAwesomeIcon icon={faClock} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, event.id)}
                    className="button-primary"
                    title="Save hours"
                    data-testid={`save-button-${event.id}`}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </button>
                </div>
                
                {errors[event.id] && (
                  <p className="error-message" data-testid={`error-message-${event.id}`}>
                    {errors[event.id]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreparationPrompt;
