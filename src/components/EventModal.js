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
        startDate = format(event.start, 'yyyy-MM-dd');
        startTime = format(event.start, 'HH:mm');
      } else if (typeof event.start === 'string') {
        startDate = event.start.split('T')[0];
        startTime = event.start.includes('T') ? event.start.split('T')[1].substring(0, 5) : '09:00';
      } else {
        startDate = format(new Date(), 'yyyy-MM-dd');
        startTime = '09:00';
      }
      
      if (event.end instanceof Date) {
        endDate = format(event.end, 'yyyy-MM-dd');
        endTime = format(event.end, 'HH:mm');
      } else if (typeof event.end === 'string') {
        endDate = event.end.split('T')[0];
        endTime = event.end.includes('T') ? event.end.split('T')[1].substring(0, 5) : '10:00';
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
        preparationHours: event.preparationHours || ''
      });
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log('Form data before submission:', formData);
    
    // Validate required fields
    if (!formData.title.trim()) {
      console.log('Title is required');
      return; // Stop submission if title is empty
    }
    
    // Format dates properly for submission
    let startDateTime, endDateTime;
    
    if (formData.allDay) {
      // For all-day events, use the date without time
      startDateTime = new Date(formData.start);
      startDateTime.setHours(0, 0, 0, 0);
      
      endDateTime = new Date(formData.end);
      endDateTime.setHours(23, 59, 59, 999);
    } else {
      // For time-specific events, combine date and time
      const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
      const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
      
      startDateTime = new Date(formData.start);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      endDateTime = new Date(formData.end);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
    }
    
    // Prepare the event data for saving
    const eventData = {
      ...formData,
      // If this is an existing event, include its ID
      ...(event && { id: event.id }),
      // Replace string dates with Date objects
      start: startDateTime,
      end: endDateTime,
      // Remove startTime and endTime as they're now incorporated into start and end
      startTime: undefined,
      endTime: undefined
    };
    
    console.log('Formatted event data for submission:', eventData);
    
    onSave(eventData);
  };

  const handleDelete = () => {
    if (event && event.id) {
      onDelete(event.id);
    }
  };

  const handleTriggerStudySuggestions = () => {
    if (event && event.id) {
      onTriggerStudySuggestions(event);
      onClose();
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
            {event && event.requiresPreparation && event.preparationHours && (
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
