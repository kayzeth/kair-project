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

  const checkForEventsNeedingPreparation = useCallback(async () => {
    try {
      // Get study plan from nudger service using events array
      const studyPlan = await nudgerService.getStudyPlan(events);
      
      console.log('Study plan:', studyPlan);
      
      // Attach study plan to window object for global access
      window.studyPlan = studyPlan;
      
      if (studyPlan && studyPlan.events) {
        // Filter out events that have been dismissed and are not within 8 days
        const nonDismissedEvents = studyPlan.events.filter(event => {
          // Check if event is dismissed
          if (dismissedEvents[event.id]) return false;
          
          // Check if event needs preparation input
          if (!event.needsPreparationInput) return false;
          
          // Check if event is within 8 days
          return studySuggesterService.isEventWithin8Days(event);
        });
        
        if (nonDismissedEvents.length > 0) {
          setEventsNeedingPreparation(nonDismissedEvents);
          setShowPreparationPrompt(true);
        }
      }
    } catch (error) {
      console.error('Error checking for events needing preparation:', error);
    }
  }, [events, dismissedEvents]);

  useEffect(() => {
    if (events.length > 0 && userId) {
      checkForEventsNeedingPreparation();
    }
  }, [events, userId, checkForEventsNeedingPreparation]);

  const triggerStudySuggestions = async (event) => {
    // Check if the event requires preparation (regardless of hours value)
    if (event && event.requiresPreparation && event.preparationHours !== undefined) {
      try {
        // Check if the event is within 8 days
        const isWithin8Days = studySuggesterService.isEventWithin8Days(event);
        
        if (!isWithin8Days) {
          console.log('Event is more than 8 days away - not showing study suggestions yet');
          return;
        }
        
        console.log('Generating study suggestions for event:', event);
        
        // If hours is 0, show a message instead of generating suggestions
        if (Number(event.preparationHours) === 0) {
          console.log('No study time needed for this event');
          // Show a message to the user that no study time is needed
          setSyncStatus({
            status: 'success',
            message: 'Saved: No study time needed for this event'
          });
          
          setTimeout(() => {
            setSyncStatus({ status: 'idle', message: '' });
          }, 3000);
          
          return;
        }
        
        // Use userId instead of events array for database-driven approach
        const suggestions = await studySuggesterService.generateStudySuggestions(
          userId, 
          event, 
          Number(event.preparationHours)
        );
        
        if (suggestions && suggestions.length > 0) {
          setStudySuggestions(suggestions);
          setShowStudySuggestions(true);
        } else {
          console.log('No study suggestions generated');
        }
      } catch (error) {
        console.error('Error generating study suggestions:', error);
      }
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
      
      // Check if the event requires preparation and is within 2 weeks
      if (savedEvent.requiresPreparation) {
        // Check if event is within 2 weeks
        const isWithinTwoWeeks = isEventWithinTwoWeeks(savedEvent);
        
        // If the event has preparation hours (including 0) and is within 8 days, trigger study suggestions
        if (savedEvent.preparationHours !== undefined && savedEvent.preparationHours !== null && savedEvent.preparationHours !== '' && 
            studySuggesterService.isEventWithin8Days(savedEvent)) {
          console.log('Event has preparation hours and is within 8 days, triggering study suggestions');
          triggerStudySuggestions(savedEvent);
        }
        // If the event doesn't have preparation hours set yet and is within 2 weeks, show preparation prompt
        else if ((savedEvent.preparationHours === undefined || savedEvent.preparationHours === null || savedEvent.preparationHours === '') && 
                isWithinTwoWeeks) {
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
      }
      
      return savedEvent;
    } catch (error) {
      console.error('Error saving event:', error);
      return null;
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
      
      // Always trigger study suggestions when requiresPreparation is true,
      // even for 0 hours (which will show a message that no study time is needed)
      await triggerStudySuggestions(savedEvent);
      
      return savedEvent;
    } catch (error) {
      console.error('Error saving preparation hours:', error);
      return null;
    }
  };

  const deleteEvent = async (id) => {
    try {
      console.log('Deleting event with ID:', id);
      
      // Check if this is a study event (study events have IDs that start with "study-" or have isStudySession=true)
      const eventToDelete = events.find(event => event.id === id);
      const isStudyEvent = eventToDelete?.isStudySession || (id && typeof id === 'string' && id.startsWith('study-'));
      
      // First, update the UI immediately to provide instant feedback
      if (isStudyEvent) {
        // For study events, just remove that specific event
        setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
      } else {
        // For regular events, remove both the main event and all related study sessions
        setEvents(prevEvents => {
          // Find all study sessions related to this event for logging
          const relatedStudySessions = prevEvents.filter(event => 
            event.isStudySession && event.relatedEventId === id
          );
          
          if (relatedStudySessions.length > 0) {
            console.log(`Removing ${relatedStudySessions.length} study sessions from UI:`, 
              relatedStudySessions.map(s => s.id));
          }
          
          // Return the filtered events list
          return prevEvents.filter(event => 
            event.id !== id && !(event.isStudySession && event.relatedEventId === id)
          );
        });
      }
      
      // Close the modal immediately for better UX
      setShowModal(false);
      
      // Now handle the actual database operations
      if (isStudyEvent) {
        console.log('Deleting study event:', id);
        // Delete the study session from the database
        await eventService.deleteEvent(id);
        console.log('Study session deleted successfully');
      } else {
        // This is a regular event - first find any related study sessions
        console.log('Looking for study sessions related to event:', id);
        
        // Find study sessions in the current events state (before we filtered them out)
        const relatedStudySessions = events.filter(event => 
          event.isStudySession && event.relatedEventId === id
        );
        
        if (relatedStudySessions.length > 0) {
          console.log(`Found ${relatedStudySessions.length} related study sessions to delete:`, 
            relatedStudySessions.map(s => s.id));
          
          // Delete each related study session from the database
          const deletePromises = relatedStudySessions.map(studySession => {
            return eventService.deleteEvent(studySession.id)
              .then(() => console.log(`Deleted related study session: ${studySession.id}`))
              .catch(error => console.error(`Error deleting related study session ${studySession.id}:`, error));
          });
          
          // Wait for all study sessions to be deleted
          await Promise.all(deletePromises);
        } else {
          console.log('No related study sessions found in memory, checking database...');
          
          try {
            // Get all events for this user to ensure we have the latest data
            const allEvents = await eventService.getUserEvents(userId);
            
            // Filter for study sessions related to this event
            const dbRelatedSessions = allEvents.filter(event => 
              event.isStudySession && event.relatedEventId === id
            );
            
            if (dbRelatedSessions.length > 0) {
              console.log(`Found ${dbRelatedSessions.length} related study sessions in database`);
              
              // Delete each related study session from the database
              const deletePromises = dbRelatedSessions.map(studySession => {
                return eventService.deleteEvent(studySession.id)
                  .then(() => {
                    console.log(`Deleted related study session from database: ${studySession.id}`);
                    // Also ensure it's removed from the UI state
                    setEvents(prevEvents => prevEvents.filter(event => event.id !== studySession.id));
                  })
                  .catch(error => console.error(`Error deleting related study session ${studySession.id}:`, error));
              });
              
              // Wait for all study sessions to be deleted
              await Promise.all(deletePromises);
            } else {
              console.log('No related study sessions found in database');
            }
          } catch (error) {
            console.error('Error checking for related study sessions in database:', error);
          }
        }
        
        // Now delete the main event from the database
        await eventService.deleteEvent(id);
        console.log(`Deleted event ${id} and its related study sessions`);
        
        // Double-check that all related study sessions are removed from the UI
        setEvents(prevEvents => {
          const remainingStudySessions = prevEvents.filter(event => 
            event.isStudySession && event.relatedEventId === id
          );
          
          if (remainingStudySessions.length > 0) {
            console.log(`Found ${remainingStudySessions.length} remaining study sessions in UI, removing them now`);
            return prevEvents.filter(event => !(event.isStudySession && event.relatedEventId === id));
          }
          
          return prevEvents;
        });
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      
      // Show error message
      setSyncStatus({
        status: 'error',
        message: 'Error deleting event'
      });
      
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
    }
  };

  const handleAcceptStudySuggestions = async (acceptedSuggestions) => {
    try {
      console.log('Accepted study suggestions:', acceptedSuggestions);
      
      if (!userId) {
        console.error('No userId available for creating study events');
        setShowStudySuggestions(false);
        return;
      }
      
      // Create study events in the database with userId
      const createdEvents = await studySuggesterService.createAndSaveStudyEvents(acceptedSuggestions, userId);
      
      if (createdEvents && createdEvents.length > 0) {
        // Add the created events to the local state
        setEvents(prevEvents => [...prevEvents, ...createdEvents]);
        
        console.log('Study events created and saved to database:', createdEvents);
        
        // Show success message
        setSyncStatus({
          status: 'success',
          message: `Created ${createdEvents.length} study sessions`
        });
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      } else {
        console.log('No study events created');
        
        // Show error message
        setSyncStatus({
          status: 'error',
          message: 'Failed to create study sessions'
        });
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      }
      
      // Close the suggestions modal
      setShowStudySuggestions(false);
    } catch (error) {
      console.error('Error accepting study suggestions:', error);
      
      // Show error message
      setSyncStatus({
        status: 'error',
        message: 'Error creating study sessions'
      });
      
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
      
      // Close the modal even on error
      setShowStudySuggestions(false);
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

  // Helper function to check if an event is within 2 weeks
  const isEventWithinTwoWeeks = (event) => {
    try {
      // Get event start time
      const eventStart = event.start instanceof Date 
        ? new Date(event.start) 
        : new Date(event.start);
      
      // Get current time
      const now = new Date();
      
      // Calculate days until the event
      const daysUntilEvent = Math.ceil((eventStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if the event is within 2 weeks (14 days)
      return daysUntilEvent <= 14 && daysUntilEvent > 0;
    } catch (error) {
      console.error('Error checking if event is within 2 weeks:', error);
      return false;
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
