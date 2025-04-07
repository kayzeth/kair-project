import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrashAlt, faClock, faAlignLeft, faBookOpen, faChevronDown, faMinus, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import '../styles/EventModal.css';

const EventModal = ({ onClose, onSave, onDelete, onTriggerStudySuggestions, event, selectedDate = new Date() }) => {
  // Create a ref for the title input to auto-focus it
  const titleInputRef = useRef(null);
  
  // Available color options
  const colorOptions = [
    '#e63946',
    '#ff6f61',
    '#ff8c42',
    '#d1495b',
    '#d2b48c',
    '#457b9d',
    '#2a9d8f',
    '#6a4c93',
    '#3a86ff',
    '#5e60ce'
  ];
  
  // State to track if color dropdown is open
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  
  // Ref for the color dropdown to handle outside clicks
  const colorDropdownRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    start: format(selectedDate, 'yyyy-MM-dd'),
    end: format(selectedDate, 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    color: '#d2b48c',
    requiresPreparation: false,
    preparationHours: ''
  });

  // Effect to auto-focus the title input when the modal opens
  useEffect(() => {
    // Focus the title input after a short delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, []); // Empty dependency array ensures this only runs once when the modal mounts
  
  // Effect to handle clicking outside the color dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target)) {
        setColorDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (event) {
      // For Date objects, use proper formatting
      let startDate, endDate, startTime, endTime;
      
      if (event.start instanceof Date) {
        // Store the original date objects to preserve exact timestamps
        startDate = format(event.start, 'yyyy-MM-dd');
        startTime = format(event.start, 'HH:mm');
      } else if (typeof event.start === 'string') {
        // If it's a string (like from the database), parse it carefully
        const startDateTime = new Date(event.start);
        startDate = format(startDateTime, 'yyyy-MM-dd');
        startTime = format(startDateTime, 'HH:mm');
      } else {
        startDate = format(new Date(), 'yyyy-MM-dd');
        startTime = '09:00';
      }
      
      if (event.end instanceof Date) {
        endDate = format(event.end, 'yyyy-MM-dd');
        endTime = format(event.end, 'HH:mm');
      } else if (typeof event.end === 'string') {
        const endDateTime = new Date(event.end);
        endDate = format(endDateTime, 'yyyy-MM-dd');
        endTime = format(endDateTime, 'HH:mm');
      } else {
        endDate = format(new Date(), 'yyyy-MM-dd');
        endTime = '10:00';
      }
      
      // Use startTime and endTime from the event object if they exist
      if (event.startTime) {
        startTime = event.startTime;
      }
      
      if (event.endTime) {
        endTime = event.endTime;
      }

      setFormData({
        title: event.title || '',
        description: event.description || '',
        location: event.location || '',
        start: startDate,
        end: endDate,
        startTime: startTime,
        endTime: endTime,
        allDay: event.allDay || false,
        color: event.color || '#d2b48c',
        requiresPreparation: event.requiresPreparation || false,
        // Handle 0 as a valid value for preparationHours
        preparationHours: event.preparationHours !== undefined ? event.preparationHours : ''
      });
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prevData => ({
        ...prevData,
        [name]: checked
      }));
    } else {
      setFormData(prevData => ({
        ...prevData,
        [name]: value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Event title is required');
      return;
    }
    
    // Start with a base object that preserves the original event properties
    const eventObject = {
      id: event ? event.id : null,
      title: formData.title,
      description: formData.description,
      location: formData.location,
      allDay: formData.allDay,
      color: formData.color,
      requiresPreparation: formData.requiresPreparation,
      // Only include preparationHours if it's actually entered by the user
      // This ensures empty values remain empty and don't get converted to 0
      preparationHours: formData.requiresPreparation ? 
        (formData.preparationHours === '' ? '' : formData.preparationHours) : 
        ''
    };
    
    // Check if we're only toggling the preparation checkbox without changing dates/times
    let isJustTogglingPreparation = false;
    
    if (event) {
      // Get the original date and time strings for comparison
      const originalStartDate = format(new Date(event.start), 'yyyy-MM-dd');
      const originalEndDate = format(new Date(event.end), 'yyyy-MM-dd');
      
      // Get original times, handling different formats
      let originalStartTime, originalEndTime;
      
      if (event.startTime) {
        originalStartTime = event.startTime;
      } else if (event.start instanceof Date) {
        originalStartTime = format(event.start, 'HH:mm');
      } else if (typeof event.start === 'string') {
        const startDate = new Date(event.start);
        originalStartTime = format(startDate, 'HH:mm');
      }
      
      if (event.endTime) {
        originalEndTime = event.endTime;
      } else if (event.end instanceof Date) {
        originalEndTime = format(event.end, 'HH:mm');
      } else if (typeof event.end === 'string') {
        const endDate = new Date(event.end);
        originalEndTime = format(endDate, 'HH:mm');
      }
      
      console.log('Time comparison:', {
        formStartTime: formData.startTime,
        originalStartTime,
        formEndTime: formData.endTime,
        originalEndTime,
        formStart: formData.start,
        originalStartDate,
        formEnd: formData.end,
        originalEndDate
      });
      
      // Only consider it "just toggling preparation" if ALL date and time values are unchanged
      isJustTogglingPreparation = 
        formData.start === originalStartDate &&
        formData.end === originalEndDate &&
        formData.startTime === originalStartTime &&
        formData.endTime === originalEndTime;
    }
    
    console.log('Is just toggling preparation:', isJustTogglingPreparation);
    
    if (isJustTogglingPreparation) {
      console.log('Just toggling preparation - preserving original timestamps');
      eventObject.start = event.start;
      eventObject.end = event.end;
      
      // Preserve time strings if they exist
      if (event.startTime) eventObject.startTime = event.startTime;
      if (event.endTime) eventObject.endTime = event.endTime;
    } else {
      // Handle date changes normally
      if (formData.allDay) {
        // For all-day events, create date objects with timezone offset preserved
        const [year, month, day] = formData.start.split('-').map(Number);
        // Create date using local time to avoid timezone shifts
        const startDate = new Date(year, month - 1, day, 0, 0, 0);
        
        const [endYear, endMonth, endDay] = formData.end.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
        
        eventObject.start = startDate;
        eventObject.end = endDate;
      } else {
        // For time-specific events, combine date and time with timezone preservation
        const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
        const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
        
        // Parse date components to avoid timezone issues
        const [startYear, startMonth, startDay] = formData.start.split('-').map(Number);
        
        // Create date using local time components
        // This ensures the time shown to the user is exactly what they selected
        const startDate = new Date(startYear, startMonth - 1, startDay, startHours, startMinutes, 0);
        
        const [endYear, endMonth, endDay] = formData.end.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes, 0);
        
        eventObject.start = startDate;
        eventObject.end = endDate;
        eventObject.startTime = formData.startTime;
        eventObject.endTime = formData.endTime;
      }
    }
    
    console.log('Submitting event with dates:', {
      start: eventObject.start,
      startISOString: eventObject.start instanceof Date ? eventObject.start.toISOString() : null,
      startLocalString: eventObject.start instanceof Date ? eventObject.start.toString() : null,
      startTime: formData.startTime,
      end: eventObject.end,
      isJustTogglingPreparation,
      formStartDate: formData.start
    });
    
    onSave(eventObject);
    onClose();
  };

  const handleDelete = () => {
    if (event && event.id) {
      onDelete(event.id);
    }
  };

  const handleTriggerStudySuggestions = async () => {
    if (event && event.id) {
      try {
        // First, save the current form data to update the event in the database
        // Create a new event object with the current form data
        const updatedEvent = {
          ...event,
          title: formData.title,
          description: formData.description,
          location: formData.location,
          start: formData.allDay 
            ? new Date(`${formData.start}T00:00:00`) 
            : new Date(`${formData.start}T${formData.startTime}`),
          end: formData.allDay 
            ? new Date(`${formData.end}T23:59:59`) 
            : new Date(`${formData.end}T${formData.endTime}`),
          allDay: formData.allDay,
          color: formData.color,
          requiresPreparation: formData.requiresPreparation,
          preparationHours: formData.preparationHours
        };
        
        // Save the updated event to the database
        console.log('Saving event before generating study plan:', updatedEvent);
        await onSave(updatedEvent);
        
        // Then generate study suggestions using the updated event
        onTriggerStudySuggestions(updatedEvent);
        onClose();
      } catch (error) {
        console.error('Error saving event before generating study plan:', error);
        // Still try to generate study suggestions with the form data
        const tempEvent = {
          ...event,
          title: formData.title,
          description: formData.description,
          location: formData.location,
          start: formData.allDay 
            ? new Date(`${formData.start}T00:00:00`) 
            : new Date(`${formData.start}T${formData.startTime}`),
          end: formData.allDay 
            ? new Date(`${formData.end}T23:59:59`) 
            : new Date(`${formData.end}T${formData.endTime}`),
          allDay: formData.allDay,
          color: formData.color,
          requiresPreparation: formData.requiresPreparation,
          preparationHours: formData.preparationHours
        };
        onTriggerStudySuggestions(tempEvent);
        onClose();
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <button className="close-button" data-testid="eventmodal-close-button" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <input
                type="text"
                id="title"
                name="title"
                className="form-input title-input"
                data-testid="eventmodal-title-input"
                value={formData.title}
                onChange={handleChange}
                placeholder="Add title"
                required
                ref={titleInputRef}
              />
            </div>
            <div className="form-group form-group-flex">
              <div className="form-icon">
                <FontAwesomeIcon icon={faClock} />
              </div>
              <div className="date-time-container">
                <div className="date-time-row">
                <input
                  type="date"
                  id="start"
                  name="start"
                  className="form-input date-input"
                  data-testid="eventmodal-start-date"
                  value={formData.start}
                  onChange={handleChange}
                  required
                  aria-label="Start"
                />
                  {!formData.allDay && (
                    <input
                      type="time"
                      id="startTime"
                      name="startTime"
                      className="form-input"
                      data-testid="eventmodal-start-time"
                      value={formData.startTime}
                      onChange={handleChange}
                      required
                      aria-label="Start time"
                    />
                  )}
                <FontAwesomeIcon icon={faMinus} />
                  <input
                    type="date"
                    id="end"
                    name="end"
                    className="form-input date-input"
                    data-testid="eventmodal-end-date"
                    value={formData.end}
                    onChange={handleChange}
                    required
                    aria-label="End"
                  />
                  {!formData.allDay && (
                    <input
                      type="time"
                      id="endTime"
                      name="endTime"
                      className="form-input"
                      data-testid="eventmodal-end-time"
                      value={formData.endTime}
                      onChange={handleChange}
                      required
                      aria-label="End time"
                    />
                  )}
                </div>
                <div className="checkbox-label">
                  <input
                    type="checkbox"
                    name="allDay"
                    className="checkbox-input"
                    data-testid="eventmodal-all-day"
                    checked={formData.allDay}
                    onChange={handleChange}
                  />
                  All day
                </div>
              </div>
            </div>
            <div className="form-group form-group-flex">
              <div className="form-icon">
                <FontAwesomeIcon icon={faMapMarkerAlt} />
              </div>
              <input
                type="text"
                id="location"
                name="location"
                className="form-input location-input"
                data-testid="eventmodal-location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Add location"
              />
            </div>
            <div className="form-group form-group-flex">
              <div className="form-icon">
                <FontAwesomeIcon icon={faAlignLeft} />
              </div>
              <textarea
                id="description"
                name="description"
                className="form-input description-input"
                data-testid="eventmodal-description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Add description"
              />
            </div>
            
            <div className="form-group form-group-flex-center">
              <label className="form-label">Color:</label>
              <div className="color-picker-container" ref={colorDropdownRef}>
                <div className="selected-color-container" onClick={() => setColorDropdownOpen(!colorDropdownOpen)}>
                  <div 
                    className="selected-color"
                    data-testid="eventmodal-color"
                    style={{ backgroundColor: formData.color }}
                  ></div>
                  <FontAwesomeIcon 
                    icon={faChevronDown} 
                    className="color-dropdown-icon"
                  />
                </div>
                {colorDropdownOpen && (
                  <div className="color-dropdown">
                    {colorOptions.map((color, index) => (
                      <div 
                        key={index}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            color: color
                          });
                          setColorDropdownOpen(false);
                        }}
                        className={`color-option ${formData.color === color ? 'color-option-selected' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* [KAIR-16] Add Requires Preparation checkbox and hours input */}
            <div className="form-group form-group-flex-center">
              <div className="form-icon">
                <FontAwesomeIcon icon={faBookOpen} />
              </div>
              <div className="date-time-container">
                <div className="checkbox-label">
                  <input
                    type="checkbox"
                    name="requiresPreparation"
                    className="checkbox-input"
                    checked={formData.requiresPreparation}
                    onChange={handleChange}
                    data-testid="eventmodal-requires-preparation"
                  />
                  Requires Preparation
                </div>
                
                {formData.requiresPreparation && (
                  <div className="date-time-row">
                    <label htmlFor="preparationHours" className="form-label">
                      Preparation Hours:
                    </label>
                    <input
                      type="number"
                      id="preparationHours"
                      name="preparationHours"
                      className="form-input preparation-hours-input"
                      value={formData.preparationHours}
                      onChange={handleChange}
                      placeholder="Enter hours"
                      min="0"
                      step="0.5"
                      data-testid="eventmodal-preparation-hours"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {event && (
              <button 
                type="button" 
                className="button button-danger button-left"
                data-testid="eventmodal-delete-button" 
                onClick={handleDelete}
              >
                <FontAwesomeIcon icon={faTrashAlt} className="button-icon" />
                Delete
              </button>
            )}
            {event && formData.requiresPreparation && (formData.preparationHours !== undefined && formData.preparationHours !== null && formData.preparationHours !== '') && (
              <button 
                type="button" 
                className="button button-secondary button-right"
                data-testid="eventmodal-trigger-study-suggestions-button" 
                onClick={handleTriggerStudySuggestions}
              >
                <FontAwesomeIcon icon={faBookOpen} className="button-icon" />
                Generate Study Plan
              </button>
            )}
            <button 
              type="button" 
              className="button button-secondary button-right"
              data-testid="eventmodal-cancel-button" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="button button-primary button-right"
              data-testid="eventmodal-save-button"
            >
              {event ? 'Save' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
