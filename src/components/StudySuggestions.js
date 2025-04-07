import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBook, faCheck, faClock, faCalendarPlus } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import './StudySuggestions.css';

/**
 * Component that displays study session suggestions to the user
 * [KAIR-35, KAIR-41] This component shows smart study suggestions based on preparation hours
 */
const StudySuggestions = ({ suggestions, onAccept, onReject, onClose }) => {
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);

  // Extract parent event information from the first suggestion
  // All suggestions should be for the same event
  const parentEvent = suggestions && suggestions.length > 0 ? suggestions[0].event : null;

  const toggleSuggestion = (suggestionId) => {
    setSelectedSuggestions(prev => {
      if (prev.includes(suggestionId)) {
        return prev.filter(id => id !== suggestionId);
      } else {
        return [...prev, suggestionId];
      }
    });
  };

  const handleAcceptAll = () => {
    onAccept(suggestions);
    onClose();
  };

  const handleAcceptSelected = () => {
    const selected = suggestions.filter(suggestion => 
      selectedSuggestions.includes(suggestion.suggestedStartTime.getTime())
    );
    onAccept(selected);
    onClose();
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  // Group suggestions by day - CRITICAL FIX for timezone issues
  const suggestionsByDay = suggestions.reduce((acc, suggestion) => {
    // Ensure we're working with a proper Date object
    const suggestedStartTime = suggestion.suggestedStartTime instanceof Date 
      ? new Date(suggestion.suggestedStartTime) 
      : new Date(suggestion.suggestedStartTime);
    
    // Format the date for grouping - use UTC methods to avoid timezone issues
    const year = suggestedStartTime.getFullYear();
    const month = String(suggestedStartTime.getMonth() + 1).padStart(2, '0');
    const day = String(suggestedStartTime.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    
    acc[dateKey].push({
      ...suggestion,
      // Ensure we always have Date objects
      suggestedStartTime: suggestedStartTime,
      suggestedEndTime: suggestion.suggestedEndTime instanceof Date 
        ? new Date(suggestion.suggestedEndTime) 
        : new Date(suggestion.suggestedEndTime)
    });
    
    return acc;
  }, {});

  // Sort suggestions within each day by start time
  Object.keys(suggestionsByDay).forEach(day => {
    suggestionsByDay[day].sort((a, b) => 
      a.suggestedStartTime.getTime() - b.suggestedStartTime.getTime()
    );
  });

  // Sort days chronologically
  const sortedDays = Object.keys(suggestionsByDay).sort();

  // If no suggestions, don't render anything
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="study-suggestions-container" data-testid="study-suggestions-container">
      <div className="study-suggestions" data-testid="study-suggestions">
        <button 
          className="close-button" 
          onClick={onClose}
          aria-label="Close"
          data-testid="suggestions-close-button"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
        
        <div className="suggestions-header">
          <FontAwesomeIcon icon={faBook} className="suggestions-icon" />
          <h3 data-testid="suggestions-title">Smart Study Plan</h3>
        </div>
        
        {parentEvent && (
          <div className="parent-event-info" data-testid="parent-event-info">
            <h4>Study Plan for: <span className="event-title">{parentEvent.title}</span></h4>
            <p className="event-details">
              <FontAwesomeIcon icon={faClock} className="event-icon" />
              {format(new Date(parentEvent.start), 'EEEE, MMMM d')} at {format(new Date(parentEvent.start), 'h:mm a')}
              {parentEvent.location && (
                <span className="event-location"> • {parentEvent.location}</span>
              )}
            </p>
            <p className="preparation-details">
              <strong>{parentEvent.preparationHours}</strong> hour{parentEvent.preparationHours !== 1 ? 's' : ''} of preparation required
            </p>
          </div>
        )}
        
        <p className="suggestions-instruction" data-testid="suggestions-instruction">
          Based on your preparation needs, we've created a personalized study plan:
        </p>
        
        <div className="suggestions-list">
          {sortedDays.map((day, dayIndex) => {
            const daySuggestions = suggestionsByDay[day];
            return (
              <div key={day} className="day-group">
                <h4 className="day-header">
                  {/* Use the actual date from the first suggestion in this group */}
                  {format(daySuggestions[0].suggestedStartTime, 'EEEE, MMMM d')}
                </h4>
                
                {daySuggestions.map(suggestion => {
                  const suggestionId = suggestion.suggestedStartTime.getTime();
                  const isSelected = selectedSuggestions.includes(suggestionId);
                  
                  return (
                    <div 
                      key={suggestionId} 
                      className={`suggestion-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSuggestion(suggestionId)}
                      data-testid={`suggestion-item-${suggestionId}`}
                    >
                      <div className="suggestion-checkbox">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation(); // Stop event propagation
                            toggleSuggestion(suggestionId);
                          }}
                          data-testid={`suggestion-checkbox-${suggestionId}`}
                        />
                      </div>
                      
                      <div className="suggestion-details">
                        <div className="suggestion-time">
                          <FontAwesomeIcon icon={faClock} />
                          <span data-testid={`suggestion-time-${suggestionId}`}>
                            {format(suggestion.suggestedStartTime, 'h:mm a')} - {format(suggestion.suggestedEndTime, 'h:mm a')}
                          </span>
                        </div>
                        
                        <p className="suggestion-message" data-testid={`suggestion-message-${suggestionId}`}>
                          {suggestion.message}
                        </p>
                        
                        {suggestion.totalSessions > 1 && (
                          <p className="suggestion-session-info" data-testid={`suggestion-session-info-${suggestionId}`}>
                            Session {suggestion.sessionNumber} of {suggestion.totalSessions}
                          </p>
                        )}
                        
                        <div className={`suggestion-priority ${suggestion.priority}`} data-testid={`suggestion-priority-${suggestionId}`}>
                          {suggestion.priority.charAt(0).toUpperCase() + suggestion.priority.slice(1)} priority
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        
        <div className="suggestions-actions">
          <button 
            className="button-secondary"
            onClick={handleReject}
            data-testid="reject-suggestions-button"
          >
            No Thanks
          </button>
          
          <button 
            className="button-primary"
            onClick={handleAcceptSelected}
            disabled={selectedSuggestions.length === 0}
            data-testid="accept-selected-button"
          >
            <FontAwesomeIcon icon={faCalendarPlus} />
            Add Selected ({selectedSuggestions.length})
          </button>
          
          <button 
            className="button-primary"
            onClick={handleAcceptAll}
            data-testid="accept-all-button"
          >
            <FontAwesomeIcon icon={faCheck} />
            Add All
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudySuggestions;
