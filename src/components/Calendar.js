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
import eventService from '../services/eventService'; 
import '../styles/Calendar.css';
import '../styles/DayEventsPopup.css';

const Calendar = ({ initialEvents = [], userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', or 'day'
  const [events, setEvents] = useState([]); // Start with empty array, load from API
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  // eslint-disable-next-line no-unused-vars
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [showPreparationPrompt, setShowPreparationPrompt] = useState(false);
  const [eventsNeedingPreparation, setEventsNeedingPreparation] = useState([]);
  const [dismissedEvents, setDismissedEvents] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [viewDate, setViewDate] = useState(new Date());
  const [studySuggestions, setStudySuggestions] = useState([]);
  const [showStudySuggestions, setShowStudySuggestions] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    let newViewDate;
    
    if (view === 'day') {
      newViewDate = currentDate;
    } else if (view === 'week') {
      newViewDate = startOfWeek(currentDate);
    } else {
      newViewDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    }
    
    setViewDate(newViewDate);
  }, [currentDate, view]);

  const loadEvents = useCallback(async () => {
    if (!userId) {
      console.log('No userId provided, cannot load events');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const userEvents = await eventService.getUserEvents(userId);
      console.log('Loaded events from API:', userEvents.length);
      setEvents(userEvents);
    } catch (error) {
      console.error('Error loading events from API:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (initialEvents && initialEvents.length > 0 && userId) {
      console.log('Received initialEvents:', initialEvents.length);
    }
  }, [initialEvents, userId]);

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

  const checkGoogleCalendarConnection = useCallback(async () => {
    try {
      const isConnected = await googleCalendarService.isConnected();
      setIsGoogleCalendarConnected(isConnected);
      
      googleCalendarService.addSignInListener((isSignedIn) => {
        setIsGoogleCalendarConnected(isSignedIn);
      });
      
      if (isConnected) {
        try {
          setSyncStatus({ status: 'syncing', message: 'Syncing with Google Calendar...' });
          const importedEvents = await googleCalendarService.importEvents();
          setSyncStatus({ status: 'success', message: `Imported ${importedEvents.length} events from Google Calendar` });
          setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
          loadEvents(); // Reload events after import
        } catch (error) {
          console.error('Error importing events from Google Calendar:', error);
          setSyncStatus({ status: 'error', message: 'Failed to import events from Google Calendar' });
          setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
        }
      }
    } catch (error) {
      console.error('Error checking Google Calendar connection:', error);
    }
  }, [loadEvents]); // Removed viewDate as it's not used in this function

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
          checkGoogleCalendarConnection();
        }
      } catch (error) {
        console.error('Error checking Google Calendar connection:', error);
      }
    };
    
    checkGoogleCalendarConnection();
  }, [checkGoogleCalendarConnection]);

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

    const intervalId = setInterval(checkDismissedEvents, 60000);
    
    checkDismissedEvents();
    
    return () => clearInterval(intervalId);
  }, [dismissedEvents]);

  useEffect(() => {
    const studyPlan = nudgerService.getStudyPlan(events);
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
    try {
      console.log('Saving event with data:', eventData);
      console.log('Current user ID:', userId);
      
      // Ensure time properties are properly preserved
      const eventToSave = {
        ...eventData,
        // Preserve startTime and endTime properties if they exist
        startTime: eventData.startTime || (eventData.start instanceof Date ? format(eventData.start, 'HH:mm') : null),
        endTime: eventData.endTime || (eventData.end instanceof Date ? format(eventData.end, 'HH:mm') : null)
      };
      
      console.log('Event to save with preserved times:', {
        id: eventToSave.id,
        start: eventToSave.start,
        startTime: eventToSave.startTime,
        end: eventToSave.end,
        endTime: eventToSave.endTime
      });
      
      let savedEvent;
      
      if (eventToSave.id) {
        console.log('Updating existing event with ID:', eventToSave.id);
        savedEvent = await eventService.updateEvent(eventToSave.id, eventToSave);
        
        // Update events state with proper time handling
        setEvents(prevEvents => 
          prevEvents.map(event => {
            if (event.id === savedEvent.id) {
              // Ensure the updated event retains its time properties
              return {
                ...savedEvent,
                startTime: savedEvent.startTime || eventToSave.startTime,
                endTime: savedEvent.endTime || eventToSave.endTime
              };
            }
            return event;
          })
        );
        
        console.log('Updated event:', savedEvent);
      } else {
        console.log('Creating new event');
        savedEvent = await eventService.createEvent(eventToSave, userId);
        
        // Add to events state with proper time handling
        setEvents(prevEvents => [
          ...prevEvents, 
          {
            ...savedEvent,
            startTime: savedEvent.startTime || eventToSave.startTime,
            endTime: savedEvent.endTime || eventToSave.endTime
          }
        ]);
        
        console.log('Created new event:', savedEvent);
      }
      
      // Close the modal
      setShowModal(false);
      
      // Check if the event requires preparation
      if (savedEvent.requiresPreparation && !savedEvent.preparationHours) {
        // Add to events needing preparation
        setEventsNeedingPreparation(prev => {
          // Check if this event is already in the list
          if (!prev.some(e => e.id === savedEvent.id)) {
            return [...prev, savedEvent];
          }
          return prev;
        });
        
        // Show preparation prompt if not already showing
        if (!showPreparationPrompt) {
          setShowPreparationPrompt(true);
        }
      }
      
      return savedEvent;
    } catch (error) {
      console.error('Error saving event:', error);
      // You might want to show an error message to the user here
      return null;
    }
  };

  const deleteEvent = async (id) => {
    try {
      await eventService.deleteEvent(id);
      
      setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
      
      setShowModal(false);
      
      console.log('Event deleted successfully:', id);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const savePreparationHours = async (eventId, hours) => {
    try {
      const eventToUpdate = events.find(event => event.id === eventId);
      
      if (!eventToUpdate) {
        console.error('Event not found:', eventId);
        return;
      }
      
      const updatedEvent = {
        ...eventToUpdate,
        preparationHours: hours
      };
      
      const savedEvent = await eventService.updateEvent(eventId, updatedEvent);
      
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === savedEvent.id ? savedEvent : event
        )
      );
      
      setEventsNeedingPreparation(prev => 
        prev.filter(event => event.id !== eventId)
      );
      
      if (eventsNeedingPreparation.length <= 1) {
        setShowPreparationPrompt(false);
      }
      
      if (hours > 0) {
        await generateStudySuggestions(events, savedEvent, hours);
      }
      
      return savedEvent;
    } catch (error) {
      console.error('Error saving preparation hours:', error);
      return null;
    }
  };

  const generateStudySuggestions = async (allEvents, event, preparationHours) => {
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
        
        setSyncStatus({
          status: 'success',
          message: `Generated ${suggestions.length} study suggestions`
        });
      } else {
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
    
    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3000);
  };

  const handleAcceptStudySuggestions = async (acceptedSuggestions) => {
    try {
      console.log('Accepted study suggestions:', acceptedSuggestions);
      
      const createdEvents = [];
      
      for (const suggestion of acceptedSuggestions) {
        const eventData = {
          title: suggestion.title,
          start: suggestion.start,
          end: suggestion.end,
          allDay: false,
          description: suggestion.description || '',
          location: '',
          color: '#6a4c93', 
          requiresPreparation: false
        };
        
        const savedEvent = await eventService.createEvent(eventData, userId);
        createdEvents.push(savedEvent);
      }
      
      setEvents(prevEvents => [...prevEvents, ...createdEvents]);
      
      setShowStudySuggestions(false);
      setStudySuggestions([]);
      
      console.log('Created study session events:', createdEvents.length);
    } catch (error) {
      console.error('Error creating study session events:', error);
    }
  };

  const handleRejectStudySuggestions = () => {
    setShowStudySuggestions(false);
    setStudySuggestions([]);
  };

  const editEvent = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const dismissPreparationPrompt = (eventId) => {
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
