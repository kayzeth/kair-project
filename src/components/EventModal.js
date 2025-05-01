import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrashAlt, faClock, faAlignLeft, faBookOpen, faChevronDown, faMinus, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import '../styles/EventModal.css';

// Helper function to strip HTML tags and convert common elements to text
const stripHtml = (html) => {
  if (!html) return '';
  
  // First replace list items with bullet points
  let text = html.replace(/<li>/gi, '• ');
  
  // Replace common HTML elements with newlines
  text = text
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/ol>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Clean up whitespace while preserving newlines
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
};

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
  
  // State to track if recurring event edit dialog is open
  const [showRecurringEditDialog, setShowRecurringEditDialog] = useState(false);
  
  // State to track if editing all instances or just this one
  // eslint-disable-next-line no-unused-vars
  const [editAllInstances, setEditAllInstances] = useState(false);
  
  // Ref for the color dropdown to handle outside clicks
  const colorDropdownRef = useRef(null);
  
  // Initialize with default values
  const getInitialFormData = () => {
    // Default start and end times
    let startTime = '09:00';
    let endTime = '10:00';
    let startDate = format(selectedDate, 'yyyy-MM-dd');
    let endDate = format(selectedDate, 'yyyy-MM-dd');
    
    // If there's a suggested hour from clicking a time slot in week view
    if (event && event.suggestedHour !== undefined) {
      // Format the hour as a string with leading zero if needed
      const hour = event.suggestedHour.toString().padStart(2, '0');
      startTime = `${hour}:00`;
      
      // Set end time to be 1 hour after start time
      const endHour = (event.suggestedHour + 1) % 24;
      endTime = `${endHour.toString().padStart(2, '0')}:00`;
      
      // If the end time crosses midnight (e.g., 11pm to 12am), set the end date to the next day
      if (endHour < event.suggestedHour) {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        endDate = format(nextDay, 'yyyy-MM-dd');
      }
    }
    
    return {
      title: '',
      description: '',
      location: '',
      start: startDate,
      end: endDate,
      startTime: startTime,
      endTime: endTime,
      allDay: false,
      color: '#d2b48c',
      requiresPreparation: false,
      preparationHours: '',
      // Recurring event fields
      isRecurring: false,
      recurrenceFrequency: 'WEEKLY',
      recurrenceEndDate: format(addMonths(selectedDate, 3), 'yyyy-MM-dd'), // Default to 3 months
      recurrenceDays: [],
      // Track the source of the event
      source: '',
      studySuggestionsShown: false,
      studySuggestionsAccepted: false,
      isStudySession: false,
      relatedEventId: null
    };
  };
  
  const [formData, setFormData] = useState(getInitialFormData());
  const [formErrors, setFormErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(true);

  useEffect(() => {
    if (event) {
      console.log('Event being edited:', event);
      console.log('Event source:', event.source);
    }
  }, [event]);

  useEffect(() => {
    if (event) {
      // Skip initialization if this is just a suggestedHour object
      if (event.suggestedHour !== undefined) {
        return;
      }
      
      // For Date objects, use proper formatting
      let startDate, endDate, startTime, endTime;
      
      console.log('Loading event into form:', event);
      console.log('Event studySuggestionsAccepted:', event.studySuggestionsAccepted);
      
      try {
        if (event.start instanceof Date) {
          // Store the original date objects to preserve exact timestamps
          startDate = format(event.start, 'yyyy-MM-dd');
          startTime = format(event.start, 'HH:mm');
        } else if (typeof event.start === 'string' && event.start) {
          // If it's a string (like from the database), parse it carefully
          const startDateTime = new Date(event.start);
          if (!isNaN(startDateTime.getTime())) {
            startDate = format(startDateTime, 'yyyy-MM-dd');
            startTime = format(startDateTime, 'HH:mm');
          } else {
            throw new Error('Invalid start date string');
          }
        } else {
          throw new Error('Invalid start date format');
        }
        
        if (event.end instanceof Date) {
          endDate = format(event.end, 'yyyy-MM-dd');
          endTime = format(event.end, 'HH:mm');
        } else if (typeof event.end === 'string' && event.end) {
          const endDateTime = new Date(event.end);
          if (!isNaN(endDateTime.getTime())) {
            endDate = format(endDateTime, 'yyyy-MM-dd');
            endTime = format(endDateTime, 'HH:mm');
          } else {
            throw new Error('Invalid end date string');
          }
        } else {
          throw new Error('Invalid end date format');
        }
      } catch (error) {
        console.error('Error parsing event dates:', error);
        // Use default values if there's an error
        startDate = format(new Date(), 'yyyy-MM-dd');
        startTime = '09:00';
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
        description: event.source === 'CANVAS' ? stripHtml(event.description) : (event.description || ''),
        location: event.location || '',
        start: startDate,
        end: endDate,
        startTime: startTime,
        endTime: endTime,
        allDay: event.allDay || false,
        color: event.color || '#d2b48c',
        requiresPreparation: event.requiresPreparation || false,
        preparationHours: event.preparationHours || '',
        isRecurring: event.isRecurring || false,
        recurrenceFrequency: event.recurrenceFrequency || 'WEEKLY',
        recurrenceEndDate: (() => {
          try {
            if (event.recurrenceEndDate) {
              const recEndDate = new Date(event.recurrenceEndDate);
              if (!isNaN(recEndDate.getTime())) {
                return format(recEndDate, 'yyyy-MM-dd');
              }
            }
            // Default to 3 months from start date if recurrenceEndDate is invalid
            return format(addMonths(new Date(), 3), 'yyyy-MM-dd');
          } catch (error) {
            console.error('Error formatting recurrence end date:', error);
            return format(addMonths(new Date(), 3), 'yyyy-MM-dd');
          }
        })(),
        recurrenceDays: event.recurrenceDays || [],
        source: event.source || '',
        studySuggestionsShown: event.studySuggestionsShown || false,
        studySuggestionsAccepted: event.studySuggestionsAccepted || false,
        isStudySession: event.isStudySession || false,
        relatedEventId: event.relatedEventId || null
      });
      
      console.log('Form data after initialization:', {
        studySuggestionsShown: event.studySuggestionsShown || false,
        studySuggestionsAccepted: event.studySuggestionsAccepted || false
      });
    }
  }, [event]);

  // Validate time values to ensure they're in a valid format
  const validateTimeValues = (data) => {
    const errors = {};
    let isValid = true;
    
    // Skip validation for all-day events
    if (data.allDay) {
      return { isValid, errors };
    }
    
    try {
      // Validate start time
      const [startHours, startMinutes] = data.startTime.split(':').map(Number);
      if (isNaN(startHours) || startHours < 0 || startHours > 23 || 
          isNaN(startMinutes) || startMinutes < 0 || startMinutes > 59) {
        errors.startTime = 'Invalid start time format';
        isValid = false;
      }
      
      // Validate end time
      const [endHours, endMinutes] = data.endTime.split(':').map(Number);
      if (isNaN(endHours) || endHours < 0 || endHours > 23 || 
          isNaN(endMinutes) || endMinutes < 0 || endMinutes > 59) {
        errors.endTime = 'Invalid end time format';
        isValid = false;
      }
      
      // Validate that end date/time is after start date/time
      if (isValid) {
        const [startYear, startMonth, startDay] = data.start.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay, startHours, startMinutes);
        
        const [endYear, endMonth, endDay] = data.end.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes);
        
        if (endDate <= startDate) {
          errors.timeRange = 'End time must be after start time';
          isValid = false;
        }
      }
    } catch (error) {
      console.error('Error validating time values:', error);
      errors.timeRange = 'Invalid time format';
      isValid = false;
    }
    
    return { isValid, errors };
  };
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let updatedFormData;
    if (type === 'checkbox') {
      updatedFormData = {
        ...formData,
        [name]: checked
      };
    } else {
      updatedFormData = {
        ...formData,
        [name]: value
      };
    }
    
    // If changing start time or date, check if we need to adjust the end time
    if (name === 'startTime' || name === 'start') {
      // Parse the start and end times
      try {
        // For start time change
        if (name === 'startTime') {
          const [newStartHours, newStartMinutes] = value.split(':').map(Number);
          const [endHours, endMinutes] = updatedFormData.endTime.split(':').map(Number);
          
          // If start and end dates are the same and start time is now later than or equal to end time
          if (updatedFormData.start === updatedFormData.end && 
              (newStartHours > endHours || (newStartHours === endHours && newStartMinutes >= endMinutes))) {
            // Set end time to be 1 hour after the new start time
            const newEndHours = (newStartHours + 1) % 24;
            updatedFormData.endTime = `${newEndHours.toString().padStart(2, '0')}:${newStartMinutes.toString().padStart(2, '0')}`;
            
            // If adding an hour crosses midnight, increment the end date if needed
            if (newEndHours < newStartHours && updatedFormData.start === updatedFormData.end) {
              const startDate = new Date(updatedFormData.start);
              const nextDay = new Date(startDate);
              nextDay.setDate(startDate.getDate() + 1);
              updatedFormData.end = format(nextDay, 'yyyy-MM-dd');
            }
          }
        }
        
        // For start date change
        if (name === 'start') {
          // If the new start date is later than the current end date
          const startDate = new Date(value);
          const endDate = new Date(updatedFormData.end);
          
          if (startDate > endDate) {
            // Set end date to be the same as start date
            updatedFormData.end = value;
            
            // Also check if times need adjustment
            const [startHours, startMinutes] = updatedFormData.startTime.split(':').map(Number);
            const [endHours, endMinutes] = updatedFormData.endTime.split(':').map(Number);
            
            if (startHours > endHours || (startHours === endHours && startMinutes >= endMinutes)) {
              // Set end time to be 1 hour after start time
              const newEndHours = (startHours + 1) % 24;
              updatedFormData.endTime = `${newEndHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
              
              // If adding an hour crosses midnight, increment the end date
              if (newEndHours < startHours) {
                const nextDay = new Date(startDate);
                nextDay.setDate(startDate.getDate() + 1);
                updatedFormData.end = format(nextDay, 'yyyy-MM-dd');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error adjusting end time:', error);
        // Continue with the form update even if there's an error in the adjustment logic
      }
    }
    
    setFormData(updatedFormData);
    
    // Validate the form after any changes to time-related fields
    if (['start', 'end', 'startTime', 'endTime', 'allDay'].includes(name)) {
      const { isValid, errors } = validateTimeValues(updatedFormData);
      setIsFormValid(isValid);
      setFormErrors(errors);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Event title is required');
      return;
    }
    
    // Validate time values before submitting
    const { isValid, errors } = validateTimeValues(formData);
    if (!isValid) {
      setIsFormValid(false);
      setFormErrors(errors);
      return;
    }
    
    // If this is a recurring event instance, show the dialog to ask if user wants to edit all instances
    if (event && event.isEditingInstance && formData.isRecurring) {
      setShowRecurringEditDialog(true);
      return;
    }
    
    console.log('Original event studySuggestionsAccepted:', event?.studySuggestionsAccepted);
    console.log('Form data studySuggestionsAccepted:', formData.studySuggestionsAccepted);
    
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
        '',
      // Include recurring event data
      isRecurring: formData.isRecurring,
      recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : null,
      recurrenceEndDate: formData.isRecurring ? new Date(formData.recurrenceEndDate) : null,
      recurrenceDays: formData.isRecurring ? formData.recurrenceDays : [],
      // Preserve study suggestion status flags from the original event
      studySuggestionsShown: formData.studySuggestionsShown,
      studySuggestionsAccepted: formData.studySuggestionsAccepted,
      // Preserve the source field
      source: formData.source || event?.source || 'LMS',
      // Preserve the isStudySession flag and relatedEventId if they exist
      isStudySession: event?.isStudySession || false,
      relatedEventId: event?.relatedEventId || null
    };
    
    // Log the study session relationship
    if (event?.isStudySession) {
      console.log(`Preserving study session relationship: relatedEventId=${event.relatedEventId}`);
    }
    
    console.log('Event object before save:', {
      studySuggestionsShown: eventObject.studySuggestionsShown,
      studySuggestionsAccepted: eventObject.studySuggestionsAccepted
    });
    
    // Check if we're only toggling the preparation checkbox without changing dates/times
    let isJustTogglingPreparation = false;
    
    if (event && event.start && event.end) {
      // Get the original date and time strings for comparison
      // Safely create date objects with null checks
      let originalStartDate, originalEndDate;
      
      try {
        originalStartDate = format(new Date(event.start), 'yyyy-MM-dd');
        originalEndDate = format(new Date(event.end), 'yyyy-MM-dd');
      } catch (error) {
        console.error('Error formatting event dates:', error);
        // Set default values if formatting fails
        originalStartDate = format(new Date(), 'yyyy-MM-dd');
        originalEndDate = format(new Date(), 'yyyy-MM-dd');
      }
      
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
        try {
          // Validate start time and date values
          const startTimeParts = formData.startTime.split(':');
          const startHours = parseInt(startTimeParts[0] || '0', 10);
          const startMinutes = parseInt(startTimeParts[1] || '0', 10);
          
          const startDateParts = formData.start.split('-');
          const year = parseInt(startDateParts[0] || '0', 10);
          const month = parseInt(startDateParts[1] || '1', 10);
          const day = parseInt(startDateParts[2] || '1', 10);
          
          // Validate end time and date values
          const endTimeParts = formData.endTime.split(':');
          const endHours = parseInt(endTimeParts[0] || '0', 10);
          const endMinutes = parseInt(endTimeParts[1] || '0', 10);
          
          const endDateParts = formData.end.split('-');
          const endYear = parseInt(endDateParts[0] || '0', 10);
          const endMonth = parseInt(endDateParts[1] || '1', 10);
          const endDay = parseInt(endDateParts[2] || '1', 10);
          
          // Validate all values are within reasonable ranges
          if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 ||
              startHours < 0 || startHours > 23 || startMinutes < 0 || startMinutes > 59 ||
              endYear < 1970 || endYear > 2100 || endMonth < 1 || endMonth > 12 || endDay < 1 || endDay > 31 ||
              endHours < 0 || endHours > 23 || endMinutes < 0 || endMinutes > 59) {
            throw new Error('Invalid date or time values');
          }
          
          // Create date using local time components with validated values
          const startDate = new Date(year, month - 1, day, startHours, startMinutes, 0);
          const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes, 0);
          
          // Check if the dates are valid
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date created');
          }
          
          eventObject.start = startDate;
          eventObject.end = endDate;
          eventObject.startTime = formData.startTime;
          eventObject.endTime = formData.endTime;
        } catch (error) {
          console.error('Error creating date objects:', error);
          alert('There was an error with the date/time values. Please check your input and try again.');
          return; // Stop form submission if there's an error
        }
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
        // Allow regenerating study plans even if the event already has accepted study suggestions
        if (event.studySuggestionsAccepted === true) {
          console.log(`Event "${event.title}" already has accepted study suggestions. Regenerating anyway.`);
        }
        
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
          preparationHours: formData.requiresPreparation ? 
            (formData.preparationHours === '' ? '' : formData.preparationHours) : 
            '',
          // Include recurring event data
          isRecurring: formData.isRecurring,
          recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : null,
          recurrenceEndDate: formData.isRecurring ? new Date(formData.recurrenceEndDate) : null,
          recurrenceDays: formData.isRecurring ? formData.recurrenceDays : [],
          // Preserve study suggestion status flags
          studySuggestionsShown: event?.studySuggestionsShown || false,
          studySuggestionsAccepted: event?.studySuggestionsAccepted || false,
          // Preserve the isStudySession flag and relatedEventId if they exist
          isStudySession: event?.isStudySession || false,
          relatedEventId: event?.relatedEventId || null,
          // Preserve the source field
          source: formData.source || event?.source || 'LMS'
        };
        
        // Save the updated event first
        await onSave(updatedEvent);
        
        // Now trigger study suggestions with force generation enabled
        // This will generate study suggestions even if the event is more than 8 days away
        const tempEvent = {
          ...updatedEvent,
          id: event.id,
          title: formData.title,
          start: formData.allDay 
            ? new Date(`${formData.start}T00:00:00`) 
            : new Date(`${formData.start}T${formData.startTime}`),
          end: formData.allDay 
            ? new Date(`${formData.end}T23:59:59`) 
            : new Date(`${formData.end}T${formData.endTime}`),
          allDay: formData.allDay,
          color: formData.color,
          requiresPreparation: formData.requiresPreparation,
          preparationHours: formData.preparationHours,
          // Include recurring event data
          isRecurring: formData.isRecurring,
          recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : null,
          recurrenceEndDate: formData.isRecurring ? new Date(formData.recurrenceEndDate) : null,
          recurrenceDays: formData.isRecurring ? formData.recurrenceDays : [],
          // Include study suggestion status flags
          studySuggestionsShown: formData.studySuggestionsShown,
          studySuggestionsAccepted: formData.studySuggestionsAccepted,
          // Include source
          source: formData.source || event?.source || 'LMS'
        };
        
        console.log('tempEvent before triggering study suggestions:', {
          studySuggestionsShown: tempEvent.studySuggestionsShown,
          studySuggestionsAccepted: tempEvent.studySuggestionsAccepted
        });
        
        // Pass true as the second parameter to force generation regardless of date
        onTriggerStudySuggestions(tempEvent, true);
        onClose();
      } catch (error) {
        console.error('Error triggering study suggestions:', error);
        alert('There was an error generating your study plan. Please try again.');
      }
    } else {
      // For new events, we need to save first before generating study suggestions
      alert('Please save the event first before generating a study plan.');
    }
  };

  // Function to handle editing all instances of a recurring event
  const handleEditAllInstances = () => {
    setEditAllInstances(true);
    setShowRecurringEditDialog(false);
    
    // Create the event object with the recurring event data
    const eventObject = {
      id: event ? event.id : null,
      title: formData.title,
      description: formData.description,
      location: formData.location,
      allDay: formData.allDay,
      color: formData.color,
      requiresPreparation: formData.requiresPreparation,
      preparationHours: formData.requiresPreparation ? 
        (formData.preparationHours === '' ? '' : formData.preparationHours) : 
        '',
      // Include recurring event data
      isRecurring: formData.isRecurring,
      recurrenceFrequency: formData.isRecurring ? formData.recurrenceFrequency : null,
      recurrenceEndDate: formData.isRecurring ? new Date(formData.recurrenceEndDate) : null,
      recurrenceDays: formData.isRecurring ? formData.recurrenceDays : [],
      // Preserve study suggestion status flags
      studySuggestionsShown: event?.studySuggestionsShown || false,
      studySuggestionsAccepted: event?.studySuggestionsAccepted || false,
      // Preserve the source field
      source: formData.source || event?.source || 'LMS'
    };
    
    // Handle date and time
    if (formData.allDay) {
      const [year, month, day] = formData.start.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, 0, 0, 0);
      
      const [endYear, endMonth, endDay] = formData.end.split('-').map(Number);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
      
      eventObject.start = startDate;
      eventObject.end = endDate;
    } else {
      const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
      const [year, month, day] = formData.start.split('-').map(Number);
      
      // Create date using local time components
      // This ensures the time shown to the user is exactly what they selected
      const startDate = new Date(year, month - 1, day, startHours, startMinutes);
      
      const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
      const [endYear, endMonth, endDay] = formData.end.split('-').map(Number);
      const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes);
      
      eventObject.start = startDate;
      eventObject.end = endDate;
      eventObject.startTime = formData.startTime;
      eventObject.endTime = formData.endTime;
    }
    
    // Save the event
    onSave(eventObject);
    onClose();
  };
  
  // Function to handle editing just this instance of a recurring event
  const handleEditThisInstance = () => {
    setEditAllInstances(false);
    setShowRecurringEditDialog(false);
    
    // Create a new non-recurring event for this instance
    const eventObject = {
      // Generate a new ID for this instance
      id: null, // Let the server generate a new ID
      title: formData.title,
      description: formData.description,
      location: formData.location,
      allDay: formData.allDay,
      color: formData.color,
      requiresPreparation: formData.requiresPreparation,
      preparationHours: formData.requiresPreparation ? 
        (formData.preparationHours === '' ? '' : formData.preparationHours) : 
        '',
      // This is a single instance, not recurring
      isRecurring: false,
      // Store a reference to the original recurring event
      originalRecurringEventId: event.id,
      // Preserve study suggestion status flags
      studySuggestionsShown: event?.studySuggestionsShown || false,
      studySuggestionsAccepted: event?.studySuggestionsAccepted || false,
      // Preserve the source field
      source: formData.source || event?.source || 'LMS'
    };
    
    // Handle date and time
    if (formData.allDay) {
      const [year, month, day] = formData.start.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, 0, 0, 0);
      
      const [endYear, endMonth, endDay] = formData.end.split('-').map(Number);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
      
      eventObject.start = startDate;
      eventObject.end = endDate;
    } else {
      const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
      const [year, month, day] = formData.start.split('-').map(Number);
      
      // Create date using local time components
      // This ensures the time shown to the user is exactly what they selected
      const startDate = new Date(year, month - 1, day, startHours, startMinutes);
      
      const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
      const [endYear, endMonth, endDay] = formData.end.split('-').map(Number);
      const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes);
      
      eventObject.start = startDate;
      eventObject.end = endDate;
      eventObject.startTime = formData.startTime;
      eventObject.endTime = formData.endTime;
    }
    
    // Save the event
    onSave(eventObject);
    onClose();
  };
  
  // Function to cancel editing
  const handleCancelRecurringEdit = () => {
    setShowRecurringEditDialog(false);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      {showRecurringEditDialog && (
        <div className="recurring-edit-dialog">
          <div className="recurring-edit-dialog-content">
            <h3>Edit Recurring Event</h3>
            <p>Would you like to edit all instances of this recurring event, or just this occurrence?</p>
            <div className="recurring-edit-dialog-buttons">
              <button className="button button-secondary" onClick={handleEditThisInstance}>Just this occurrence</button>
              <button className="button button-primary" onClick={handleEditAllInstances}>All instances</button>
              <button className="button button-secondary" onClick={handleCancelRecurringEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}
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
                    checked={formData.allDay}
                    onChange={handleChange}
                    data-testid="eventmodal-all-day"
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
            <div className="form-group form-group-flex-top">
              {/* Only show the book icon and preparation checkbox for non-NUDGER events */}
              {formData.source !== 'NUDGER' && (
                <>
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
                        data-testid="eventmodalsafari-requires-preparation-checkbox"
                      />
                      Requires Preparation
                    </div>
                    
                    {formData.requiresPreparation && (
                      <div 
                        className="date-time-row"
                        data-testid="eventmodalsafari-preparation-hours-container"
                        style={{ marginTop: '10px' }}
                      >
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
                          data-testid="eventmodalsafari-preparation-hours-input"
                          step="0.5"
                        />
                      </div>
                    )}

                    {formData.requiresPreparation && (formData.preparationHours !== undefined && formData.preparationHours !== null && formData.preparationHours !== '') && (
                      <button 
                        type="button" 
                        className="button button-secondary"
                        data-testid="eventmodal-trigger-study-suggestions-button" 
                        onClick={handleTriggerStudySuggestions}
                        title={event ? "Generate a study plan for this event" : "Save the event first to generate a study plan"}
                      >
                        <FontAwesomeIcon icon={faBookOpen} className="button-icon" />
                        Generate Study Plan
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {/* Recurring Events Section */}
            <div className="form-group form-group-flex-center">
              <div className="form-icon">
                <FontAwesomeIcon icon={faClock} />
              </div>
              <div className="date-time-container">
                <div className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    className="checkbox-input"
                    checked={formData.isRecurring}
                    onChange={handleChange}
                    data-testid="eventmodal-is-recurring"
                  />
                  Recurring Event
                </div>
                
                {formData.isRecurring && (
                  <div className="recurring-options">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
                      <div style={{ flex: 1 }}>
                        <div className="date-time-row">
                          <label htmlFor="recurrenceFrequency" className="form-label" style={{ fontSize: '0.9rem' }}>
                            Frequency:
                          </label>
                          <select
                            id="recurrenceFrequency"
                            name="recurrenceFrequency"
                            className="form-input select-input"
                            value={formData.recurrenceFrequency}
                            onChange={handleChange}
                            data-testid="eventmodal-recurrence-frequency"
                            style={{ padding: '4px', fontSize: '0.9rem' }}
                          >
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="BIWEEKLY">Bi-weekly</option>
                            <option value="MONTHLY">Monthly</option>
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div className="date-time-row">
                          <label htmlFor="recurrenceEndDate" className="form-label" style={{ fontSize: '0.9rem' }}>
                            End:
                          </label>
                          <input
                            type="date"
                            id="recurrenceEndDate"
                            name="recurrenceEndDate"
                            className="form-input date-input"
                            value={formData.recurrenceEndDate}
                            onChange={handleChange}
                            min={formData.start}
                            data-testid="eventmodal-recurrence-end-date"
                            style={{ padding: '4px', fontSize: '0.9rem' }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {(formData.recurrenceFrequency === 'WEEKLY' || formData.recurrenceFrequency === 'BIWEEKLY') && (
                      <div className="weekday-selector">
                        <label className="form-label" style={{ fontSize: '0.9rem' }}>Repeat on:</label>
                        <div className="weekday-options">
                          {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(day => (
                            <label key={day} className="weekday-option">
                              <input
                                type="checkbox"
                                name="recurrenceDays"
                                value={day}
                                checked={formData.recurrenceDays.includes(day)}
                                onChange={(e) => {
                                  const { checked, value } = e.target;
                                  setFormData(prev => ({
                                    ...prev,
                                    recurrenceDays: checked
                                      ? [...prev.recurrenceDays, value]
                                      : prev.recurrenceDays.filter(d => d !== value)
                                  }));
                                }}
                              />
                              {day.charAt(0)}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {/* Display form validation errors */}
            {!isFormValid && Object.keys(formErrors).length > 0 && (
              <div className="form-error-message" style={{ color: 'red', marginBottom: '10px' }}>
                {Object.values(formErrors).map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
            
            <div className="form-buttons" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
              {event && (
                <button 
                  type="button" 
                  className="button button-danger"
                  data-testid="eventmodal-delete-button" 
                  onClick={handleDelete}
                >
                  <FontAwesomeIcon icon={faTrashAlt} className="button-icon" />
                  Delete
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
                className="button button-primary"
                data-testid="eventmodal-save-button"
                disabled={!isFormValid}
              >
                {event ? 'Save' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
