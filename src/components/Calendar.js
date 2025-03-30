import React, { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import EventModal from './EventModal';
import PreparationPrompt from './PreparationPrompt'; 
import StudySuggestions from './StudySuggestions'; 
import googleCalendarService from '../services/googleCalendarService';
import nudgerService from '../services/nudgerService'; 
import studySuggesterService from '../services/studySuggesterService'; 
import ApiKeyInput from './ApiKeyInput';
import '../styles/Calendar.css';

const Calendar = ({ initialEvents = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', or 'day'
  const [events, setEvents] = useState([]); // Start with empty array, load from localStorage
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [showPreparationPrompt, setShowPreparationPrompt] = useState(false);
  const [eventsNeedingPreparation, setEventsNeedingPreparation] = useState([]);
  const [dismissedEvents, setDismissedEvents] = useState({});
  const [viewDate, setViewDate] = useState(new Date());
  const [studySuggestions, setStudySuggestions] = useState([]);
  const [showStudySuggestions, setShowStudySuggestions] = useState(false);

  // Calculate the appropriate view date based on the calendar view type
  useEffect(() => {
    let newViewDate;
    
    if (view === 'day') {
      // For day view, use the current date directly
      newViewDate = currentDate;
    } else if (view === 'week') {
      // For week view, use the first day of the week
      newViewDate = startOfWeek(currentDate);
    } else {
      // For month view, use the first day of the month
      newViewDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    }
    
    setViewDate(newViewDate);
  }, [currentDate, view]);

  // Load events from localStorage when component mounts or when events are updated
  const loadEvents = useCallback(() => {
    const savedEvents = localStorage.getItem('calendarEvents');
    if (savedEvents) {
      try {
        const parsedEvents = JSON.parse(savedEvents);
        // Convert date strings back to Date objects for events
        const eventsWithDates = parsedEvents.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
        console.log('Loaded events from localStorage:', eventsWithDates.length);
        setEvents(eventsWithDates);
      } catch (error) {
        console.error('Error loading events from localStorage:', error);
      }
    }
  }, []);

  // Handle initialEvents prop
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      console.log('Received initialEvents:', initialEvents.length);
      // Combine with existing events from localStorage
      loadEvents();
      setEvents(prevEvents => {
        const combinedEvents = [...prevEvents, ...initialEvents];
        // Save combined events to localStorage
        try {
          localStorage.setItem('calendarEvents', JSON.stringify(combinedEvents));
          console.log('Saved combined events to localStorage:', combinedEvents.length);
        } catch (error) {
          console.error('Error saving combined events to localStorage:', error);
        }
        return combinedEvents;
      });
    }
  }, [initialEvents, loadEvents]);

  // Load events from localStorage on component mount
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Only save events to localStorage when they are explicitly updated through setEvents
  const updateEvents = useCallback((newEvents) => {
    setEvents(newEvents);
    try {
      localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
      console.log('Saved events to localStorage:', newEvents.length);
    } catch (error) {
      console.error('Error saving events to localStorage:', error);
    }
  }, []);

  const nextHandler = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const prevHandler = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const todayHandler = () => {
    setCurrentDate(new Date());
  };

  const addEventHandler = (date = currentDate) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
  };

  // Google Calendar cache state
  const [googleCalendarCache, setGoogleCalendarCache] = useState({
    startDate: null,
    endDate: null,
    lastFetched: null
  });

  const importGoogleCalendarEvents = useCallback(async (forceRefresh = false) => {
    try {
      setSyncStatus({ status: 'loading', message: 'Importing events from Google Calendar...' });
      
      // Use viewDate as the reference point instead of currentDate
      // viewDate is calculated based on the calendar view type
      const oneYearAgo = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), viewDate.getDate());
      const oneYearFromNow = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), viewDate.getDate());
      
      let googleEvents = [];
      
      // Check if the current view date is within our cached range and if the cache is still valid
      const isCacheValid = googleCalendarCache.startDate && googleCalendarCache.endDate && 
        viewDate >= googleCalendarCache.startDate && viewDate <= googleCalendarCache.endDate &&
        googleCalendarCache.lastFetched && 
        (new Date() - googleCalendarCache.lastFetched < 24 * 60 * 60 * 1000); // Cache valid for 24 hours
      
      if (!isCacheValid || forceRefresh) {
        // Cache is invalid or forced refresh, fetch new data
        googleEvents = await googleCalendarService.importEvents(oneYearAgo, oneYearFromNow);
        
        // Update the cache
        setGoogleCalendarCache({
          startDate: oneYearAgo,
          endDate: oneYearFromNow,
          lastFetched: new Date()
        });
        
        // Filter out events that already exist in our calendar
        const existingGoogleEventIds = events
          .filter(event => event.googleEventId)
          .map(event => event.googleEventId);
        
        const newGoogleEvents = googleEvents.filter(
          event => !existingGoogleEventIds.includes(event.googleEventId)
        );
        
        // Add the new Google events to our events array
        updateEvents([...events, ...newGoogleEvents]);
        
        setSyncStatus({ 
          status: 'success', 
          message: `Successfully imported ${newGoogleEvents.length} events from Google Calendar` 
        });
      } else {
        // Cache is valid, no need to fetch
        setSyncStatus({ 
          status: 'success', 
          message: 'Calendar is up to date with Google Calendar' 
        });
      }
      
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
        
    } catch (error) {
      console.error('Error importing Google Calendar events:', error);
      setSyncStatus({ 
        status: 'error', 
        message: 'Failed to import events from Google Calendar' 
      });
        
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
    }
  }, [events, updateEvents, setSyncStatus, viewDate, googleCalendarCache]);

  useEffect(() => {
    const checkGoogleCalendarConnection = async () => {
      try {
        await googleCalendarService.initialize();
        const isSignedIn = googleCalendarService.isSignedIn();
        setIsGoogleCalendarConnected(isSignedIn);
        
        googleCalendarService.addSignInListener((isSignedIn) => {
          setIsGoogleCalendarConnected(isSignedIn);
        });
        
        if (isSignedIn) {
          importGoogleCalendarEvents();
        }
      } catch (error) {
        console.error('Error checking Google Calendar connection:', error);
      }
    };
    
    checkGoogleCalendarConnection();
  }, [importGoogleCalendarEvents]);

  // Check for dismissed events that should be reminded again
  useEffect(() => {
    const checkDismissedEvents = () => {
      const now = new Date().getTime();
      const updatedDismissed = { ...dismissedEvents };
      let hasChanges = false;

      Object.keys(dismissedEvents).forEach(eventId => {
        if (now >= dismissedEvents[eventId]) {
          delete updatedDismissed[eventId];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setDismissedEvents(updatedDismissed);
      }
    };

    // Check every minute
    const intervalId = setInterval(checkDismissedEvents, 60000);
    
    // Initial check
    checkDismissedEvents();
    
    return () => clearInterval(intervalId);
  }, [dismissedEvents]);

  useEffect(() => {
    const studyPlan = nudgerService.getStudyPlan(events);
    // Filter events needing preparation that haven't been dismissed
    const pendingEvents = studyPlan.events.filter(event => 
      event.needsPreparationInput && 
      !dismissedEvents[event.id]
    );
    
    if (pendingEvents.length > 0 && !showModal) {
      setEventsNeedingPreparation(pendingEvents);
      setShowPreparationPrompt(true);
    } else {
      setShowPreparationPrompt(false);
    }
    
    window.studyPlan = studyPlan;
    console.log('[KAIR-15] Nudger study plan updated:', studyPlan);
  }, [events, showModal, dismissedEvents]);

  // Manually trigger study suggestions for an event
  const triggerStudySuggestions = async (event) => {
    if (event && event.requiresPreparation && event.preparationHours) {
      await generateStudySuggestions(
        events,
        event,
        parseFloat(event.preparationHours)
      );
    }
  };

  const saveEvent = async (eventData) => {
    const { id: _, ...cleanEventData } = eventData;

    try {
      let updatedEvent = null;
      
      if (selectedEvent) {
        // Check if preparation hours were added or changed
        const preparationHoursChanged = 
          (selectedEvent.preparationHours !== cleanEventData.preparationHours) && 
          cleanEventData.requiresPreparation && 
          cleanEventData.preparationHours;
        
        const updatedEvents = events.map(event => 
          event.id === selectedEvent.id ? { 
            ...cleanEventData, 
            ...eventData,
            start: cleanEventData.allDay ? cleanEventData.start : `${cleanEventData.start}T${cleanEventData.startTime}`,
            end: cleanEventData.allDay ? cleanEventData.end : `${cleanEventData.end}T${cleanEventData.endTime}`
          } : event
        );
        updateEvents(updatedEvents);
        
        // Get the updated event for study suggestions
        if (preparationHoursChanged) {
          updatedEvent = updatedEvents.find(event => event.id === selectedEvent.id);
        }
        
        if (isGoogleCalendarConnected && selectedEvent.googleEventId) {
          try {
            await googleCalendarService.updateEvent({
              ...cleanEventData,
              googleEventId: selectedEvent.googleEventId,
              start: cleanEventData.allDay ? cleanEventData.start : `${cleanEventData.start}T${cleanEventData.startTime}`,
              end: cleanEventData.allDay ? cleanEventData.end : `${cleanEventData.end}T${cleanEventData.endTime}`
            });
          } catch (error) {
            console.error('Error updating event in Google Calendar:', error);
          }
        }
      } else {
        const newEvent = {
          id: Date.now().toString(),
          ...cleanEventData,
          start: cleanEventData.allDay ? cleanEventData.start : `${cleanEventData.start}T${cleanEventData.startTime}`,
          end: cleanEventData.allDay ? cleanEventData.end : `${cleanEventData.end}T${cleanEventData.endTime}`
        };
        
        if (isGoogleCalendarConnected) {
          try {
            const googleEvent = await googleCalendarService.exportEvent(newEvent);
            newEvent.googleEventId = googleEvent.id;
            newEvent.source = 'google';
          } catch (error) {
            console.error('Error creating event in Google Calendar:', error);
          }
        }
        
        updateEvents([...events, newEvent]);
        
        // Check if the new event requires preparation and has preparation hours
        if (newEvent.requiresPreparation && newEvent.preparationHours) {
          updatedEvent = newEvent;
        }
        
        setTimeout(() => {
          const singleEventStudyPlan = nudgerService.getStudyPlan([newEvent]);
          if (singleEventStudyPlan.eventCount > 0) {
            console.log('[KAIR-15] New event may require study time:', singleEventStudyPlan.events[0]);
          }
        }, 0);
      }
      
      // Generate study suggestions if preparation hours were added or changed
      if (updatedEvent && updatedEvent.preparationHours) {
        // Check if the event is within 8 days
        const eventDate = new Date(updatedEvent.start instanceof Date ? updatedEvent.start : updatedEvent.start);
        const now = new Date();
        const daysUntilEvent = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        
        console.log(`Event is ${daysUntilEvent} days away`);
        
        if (daysUntilEvent <= 8) {
          // Event is within 8 days, show study suggestions now
          closeModal();
          setTimeout(() => {
            generateStudySuggestions(
              events, 
              updatedEvent, 
              parseFloat(updatedEvent.preparationHours)
            );
          }, 500); // Short delay to ensure the modal is closed first
        } else {
          // Event is more than 8 days away, don't show study suggestions yet
          console.log('Event is more than 8 days away, not showing study suggestions yet');
          closeModal();
        }
        return; // Skip the normal closeModal call since we're handling it separately
      }
    } catch (error) {
      console.error('Error saving event:', error);
    }
    
    closeModal();
  };

  const savePreparationHours = async (eventId, hours) => {
    // Update the event with preparation hours
    const updatedEvents = events.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          preparationHours: hours.toString(),
          requiresPreparation: true,
          needsPreparationInput: false
        };
      }
      return event;
    });
    
    updateEvents(updatedEvents);
    
    // Find the updated event
    const updatedEvent = updatedEvents.find(event => event.id === eventId);
    
    // Show success message
    setSyncStatus({
      status: 'success',
      message: `Added ${hours} preparation hours to event`
    });
    
    // Clear the status after 3 seconds
    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3000);
    
    // Generate study suggestions for this event
    if (updatedEvent) {
      // Check if the event is within 8 days
      const eventDate = new Date(updatedEvent.start instanceof Date ? updatedEvent.start : updatedEvent.start);
      const now = new Date();
      const daysUntilEvent = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
      
      console.log(`Event is ${daysUntilEvent} days away`);
      
      if (daysUntilEvent <= 8) {
        // Event is within 8 days, show study suggestions now
        await generateStudySuggestions(updatedEvents, updatedEvent, hours);
      } else {
        // Event is more than 8 days away, don't show study suggestions yet
        console.log('Event is more than 8 days away, not showing study suggestions yet');
        setSyncStatus({
          status: 'info',
          message: `Added ${hours} preparation hours. Study suggestions will be available 8 days before the event.`
        });
      }
    }
    
    // Remove the event from the list of events needing preparation
    setEventsNeedingPreparation(prev => prev.filter(event => event.id !== eventId));
    
    // If no more events need preparation, close the prompt
    if (eventsNeedingPreparation.length <= 1) {
      setShowPreparationPrompt(false);
    }
  };
  
  // Generate study suggestions for an event
  const generateStudySuggestions = async (allEvents, event, preparationHours) => {
    // Show loading status
    setSyncStatus({
      status: 'loading',
      message: 'Generating smart study suggestions...'
    });
    
    try {
      const suggestions = await studySuggesterService.generateStudySuggestions(
        allEvents, 
        event, 
        preparationHours
      );
      
      if (suggestions && suggestions.length > 0) {
        setStudySuggestions(suggestions);
        setShowStudySuggestions(true);
        
        // Show success message
        setSyncStatus({
          status: 'success',
          message: `Generated ${suggestions.length} study suggestions`
        });
      } else {
        // Show message if no suggestions could be generated
        setSyncStatus({
          status: 'info',
          message: 'Could not generate study suggestions. Try adjusting preparation hours.'
        });
      }
    } catch (error) {
      console.error('Error generating study suggestions:', error);
      setSyncStatus({
        status: 'error',
        message: 'Error generating study suggestions'
      });
    }
    
    // Clear status after 3 seconds
    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3000);
  };

  // Handle accepting study suggestions
  const handleAcceptStudySuggestions = (acceptedSuggestions) => {
    // Create calendar events from the suggestions
    const studyEvents = acceptedSuggestions.map((suggestion, index) => {
      const { event, suggestedStartTime, suggestedEndTime, message } = suggestion;
      
      // Format dates to match how regular events are stored
      // Use the exact Date objects from the suggestions to ensure consistency
      const startDate = format(suggestedStartTime, 'yyyy-MM-dd');
      const startTime = format(suggestedStartTime, 'HH:mm');
      const endDate = format(suggestedEndTime, 'yyyy-MM-dd');
      const endTime = format(suggestedEndTime, 'HH:mm');
      
      // Create a new event with the same structure as regular events
      // Use a unique timestamp for each study session
      const uniqueId = Date.now() + index;
      
      return {
        id: `study-${uniqueId}`,
        title: message,
        description: `Study session for ${event.title}`,
        location: '',
        start: suggestedStartTime, // Use the exact Date object
        end: suggestedEndTime, // Use the exact Date object
        startDate,
        endDate,
        startTime,
        endTime,
        allDay: false,
        color: '#4287f5', // Blue color for study events
        relatedEventId: event.id,
        relatedEventTitle: event.title,
        type: 'study',
        isStudySession: true,
        requiresPreparation: false,
        // Add a unique batch ID to identify which sessions were added together
        // but still allow them to be deleted individually
        studyBatchId: `batch-${Date.now()}`
      };
    });
    
    // Add the study events to the calendar one by one
    let updatedEvents = [...events];
    
    // Add each study event individually to ensure they have separate entries
    studyEvents.forEach(studyEvent => {
      updatedEvents = [...updatedEvents, studyEvent];
    });
    
    updateEvents(updatedEvents);
    
    // Show success message
    setSyncStatus({
      status: 'success',
      message: `Added ${acceptedSuggestions.length} study sessions to your calendar`
    });
    
    // Clear the status after 3 seconds
    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3000);
  };

  const handleRejectStudySuggestions = () => {
    setShowStudySuggestions(false);
    setStudySuggestions([]);
  };

  const deleteEvent = async (id) => {
    const eventToDelete = events.find(event => event.id === id);
    
    if (!eventToDelete) {
      console.error('Event not found for deletion:', id);
      return;
    }
    
    console.log('Deleting event:', eventToDelete);
    
    // If this is a regular event, check if it has related study sessions
    if (!eventToDelete.isStudySession && eventToDelete.requiresPreparation) {
      // Get all study sessions related to this event
      const relatedStudySessions = events.filter(
        event => event.isStudySession && event.relatedEventId === eventToDelete.id
      );
      
      if (relatedStudySessions.length > 0) {
        console.log(`Deleting ${relatedStudySessions.length} related study sessions`);
        
        // Remove the main event and all its related study sessions
        updateEvents(events.filter(event => 
          event.id !== id && !(event.isStudySession && event.relatedEventId === eventToDelete.id)
        ));
      } else {
        // Just remove the main event
        updateEvents(events.filter(event => event.id !== id));
      }
    } else {
      // This is either a study session or a regular event without study sessions
      // Only remove this specific event by its unique ID
      updateEvents(events.filter(event => event.id !== id));
    }
    
    // If it's a Google Calendar event, delete it from Google Calendar as well
    if (isGoogleCalendarConnected && eventToDelete && eventToDelete.googleEventId) {
      try {
        await googleCalendarService.deleteEvent(eventToDelete);
      } catch (error) {
        console.error('Error deleting event from Google Calendar:', error);
      }
    }
    
    // Show success message for study events
    if (eventToDelete && eventToDelete.isStudySession) {
      setSyncStatus({
        status: 'success',
        message: 'Study session removed from calendar'
      });
      
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
    }
    
    closeModal();
  };

  const editEvent = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const dismissPreparationPrompt = (eventId) => {
    // Set a reminder for 3 hours from now
    const reminderTime = new Date().getTime() + (3 * 60 * 60 * 1000);
    
    setDismissedEvents(prev => ({
      ...prev,
      [eventId]: reminderTime
    }));
    
    setSyncStatus({
      status: 'info',
      message: `You'll be reminded about this event in 3 hours`
    });
    
    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3000);
  };

  const closePreparationPrompt = () => {
    setShowPreparationPrompt(false);
    setEventsNeedingPreparation([]);
  };

  const renderView = () => {
    switch (view) {
      case 'month':
        return (
          <MonthView 
            currentDate={currentDate} 
            events={events} 
            onAddEvent={addEventHandler}
            onEditEvent={editEvent}
          />
        );
      case 'week':
        return (
          <WeekView 
            currentDate={currentDate} 
            events={events} 
            onAddEvent={addEventHandler}
            onEditEvent={editEvent}
          />
        );
      case 'day':
        return (
          <DayView 
            currentDate={currentDate} 
            events={events} 
            onAddEvent={addEventHandler}
            onEditEvent={editEvent}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="calendar-container" data-testid="calendar-container">
      {syncStatus.status !== 'idle' && (
        <div className={`sync-banner sync-${syncStatus.status}`} data-testid="sync-status">
          {syncStatus.message}
        </div>
      )}
      <div className="calendar-header">
        <div className="calendar-title" data-testid="calendar-title">
          {view === 'month' && format(currentDate, 'MMMM yyyy')}
          {view === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`}
          {view === 'day' && format(currentDate, 'EEEE, MMMM d, yyyy')}
        </div>
        <div className="calendar-nav">
          <div className="view-selector">
            <button 
              className={`view-button ${view === 'day' ? 'active' : ''}`}
              onClick={() => setView('day')}
              data-testid="calendar-day-view-button"
            >
              Day
            </button>
            <button 
              className={`view-button ${view === 'week' ? 'active' : ''}`}
              onClick={() => setView('week')}
              data-testid="calendar-week-view-button"
            >
              Week
            </button>
            <button 
              className={`view-button ${view === 'month' ? 'active' : ''}`}
              onClick={() => setView('month')}
              data-testid="calendar-month-view-button"
            >
              Month
            </button>
          </div>
          <button className="nav-button" onClick={prevHandler} data-testid="calendar-prev-button">
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button className="today-button" onClick={todayHandler} data-testid="calendar-today-button">
            Today
          </button>
          <button className="nav-button" onClick={nextHandler} data-testid="calendar-next-button">
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button className="add-event-button" onClick={() => addEventHandler()} data-testid="calendar-add-event-button">
            <FontAwesomeIcon icon={faPlus} /> Add Event
          </button>
        </div>
      </div>
      {renderView()}
      
      {/* API Key Input section */}
      <ApiKeyInput onApiKeySubmit={(apiKey) => {
        // If apiKey is null, it means it was cleared
        if (apiKey === null) {
          setSyncStatus({
            status: 'info',
            message: 'API key has been cleared'
          });
        } else {
          setSyncStatus({
            status: 'success',
            message: 'API key updated successfully'
          });
        }
        
        // Reset status message after a delay
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      }} />
      
      {showModal && (
        <EventModal 
          onClose={closeModal}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onTriggerStudySuggestions={triggerStudySuggestions}
          event={selectedEvent}
          selectedDate={selectedDate}
        />
      )}
      {showPreparationPrompt && eventsNeedingPreparation.length > 0 && (
        <PreparationPrompt
          events={eventsNeedingPreparation}
          onSave={savePreparationHours}
          onClose={closePreparationPrompt}
          onDismiss={dismissPreparationPrompt}
        />
      )}
      {showStudySuggestions && studySuggestions.length > 0 && (
        <StudySuggestions
          suggestions={studySuggestions}
          onAccept={handleAcceptStudySuggestions}
          onReject={handleRejectStudySuggestions}
          onClose={() => setShowStudySuggestions(false)}
        />
      )}
    </div>
  );
};

export default Calendar;
