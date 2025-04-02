import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrashAlt, faClock, faMapMarkerAlt, faAlignLeft, faBookOpen } from '@fortawesome/free-solid-svg-icons';

const EventModal = ({ onClose, onSave, onDelete, onTriggerStudySuggestions, event, selectedDate = new Date() }) => {
  // Create a ref for the title input to auto-focus it
  const titleInputRef = useRef(null);
  
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
    
    // For preparation hours, ensure it's a positive number or empty
    if (name === 'preparationHours') {
      // Allow empty string or positive numbers
      if (value === '' || (Number(value) >= 0 && !isNaN(Number(value)))) {
        setFormData({
          ...formData,
          [name]: value
        });
      }
      return;
    }
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Manually check if required fields are empty
    if (!formData.title.trim()) {
      return; // Stop submission if title is empty
    }
  
    onSave({
      ...formData,
      id: event ? event.id : undefined
    });
  };

  const handleDelete = () => {
    if (event && event.id) {
      console.log('Deleting event from modal:', event);
      onDelete(event.id);
    }
  };

  const handleTriggerStudySuggestions = () => {
    if (event && event.id) {
      onClose(); // Close the modal first
      setTimeout(() => {
        onTriggerStudySuggestions(event); // Then trigger study suggestions
      }, 300);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" data-testid="eventmodal-close-button" onClick={onClose}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <input
                type="text"
                id="title"
                name="title"
                className="form-input"
                data-testid="eventmodal-title-input"
                value={formData.title}
                onChange={handleChange}
                placeholder="Add title"
                required
                ref={titleInputRef}
                style={{ fontSize: '22px', fontWeight: '400', height: '50px', border: 'none', borderBottom: '1px solid var(--border-color)' }}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', marginTop: '16px' }}>
              <div style={{ marginRight: '12px', color: 'var(--text-light)', marginTop: '10px' }}>
                <FontAwesomeIcon icon={faClock} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="date"
                  id="start"
                  name="start"
                  className="form-input"
                  data-testid="eventmodal-start-date"
                  value={formData.start}
                  onChange={handleChange}
                  required
                  aria-label="Start"
                  style={{ marginRight: '8px' }}
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
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="date"
                    id="end"
                    name="end"
                    className="form-input"
                    data-testid="eventmodal-end-date"
                    value={formData.end}
                    onChange={handleChange}
                    required
                    style={{ marginRight: '8px' }}
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
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="allDay"
                      data-testid="eventmodal-all-day"
                      checked={formData.allDay}
                      onChange={handleChange}
                      style={{ marginRight: '8px' }}
                    />
                    All day
                  </label>
                </div>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ marginRight: '12px', color: 'var(--text-light)', marginTop: '10px' }}>
                <FontAwesomeIcon icon={faMapMarkerAlt} />
              </div>
              <input
                type="text"
                id="location"
                name="location"
                className="form-input"
                data-testid="eventmodal-location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Add location"
                style={{ flex: 1, border: 'none', borderBottom: '1px solid var(--border-color)' }}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ marginRight: '12px', color: 'var(--text-light)', marginTop: '10px' }}>
                <FontAwesomeIcon icon={faAlignLeft} />
              </div>
              <textarea
                id="description"
                name="description"
                className="form-input"
                data-testid="eventmodal-description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Add description"
                style={{ flex: 1, border: 'none', borderBottom: '1px solid var(--border-color)' }}
              />
            </div>
            
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label className="form-label" htmlFor="color" style={{ marginRight: '10px' }}>Color:</label>
              <input
                type="color"
                id="color"
                name="color"
                data-testid="eventmodal-color"
                value={formData.color}
                onChange={handleChange}
                style={{ width: '36px', height: '36px', border: 'none', padding: '0', background: 'none' }}
              />
            </div>
            
            {/* [KAIR-16] Add Requires Preparation checkbox and hours input */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ marginRight: '12px', color: 'var(--text-light)', marginTop: '10px' }}>
                <FontAwesomeIcon icon={faBookOpen} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="requiresPreparation"
                      checked={formData.requiresPreparation}
                      onChange={handleChange}
                      style={{ marginRight: '8px' }}
                      data-testid="eventmodal-requires-preparation"
                    />
                    Requires Preparation
                  </label>
                </div>
                
                {formData.requiresPreparation && (
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                    <label htmlFor="preparationHours" style={{ marginRight: '8px' }}>
                      Preparation Hours:
                    </label>
                    <input
                      type="number"
                      id="preparationHours"
                      name="preparationHours"
                      className="form-input"
                      value={formData.preparationHours}
                      onChange={handleChange}
                      placeholder="Enter hours"
                      min="0"
                      step="0.5"
                      style={{ 
                        width: '120px', 
                        height: '32px',
                        padding: '4px 8px',
                        fontSize: '14px'
                      }}
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
                className="button button-danger"
                data-testid="eventmodal-delete-button" 
                onClick={handleDelete}
                style={{ marginRight: 'auto' }}
              >
                <FontAwesomeIcon icon={faTrashAlt} style={{ marginRight: '5px' }} />
                Delete
              </button>
            )}
            {event && event.requiresPreparation && event.preparationHours && (
              <button 
                type="button" 
                className="button button-secondary"
                data-testid="eventmodal-trigger-study-suggestions-button" 
                onClick={handleTriggerStudySuggestions}
                style={{ marginRight: '10px' }}
              >
                <FontAwesomeIcon icon={faBookOpen} style={{ marginRight: '5px' }} />
                Generate Study Plan
              </button>
            )}
            <button 
              type="button" 
              className="button button-secondary"
              data-testid="eventmodal-cancel-button" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="button button-primary"
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
