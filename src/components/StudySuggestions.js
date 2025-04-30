import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBook, faCheck, faClock, faCalendarPlus, faEdit, faExclamationTriangle, faCheckCircle, faSave, faTimes as faCancel } from '@fortawesome/free-solid-svg-icons';
import { format, isValid, parseISO, parse, set } from 'date-fns';
import eventService from '../services/eventService';
import './StudySuggestions.css';
import '../styles/Calendar.css'; // Import for sync-banner styling

/**
 * Component that displays study session suggestions to the user
 * [KAIR-35, KAIR-41] This component shows smart study suggestions based on preparation hours
 */
const StudySuggestions = ({ suggestions, onAccept, onReject, onClose, userId }) => {
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [editedSuggestions, setEditedSuggestions] = useState({});
  const [conflicts, setConflicts] = useState({});
  const [allEvents, setAllEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Extract parent event information from the first suggestion
  // All suggestions should be for the same event
  const parentEvent = suggestions && suggestions.length > 0 ? suggestions[0].event : null;
  
  // Fetch all events to check for conflicts
  useEffect(() => {
    const fetchEvents = async () => {
      // Use parentEvent.userId or the passed userId prop
      const userIdToUse = parentEvent?.userId || userId;
      
      if (userIdToUse) {
        setIsLoading(true);
        try {
          const events = await eventService.getUserEvents(userIdToUse);
          // Filter out the parent event and its study sessions
          const filteredEvents = events.filter(event => {
            if (parentEvent && event.id === parentEvent.id) return false;
            if (parentEvent && event.isStudySession && event.relatedEventId === parentEvent.id) return false;
            return true;
          });
          
          setAllEvents(filteredEvents);
          
          // Check for conflicts with original suggestions
          const initialConflicts = {};
          suggestions.forEach(suggestion => {
            const suggestionId = suggestion.suggestedStartTime.getTime();
            initialConflicts[suggestionId] = checkForConflicts(suggestion.suggestedStartTime, suggestion.suggestedEndTime, filteredEvents);
          });
          setConflicts(initialConflicts);
        } catch (error) {
          console.error('Error fetching events for conflict detection:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentEvent, userId]);

  // Check for conflicts with existing events
  const checkForConflicts = (startTime, endTime, eventsToCheck = allEvents) => {
    const conflictingEvents = eventsToCheck.filter(event => {
      // Skip the parent event itself
      if (parentEvent && event.id === parentEvent.id) return false;
      
      // Skip study sessions related to this event
      if (event.isStudySession && event.relatedEventId === parentEvent.id) return false;
      
      // Skip all-day events in the hour-by-hour verification
      if (event.allDay === true) return false;
      
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Check for overlap
      return (startTime < eventEnd && endTime > eventStart);
    });
    
    return conflictingEvents.length > 0 ? conflictingEvents : null;
  };
  
  const toggleSuggestion = (suggestionId) => {
    setSelectedSuggestions(prev => {
      if (prev.includes(suggestionId)) {
        return prev.filter(id => id !== suggestionId);
      } else {
        return [...prev, suggestionId];
      }
    });
  };
  
  const startEditing = (suggestion) => {
    const suggestionId = suggestion.suggestedStartTime.getTime();
    setEditingSuggestion(suggestionId);
    
    // Initialize edited values with current values
    setEditedSuggestions(prev => ({
      ...prev,
      [suggestionId]: {
        date: format(suggestion.suggestedStartTime, 'yyyy-MM-dd'),
        startTime: format(suggestion.suggestedStartTime, 'HH:mm'),
        endTime: format(suggestion.suggestedEndTime, 'HH:mm')
      }
    }));
  };
  
  const cancelEditing = () => {
    setEditingSuggestion(null);
  };
  
  const handleEditChange = (suggestionId, field, value) => {
    setEditedSuggestions(prev => ({
      ...prev,
      [suggestionId]: {
        ...prev[suggestionId],
        [field]: value
      }
    }));
    
    // Check for conflicts when values change
    if (editedSuggestions[suggestionId]) {
      // Get the updated values
      const updatedValues = {
        ...editedSuggestions[suggestionId],
        [field]: value
      };
      
      try {
        // Parse the date and times
        const dateObj = parse(updatedValues.date, 'yyyy-MM-dd', new Date());
        const startTimeObj = parse(updatedValues.startTime, 'HH:mm', new Date());
        const endTimeObj = parse(updatedValues.endTime, 'HH:mm', new Date());
        
        if (isValid(dateObj) && isValid(startTimeObj) && isValid(endTimeObj)) {
          // Create start and end date objects
          const startDateTime = set(dateObj, {
            hours: startTimeObj.getHours(),
            minutes: startTimeObj.getMinutes(),
            seconds: 0,
            milliseconds: 0
          });
          
          const endDateTime = set(dateObj, {
            hours: endTimeObj.getHours(),
            minutes: endTimeObj.getMinutes(),
            seconds: 0,
            milliseconds: 0
          });
          
          // Check for conflicts
          const hasConflicts = checkForConflicts(startDateTime, endDateTime);
          setConflicts(prev => ({
            ...prev,
            [suggestionId]: hasConflicts
          }));
        }
      } catch (error) {
        console.error('Error checking for conflicts:', error);
      }
      const { date, startTime, endTime } = {
        ...editedSuggestions[suggestionId],
        [field]: value
      };
      
      try {
        const startDateTime = parseISO(`${date}T${startTime}`);
        const endDateTime = parseISO(`${date}T${endTime}`);
        
        if (isValid(startDateTime) && isValid(endDateTime)) {
          const conflictingEvents = checkForConflicts(startDateTime, endDateTime);
          setConflicts(prev => ({
            ...prev,
            [suggestionId]: conflictingEvents
          }));
        }
      } catch (error) {
        console.error('Error checking for conflicts:', error);
      }
    }
  };
  
  const saveEdit = (suggestion) => {
    const suggestionId = suggestion.suggestedStartTime.getTime();
    const editedData = editedSuggestions[suggestionId];
    
    if (!editedData) {
      cancelEditing();
      return;
    }
    
    try {
      // Parse the date and times
      const dateObj = parse(editedData.date, 'yyyy-MM-dd', new Date());
      const [startHours, startMinutes] = editedData.startTime.split(':').map(Number);
      const [endHours, endMinutes] = editedData.endTime.split(':').map(Number);
      
      if (!isValid(dateObj)) {
        alert('Invalid date format');
        return;
      }
      
      // Create new Date objects for start and end times
      const newStartTime = new Date(dateObj);
      newStartTime.setHours(startHours, startMinutes, 0, 0);
      
      const newEndTime = new Date(dateObj);
      newEndTime.setHours(endHours, endMinutes, 0, 0);
      
      // Check if end time is before start time
      if (newEndTime <= newStartTime) {
        alert('End time must be after start time');
        return;
      }
      
      // Check for conflicts
      const hasConflicts = checkForConflicts(newStartTime, newEndTime);
      
      // Create a new suggestion ID for the modified suggestion
      const newSuggestionId = newStartTime.getTime();
      
      // Update conflicts state
      setConflicts(prev => ({
        ...prev,
        [newSuggestionId]: hasConflicts
      }));
      
      // Create a modified suggestion with the new times
      const modifiedSuggestion = {
        ...suggestion,
        suggestedStartTime: newStartTime,
        suggestedEndTime: newEndTime
      };
      
      // If the suggestion was selected, update the selected suggestions array
      if (selectedSuggestions.includes(suggestionId)) {
        setSelectedSuggestions(prev => [
          ...prev.filter(id => id !== suggestionId),
          newSuggestionId
        ]);
      }
      
      // Update the suggestions array in-place by finding the original suggestion
      // and replacing it with the modified one
      const suggestionIndex = suggestions.findIndex(s => 
        s.suggestedStartTime.getTime() === suggestionId
      );
      
      if (suggestionIndex !== -1) {
        suggestions[suggestionIndex] = modifiedSuggestion;
      }
      
      // Clear editing state
      setEditingSuggestion(null);
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Error updating suggestion. Please try again.');
    }
  };

  const handleAcceptAll = () => {
    // Check if any suggestions have conflicts
    const hasConflicts = suggestions.some(suggestion => {
      const suggestionId = suggestion.suggestedStartTime.getTime();
      return conflicts[suggestionId];
    });
    
    if (hasConflicts) {
      const confirmAdd = window.confirm('Some suggestions have conflicts with existing events. Do you still want to add them?');
      if (!confirmAdd) return;
    }
    
    // Pass all suggestions to the parent component
    onAccept(suggestions);
    onClose();
  };

  const handleAcceptSelected = () => {
    // Get the currently selected suggestions based on their IDs
    const selected = suggestions.filter(suggestion => 
      selectedSuggestions.includes(suggestion.suggestedStartTime.getTime())
    );
    
    if (selected.length === 0) {
      alert('Please select at least one suggestion to add.');
      return;
    }
    
    // Check if any selected suggestions have conflicts
    const hasConflicts = selected.some(suggestion => {
      const suggestionId = suggestion.suggestedStartTime.getTime();
      return conflicts[suggestionId];
    });
    
    if (hasConflicts) {
      const confirmAdd = window.confirm('Some selected suggestions have conflicts with existing events. Do you still want to add them?');
      if (!confirmAdd) return;
    }
    
    // Pass only the selected suggestions to the parent component
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
    
    // Skip invalid dates
    if (!isValid(suggestedStartTime)) {
      console.error('Invalid start time found in suggestion:', suggestion);
      return acc;
    }
    
    // Format the date for grouping - use UTC methods to avoid timezone issues
    const year = suggestedStartTime.getFullYear();
    const month = String(suggestedStartTime.getMonth() + 1).padStart(2, '0');
    const day = String(suggestedStartTime.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    
    const suggestedEndTime = suggestion.suggestedEndTime instanceof Date 
      ? new Date(suggestion.suggestedEndTime) 
      : new Date(suggestion.suggestedEndTime);
    
    // Skip invalid end times
    if (!isValid(suggestedEndTime)) {
      console.error('Invalid end time found in suggestion:', suggestion);
      return acc;
    }
    
    acc[dateKey].push({
      ...suggestion,
      // Ensure we always have Date objects
      suggestedStartTime: suggestedStartTime,
      suggestedEndTime: suggestedEndTime
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
    <>
      {isLoading && (
        <div className="sync-banner sync-loading" data-testid="study-suggestions-loading">
          Generating study suggestions...
        </div>
      )}
      <div className="study-suggestions-container" data-testid="study-suggestions-container">
      {isLoading ? (
        <div className="loading-indicator">Loading calendar events...</div>
      ) : (
        <>
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
                  {isValid(new Date(parentEvent.start)) 
                    ? `${format(new Date(parentEvent.start), 'EEEE, MMMM d')} at ${format(new Date(parentEvent.start), 'h:mm a')}`
                    : 'Date not available'}
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
                      {isValid(daySuggestions[0].suggestedStartTime) 
                        ? format(daySuggestions[0].suggestedStartTime, 'EEEE, MMMM d')
                        : 'Date not available'}
                    </h4>
                    
                    {daySuggestions.map(suggestion => {
                      const suggestionId = suggestion.suggestedStartTime.getTime();
                      const isSelected = selectedSuggestions.includes(suggestionId);
                      
                      return (
                        <div 
                          key={suggestionId} 
                          className={`suggestion-item ${isSelected ? 'selected' : ''} ${editingSuggestion === suggestionId ? 'editing' : ''} ${conflicts[suggestionId] ? 'has-conflict' : ''}`}
                          onClick={() => !editingSuggestion && toggleSuggestion(suggestionId)}
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
                              disabled={editingSuggestion === suggestionId}
                              data-testid={`suggestion-checkbox-${suggestionId}`}
                            />
                          </div>
                          
                          <div className="suggestion-details">
                            {editingSuggestion === suggestionId ? (
                          <div className="suggestion-edit-form">
                            <div className="edit-form-row">
                              <label htmlFor={`date-${suggestionId}`}>Date:</label>
                              <input 
                                id={`date-${suggestionId}`}
                                type="date" 
                                value={editedSuggestions[suggestionId]?.date || ''}
                                onChange={(e) => handleEditChange(suggestionId, 'date', e.target.value)}
                              />
                            </div>
                            <div className="edit-form-row">
                              <label htmlFor={`start-time-${suggestionId}`}>Start Time:</label>
                              <input 
                                id={`start-time-${suggestionId}`}
                                type="time" 
                                value={editedSuggestions[suggestionId]?.startTime || ''}
                                onChange={(e) => handleEditChange(suggestionId, 'startTime', e.target.value)}
                              />
                            </div>
                            <div className="edit-form-row">
                              <label htmlFor={`end-time-${suggestionId}`}>End Time:</label>
                              <input 
                                id={`end-time-${suggestionId}`}
                                type="time" 
                                value={editedSuggestions[suggestionId]?.endTime || ''}
                                onChange={(e) => handleEditChange(suggestionId, 'endTime', e.target.value)}
                              />
                            </div>
                            
                            {conflicts[suggestionId] ? (
                              <div className="conflict-warning">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="conflict-icon" />
                                <span>Conflicts with {conflicts[suggestionId].length} existing event(s)</span>
                              </div>
                            ) : (
                              <div className="no-conflict">
                                <FontAwesomeIcon icon={faCheckCircle} className="no-conflict-icon" />
                                <span>No conflicts</span>
                              </div>
                            )}
                            
                            <div className="edit-form-actions">
                              <button 
                                className="save-button"
                                onClick={() => saveEdit(suggestion)}
                                disabled={conflicts[suggestionId]}
                              >
                                <FontAwesomeIcon icon={faSave} /> Save
                              </button>
                              <button 
                                className="cancel-button"
                                onClick={cancelEditing}
                              >
                                <FontAwesomeIcon icon={faCancel} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="suggestion-time">
                              <div>
                                <FontAwesomeIcon icon={faClock} />
                                <span data-testid={`suggestion-time-${suggestionId}`}>
                                  {isValid(suggestion.suggestedStartTime) && isValid(suggestion.suggestedEndTime) 
                                    ? `${format(suggestion.suggestedStartTime, 'h:mm a')} - ${format(suggestion.suggestedEndTime, 'h:mm a')}`
                                    : 'Time not available'}
                                </span>
                              </div>
                              <button 
                                className="edit-button" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(suggestion);
                                }}
                                title="Edit this suggestion"
                              >
                                <FontAwesomeIcon icon={faEdit} />
                              </button>
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
                            
                            <div className="conflict-status">
                              {conflicts[suggestionId] ? (
                                <div className="conflict-warning">
                                  <FontAwesomeIcon icon={faExclamationTriangle} className="conflict-icon" />
                                  <span>Conflicts with {conflicts[suggestionId].length} existing event(s)</span>
                                </div>
                              ) : (
                                <div className="no-conflict">
                                  <FontAwesomeIcon icon={faCheckCircle} className="no-conflict-icon" />
                                  <span>No conflicts</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
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
      </>
      )}
    </div>
    </>
  );
};

export default StudySuggestions;
