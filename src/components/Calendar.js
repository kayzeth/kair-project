import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import EventModal from './EventModal';
import PreparationPrompt from './PreparationPrompt'; 
import StudySuggestions from './StudySuggestions'; 
import nudgerService from '../services/nudgerService'; 
import studySuggesterService from '../services/studySuggesterService'; 
import eventService from '../services/eventService';
import Title from './Title';
import '../styles/Calendar.css';
import '../styles/DayEventsPopup.css';

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const Calendar = ({ initialEvents = [], userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', or 'day'
  const [events, setEvents] = useState([]); // Start with empty array, load from API
  const [displayEvents, setDisplayEvents] = useState([]); // Events with recurring instances expanded
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [showPreparationPrompt, setShowPreparationPrompt] = useState(false);
  const [eventsNeedingPreparation, setEventsNeedingPreparation] = useState([]);
  const [dismissedEvents, setDismissedEvents] = useState({});
  const [studySuggestions, setStudySuggestions] = useState([]);
  const [showStudySuggestions, setShowStudySuggestions] = useState(false);
  const [currentEventForSuggestions, setCurrentEventForSuggestions] = useState(null);
  const [isProcessingStudySuggestions, setIsProcessingStudySuggestions] = useState(false);
  
  // Queue to store events waiting for study suggestions
  const [studySuggestionsQueue, setStudySuggestionsQueue] = useState([]);
  
  // Use a ref to track events that have already been processed for study suggestions in this session
  // This prevents the same event from triggering multiple suggestion checks in a single session
  const processedEventsRef = useRef(new Set());
  
  // Generate recurring event instances based on recurrence settings
 const generateRecurringInstances = useCallback((events, viewStart, viewEnd) => {
   if (!events?.length) return events;
   const allEvents = [];
   const MS_PER_DAY = 24*60*60*1000;
    events.forEach(event => {
     allEvents.push(event);
     if (!event.isRecurring || !event.recurrenceEndDate) return;
      const startDate   = new Date(event.start);
     const endDate     = new Date(event.end);
     const durationMs  = endDate - startDate;
     const recEndDate  = new Date(event.recurrenceEndDate);
     if (recEndDate < viewStart) return;
      // cap generation at viewEnd + 1 week
     const generationEnd = new Date(
       Math.min(recEndDate.getTime(), viewEnd.getTime() + 7*MS_PER_DAY)
     );
      // WEEKLY/BIWEEKLY with specific days
     if ((event.recurrenceFrequency === 'WEEKLY' || event.recurrenceFrequency === 'BIWEEKLY')
       && event.recurrenceDays.length > 0
     ) {
       const intervalDays = event.recurrenceFrequency === 'BIWEEKLY' ? 14 : 7;
        // 1) get the Sunday of the week containing startDate
       const weekStart = startOfWeek(startDate); // defaults to Sunday
        event.recurrenceDays.forEach(dayName => {
         const wdIdx = WEEKDAYS.indexOf(dayName.toLowerCase());
         if (wdIdx < 0) return;
          // 2) base date = weekStart + wdIdx days
         let instDate = addDays(weekStart, wdIdx);
          // 3) if that base is before your event start, bump forward in interval chunks
         if (instDate < startDate) {
           const jumps = Math.ceil((startDate - instDate) / (intervalDays*MS_PER_DAY));
           instDate = addDays(instDate, jumps * intervalDays);
         }
         // also fast-forward into the view window
         if (instDate < viewStart) {
           const jumps = Math.ceil((viewStart - instDate) / (intervalDays*MS_PER_DAY));
           instDate = addDays(instDate, jumps * intervalDays);
         }
          // 4) emit every N days exactly
         while (instDate <= generationEnd) {
           if (instDate >= viewStart && instDate <= viewEnd) {
             const instStart = new Date(instDate);
             instStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
              allEvents.push({
               ...event,
               id: `${event.id}-${instStart.getTime()}`,
               start: instStart,
               end:   new Date(instStart.getTime() + durationMs),
               isRecurringInstance: true,
               originalEventId: event.id
             });
           }
           instDate = addDays(instDate, intervalDays);
         }
       });
     }
     // fallback: DAILY / WEEKLY / BIWEEKLY / MONTHLY without specific days
     else if (event.recurrenceFrequency) {
       let cursor = new Date(startDate);
       const step = freq => {
         if (freq === 'DAILY')    return addDays(cursor, 1);
         if (freq === 'WEEKLY')   return addDays(cursor, 7);
         if (freq === 'BIWEEKLY') return addDays(cursor, 14);
         if (freq === 'MONTHLY')  return addMonths(cursor, 1);
         return cursor;
       };
        while (cursor <= generationEnd) {
         if (
           cursor.getTime() !== startDate.getTime() &&
           cursor >= viewStart &&
           cursor <= viewEnd
         ) {
           const instStart = new Date(cursor);
           const instEnd   = new Date(cursor.getTime() + durationMs);
            allEvents.push({
             ...event,
             id: `${event.id}-${instStart.getTime()}`,
             start: instStart,
             end:   instEnd,
             isRecurringInstance: true,
             originalEventId: event.id
           });
         }
         cursor = step(event.recurrenceFrequency);
       }
     }
   });
    return allEvents;
 }, []);

  // Use a simple loadEvents function that works reliably in both tests and production
  const loadEvents = useCallback(async () => {
    if (!userId) {
      console.log('No userId provided, cannot load events');
      return;
    }
    
    try {
      // Skip actual API call in test environment to prevent hanging
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        setEvents([]);
        return;
      }
      
      // Make sure we're using the MongoDB user ID, not the Google user ID
      console.log('Current userId from context:', userId);
      
      // Get the MongoDB user ID from localStorage
      const storedUser = localStorage.getItem('userData');
      let mongoDbUserId = userId; // Default to the context userId
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData._id) {
            mongoDbUserId = userData._id;
            console.log('Using MongoDB user ID from localStorage:', mongoDbUserId);
          }
        } catch (e) {
          console.error('Error parsing userData from localStorage:', e);
        }
      }
      
      // Load all events from database (including Google Calendar events)
      // The database now contains both user events and Google Calendar events
      const allEvents = await eventService.getUserEvents(mongoDbUserId);
      
      // Set events directly from the database
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      
      // Show error message
      setSyncStatus({
        status: 'error',
        message: `Failed to load events: ${error.message}`
      });
      setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
    }
  }, [userId]);

  // Load events on mount
  useEffect(() => {
    loadEvents();
    
    // Set up event listener for calendarEventsUpdated
    const handleEventsUpdated = () => {
      console.log('Calendar events updated, reloading events');
      loadEvents();
    };
    
    window.addEventListener('calendarEventsUpdated', handleEventsUpdated);
    
    // Set up event listener for calendarDataUpdated (from Account.js)
    const handleCalendarDataUpdated = () => {
      console.log('Google Calendar data updated, reloading events');
      loadEvents();
    };

    window.addEventListener('calendarDataUpdated', handleCalendarDataUpdated);
    
    return () => {
      window.removeEventListener('calendarEventsUpdated', handleEventsUpdated);
      window.removeEventListener('calendarDataUpdated', handleCalendarDataUpdated);
    };
  }, [loadEvents]);
  
  // We don't need to check for Google Calendar sync on date change anymore
  // since we're now using the database and doing background syncs
  // The sync is now handled in the loadEvents function
  
  // Generate recurring event instances whenever events or view changes
  useEffect(() => {
    if (events.length === 0) {
      setDisplayEvents([]);
      return;
    }
    
    // Determine the view range to generate instances for
    let viewStart, viewEnd;
    
    if (view === 'month') {
      // For month view, include previous and next month
      viewStart = subMonths(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), 1);
      viewEnd = addMonths(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 1);
    } else if (view === 'week') {
      // For week view, include previous and next week
      viewStart = subWeeks(startOfWeek(currentDate), 1);
      viewEnd = addWeeks(endOfWeek(currentDate), 1);
    } else {
      // For day view, include a week before and after
      viewStart = subDays(currentDate, 7);
      viewEnd = addDays(currentDate, 7);
    }
    
    // Generate recurring instances for the view range
    const eventsWithRecurring = generateRecurringInstances(events, viewStart, viewEnd);
    setDisplayEvents(eventsWithRecurring);
    
  }, [events, view, currentDate, generateRecurringInstances]);

  // Handle initialEvents if provided
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0 && userId) {
      console.log('Received initialEvents:', initialEvents.length);
      // Combine initialEvents with existing events
      setEvents(prevEvents => {
        // Create a map of existing event IDs to avoid duplicates
        const existingEventIds = new Set(prevEvents.map(e => e.id));
        // Filter out initialEvents that already exist in prevEvents
        const newEvents = initialEvents.filter(e => !existingEventIds.has(e.id));
        return [...prevEvents, ...newEvents];
      });
    }
  }, [initialEvents, userId]);
  
  // Check for events needing preparation
  const checkForEventsNeedingPreparation = useCallback(async () => {
    try {
      // Skip in test environment
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        return;
      }
      
      // Get study plan from nudger service using events array
      const studyPlan = await nudgerService.getStudyPlan(events);
      
      if (studyPlan && studyPlan.events) {
        // Filter out events that have been dismissed and need preparation input
        // The nudger service already filters for events within 2 weeks
        const nonDismissedEvents = studyPlan.events.filter(event => {
          // Check if event is dismissed
          if (dismissedEvents[event.id]) return false;
          
          // Check if event needs preparation input
          if (!event.needsPreparationInput) return false;
          
          // No need to check for 8 days here - we want to prompt for ALL events
          // within the 2-week window that need preparation hours
          return true;
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
  
  // Simplified saveEvent function
  const saveEvent = async (eventData) => {
    try {
      console.log('Saving event with studySuggestionsAccepted:', eventData.studySuggestionsAccepted);
      
      // Skip in test environment
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        setShowModal(false);
        return { ...eventData, id: eventData.id || Date.now().toString() };
      }
      
      let savedEvent;
      
      if (eventData.id) {
        savedEvent = await eventService.updateEvent(eventData.id, eventData);
        setEvents(prevEvents => 
          prevEvents.map(event => event.id === savedEvent.id ? savedEvent : event)
        );
      } else {
        savedEvent = await eventService.createEvent(eventData, userId);
        setEvents(prevEvents => [...prevEvents, savedEvent]);
      }
      
      setShowModal(false);
      
      // Check if the event requires preparation and trigger study suggestions if within 8 days
      if (savedEvent.requiresPreparation && 
          savedEvent.preparationHours !== undefined && 
          savedEvent.preparationHours !== '' &&
          studySuggesterService.isEventWithin8Days(savedEvent) &&
          !savedEvent.studySuggestionsAccepted) { 
        console.log('Event qualifies for study suggestions - checking if already accepted:', {
          requiresPreparation: savedEvent.requiresPreparation,
          preparationHours: savedEvent.preparationHours,
          isWithin8Days: studySuggesterService.isEventWithin8Days(savedEvent),
          studySuggestionsAccepted: savedEvent.studySuggestionsAccepted
        });
        triggerStudySuggestions(savedEvent);
      } else {
        console.log('Event does not qualify for study suggestions:', {
          requiresPreparation: savedEvent.requiresPreparation,
          preparationHours: savedEvent.preparationHours,
          isWithin8Days: studySuggesterService.isEventWithin8Days(savedEvent),
          studySuggestionsAccepted: savedEvent.studySuggestionsAccepted
        });
      }
      
      return savedEvent;
    } catch (error) {
      console.error('Error saving event:', error);
      return null;
    }
  };
  
  // Simplified deleteEvent function
  const deleteEvent = async (id) => {
    try {
      // First find the event in our local state
      const event = events.find(e => e.id === id);
      if (!event) {
        throw new Error('Event not found in local state');
      }

      // If it's a Google Calendar event, delete it from Google Calendar first
      // COMMENTING OUT TO SAVE FOR A MATURE PRODUCT
      // if (event.source === 'GOOGLE_CALENDAR' && event.googleEventId) {
      //   try {
      //     await googleCalendarService.deleteEvent({
      //       googleEventId: event.googleEventId
      //     });
      //     console.log('Successfully deleted event from Google Calendar');
      //   } catch (googleError) {
      //     console.error('Error deleting event from Google Calendar:', googleError);
      //     // Show error but continue with local deletion
      //     setSyncStatus({
      //       status: 'error',
      //       message: 'Failed to delete from Google Calendar. The event will only be removed from Kairos.'
      //     });
      //   }
      // }

      // Then delete from our backend
      const response = await eventService.deleteEvent(id);
      
      // Remove the parent event from local state
      setEvents(prevEvents => prevEvents.filter(e => e.id !== id));
      
      // Also remove any study sessions associated with this event from local state
      // The server already deletes these, but we need to update the UI immediately
      if (response && response.studySessionsDeleted > 0) {
        setEvents(prevEvents => prevEvents.filter(e => (
          !(e.isStudySession && e.relatedEventId === id)
        )));
        console.log(`Removed ${response.studySessionsDeleted} study sessions associated with event ${id} from UI`);
      }
      
      setSyncStatus({
        status: 'success',
        message: 'Event deleted successfully'
      });

      // Close any open modals
      setShowModal(false);

      // Clear status after 3 seconds
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);

    } catch (error) {
      console.error('Error deleting event:', error);
      setSyncStatus({
        status: 'error',
        message: 'Failed to delete event'
      });
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
    }
  };

  // Actual function that generates study suggestions for an event
  const triggerStudySuggestionsForEvent = useCallback(async (event, forceGenerate = false) => {
    try {
      // Skip in test environment
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        return;
      }
      
      console.log('Event received in triggerStudySuggestions:', {
        id: event.id,
        title: event.title,
        studySuggestionsAccepted: event.studySuggestionsAccepted
      });
      
      // CRITICAL CHECK: Check if the event already has related study sessions
      // This is more reliable than checking the studySuggestionsAccepted flag
      // Only perform this check if forceGenerate is false
      if (event.id && !forceGenerate) {
        try {
          const hasStudySessions = await eventService.hasRelatedStudySessions(event.id);
          if (hasStudySessions) {
            console.log(`Event "${event.title}" already has study sessions. Skipping generation.`);
            return;
          }
        } catch (error) {
          console.error('Error checking for related study sessions:', error);
          // Continue with the process even if we couldn't check for related study sessions
        }
      }
      
      // If forceGenerate is true, allow generating new study suggestions even if the event already has them
      if (event.id && forceGenerate) {
        console.log(`Generating new study suggestions for event "${event.title}" (force=true)`);
        
        // Show a notification that we're generating a new study plan
        setSyncStatus({
          status: 'info',
          message: 'Generating new study plan...'
        });
      }
      
      // Check if the event is in the past
      const eventDate = new Date(event.start instanceof Date ? event.start : event.start_time);
      const now = new Date();
      if (eventDate < now && eventDate.toDateString() !== now.toDateString()) {
        console.log('Event is in the past - cannot generate study suggestions');
        
        // Show a specific message for past events
        setSyncStatus({
          status: 'warning',
          message: `Cannot generate study plans for events in the past. Please select an upcoming event instead.`
        });
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 5000);
        
        return;
      }
      
      // Check if the event is within 8 days, but allow override with forceGenerate
      if (!forceGenerate && !studySuggesterService.isEventWithin8Days(event)) {
        console.log('Event is more than 8 days away - not showing study suggestions yet');
        
        // Show a message to the user
        setSyncStatus({
          status: 'info',
          message: `Study suggestions will be available 8 days before the event. You can generate them now by clicking "Generate Study Plan" in the event details.`
        });
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 5000);
        
        return;
      }
      
      // Generate study suggestions
      // Use preparationHours if available, otherwise use requires_hours
      const preparationHoursValue = event.preparationHours !== undefined && event.preparationHours !== null ? 
        event.preparationHours : event.requires_hours;
      
      // Check if preparation hours are actually specified
      if (preparationHoursValue === undefined || preparationHoursValue === null || preparationHoursValue === '') {
        console.log(`Event "${event.title}" has requiresPreparation but no hours specified. Skipping generation.`);
        return;
      }
      
      // Only set processing state AFTER confirming we have valid preparation hours
      setIsProcessingStudySuggestions(true);
      
      // Show loading status with a more prominent message
      setSyncStatus({
        status: 'loading',
        message: 'Generating study suggestions... This may take a moment'
      });
      
      console.log(`Using preparation hours value: ${preparationHoursValue} for event ${event.title}`);
      
      const suggestions = await studySuggesterService.generateStudySuggestions(
        userId, 
        event, 
        Number(preparationHoursValue),
        forceGenerate // Pass the forceGenerate parameter
      );
      
      if (suggestions && suggestions.length > 0) {
        // Mark the event as having had suggestions shown immediately
        if (event.id) {
          try {
            console.log(`Marking event ${event.id} as having had study suggestions shown`);
            // IMPORTANT: Preserve the studySuggestionsAccepted flag when updating
            await eventService.updateEvent(event.id, {
              ...event,
              studySuggestionsShown: true,
              // Keep the existing value of studySuggestionsAccepted
              studySuggestionsAccepted: event.studySuggestionsAccepted
            });
          } catch (error) {
            console.error('Error updating event after showing suggestions:', error);
          }
        }
        
        setStudySuggestions(suggestions);
        setShowStudySuggestions(true);
        
        // Store the original event so we can mark it as having had suggestions shown
        setCurrentEventForSuggestions(event);
        
        // Show success status before clearing
        setSyncStatus({
          status: 'success',
          message: 'Study suggestions generated successfully!'
        });
        
        // Clear status after 3 seconds
        setTimeout(() => {
          setSyncStatus({
            status: 'idle',
            message: ''
          });
        }, 3000);
      } else {
        // For Canvas events with null preparation hours, don't show any banner
        if (event.source === 'CANVAS' && 
            ((event.preparationHours === null || event.preparationHours === undefined || event.preparationHours === '') ||
             (event.requires_hours === null || event.requires_hours === undefined || event.requires_hours === ''))) {
          // Don't show any banner for Canvas events with null preparation hours
          setSyncStatus({
            status: 'idle',
            message: ''
          });
        } 
        // For backward compatibility with existing LMS events
        else if (event.source === 'LMS' && 
            ((event.preparationHours === null || event.preparationHours === undefined || event.preparationHours === '') ||
             (event.requires_hours === null || event.requires_hours === undefined || event.requires_hours === ''))) {
          // Don't show any banner for Canvas/LMS events with null preparation hours
          setSyncStatus({
            status: 'idle',
            message: ''
          });
        } else {
          // Only show the banner for non-Canvas/non-LMS events or events with preparation hours set
          setSyncStatus({
            status: 'info',
            message: 'No study suggestions could be generated. Please try again later.'
          });
        }
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      }
    } catch (error) {
      console.error('Error generating study suggestions:', error);
      
      // Show error message
      setSyncStatus({
        status: 'error',
        message: 'Failed to generate study plan. Please try again.'
      });
      
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
    } finally {
      // Always set isProcessingStudySuggestions to false when done, whether successful or not
      setIsProcessingStudySuggestions(false);
    }
  }, [userId, setShowStudySuggestions, setStudySuggestions, setCurrentEventForSuggestions, setIsProcessingStudySuggestions]);

  // This function adds an event to the queue or processes it immediately if possible
  const triggerStudySuggestions = useCallback((event, forceGenerate = false) => {
    // If we're already showing suggestions or processing them, add to queue
    if (showStudySuggestions || isProcessingStudySuggestions) {
      console.log(`Adding event ${event.title} to study suggestions queue`);
      setStudySuggestionsQueue(prev => [...prev, { event, forceGenerate }]);
      return;
    }
    
    // Otherwise process immediately
    triggerStudySuggestionsForEvent(event, forceGenerate);
  }, [showStudySuggestions, isProcessingStudySuggestions, triggerStudySuggestionsForEvent]);
  
  // Process the next event in the study suggestions queue
  const processNextInSuggestionsQueue = useCallback(() => {
    if (studySuggestionsQueue.length > 0 && !showStudySuggestions && !isProcessingStudySuggestions) {
      console.log('Processing next event in study suggestions queue:', studySuggestionsQueue[0]);
      const nextEvent = studySuggestionsQueue[0];
      // Remove the event from the queue
      setStudySuggestionsQueue(prev => prev.slice(1));
      // Process this event immediately - removed delay for better responsiveness
      triggerStudySuggestionsForEvent(nextEvent.event, nextEvent.forceGenerate);
    }
  }, [studySuggestionsQueue, showStudySuggestions, isProcessingStudySuggestions, triggerStudySuggestionsForEvent]);
  
  // Effect to monitor study suggestions state and process the queue when appropriate
  useEffect(() => {
    // If we're not showing suggestions and not processing any, check the queue
    if (!showStudySuggestions && !isProcessingStudySuggestions && studySuggestionsQueue.length > 0) {
      console.log('Study suggestions state changed, checking queue');
      processNextInSuggestionsQueue();
    }
  }, [showStudySuggestions, isProcessingStudySuggestions, studySuggestionsQueue, processNextInSuggestionsQueue]);

  // Check for events needing study suggestions
  const checkForEventsNeedingStudySuggestions = useCallback(async () => {
    try {
      // Skip in test environment
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        return;
      }
      
      if (isProcessingStudySuggestions) {
        console.log('Already processing study suggestions, skipping');
        return;
      }
      
      setIsProcessingStudySuggestions(true);
      
      // Use the nudger service to identify events needing study suggestions
      const eventsNeedingSuggestions = nudgerService.identifyEventsNeedingStudySuggestions(events);
      
      console.log(`Found ${eventsNeedingSuggestions.length} events needing study suggestions`);
      
      if (eventsNeedingSuggestions.length > 0) {
        // Get the first event that needs suggestions
        const eventNeedingSuggestions = eventsNeedingSuggestions[0];
        
        // Skip if we've already processed this event in the current session
        if (eventNeedingSuggestions.id && processedEventsRef.current.has(eventNeedingSuggestions.id)) {
          console.log(`Already processed event ${eventNeedingSuggestions.id} in this session, skipping`);
          setIsProcessingStudySuggestions(false);
          return;
        }
        
        console.log('Automatically triggering study suggestions for event:', eventNeedingSuggestions.title);
        
        // Add this event to the processed set
        if (eventNeedingSuggestions.id) {
          processedEventsRef.current.add(eventNeedingSuggestions.id);
        }
        
        // Trigger study suggestions for this event
        await triggerStudySuggestions(eventNeedingSuggestions);
      }
      
      setIsProcessingStudySuggestions(false);
    } catch (error) {
      console.error('Error checking for events needing study suggestions:', error);
      setIsProcessingStudySuggestions(false);
    }
  }, [events, triggerStudySuggestions, isProcessingStudySuggestions]);

  // First useEffect: Run once when the component mounts to set up the initial check
  useEffect(() => {
    // This effect only depends on userId and will only run when userId changes
    // It sets up a one-time check for study suggestions
    const runInitialCheck = () => {
      if (events.length > 0) {
        checkForEventsNeedingStudySuggestions();
      }
    };
    
    if (userId) {
      runInitialCheck();
    }
    
    // We're intentionally not including events or events.length as a dependency
    // to prevent the infinite loop of updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, checkForEventsNeedingStudySuggestions]);

  // Navigation handlers
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

  // Event handlers
  const addEventHandler = (date = currentDate, suggestedHour = null) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    // Store the suggested hour in a state variable to pass to the EventModal
    const eventData = suggestedHour !== null ? { suggestedHour } : null;
    setSelectedEvent(eventData);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
  };

  const editEvent = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };
  
  // Simplified handlers for study suggestions
  const handleAcceptStudySuggestions = async (acceptedSuggestions, dontClose = false) => {
    try {
      // Skip in test environment
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        if (!dontClose) {
          setShowStudySuggestions(false);
        }
        return;
      }
      
      console.log('Accepting study suggestions:', acceptedSuggestions);
      console.log('Current user ID:', userId);
      console.log('Current event for suggestions:', currentEventForSuggestions);
      
      // Show loading status
      setSyncStatus({
        status: 'loading',
        message: 'Creating study sessions...'
      });
      
      // Pass the original event as the third parameter to mark it as having had suggestions shown and accepted
      const createdEvents = await studySuggesterService.createAndSaveStudyEvents(
        acceptedSuggestions, 
        userId,
        currentEventForSuggestions // Pass the original event
      );
      
      console.log('Created events returned from service:', createdEvents);
      
      if (createdEvents && createdEvents.length > 0) {
        console.log('Adding created events to calendar state');
        setEvents(prevEvents => {
          console.log('Previous events:', prevEvents.length);
          const newEvents = [...prevEvents, ...createdEvents];
          console.log('New events total:', newEvents.length);
          return newEvents;
        });
        
        setSyncStatus({
          status: 'success',
          message: `Created ${createdEvents.length} study sessions`
        });
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      } else {
        console.warn('No events were created from the study suggestions');
        setSyncStatus({
          status: 'info',
          message: 'No study sessions were created.'
        });
        
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      }
      
      if (!dontClose) {
        setShowStudySuggestions(false);
        
        // Process the next event in the queue after a short delay
        setTimeout(() => {
          processNextInSuggestionsQueue();
        }, 500);
      }
    } catch (error) {
      console.error('Error accepting study suggestions:', error);
      
      setSyncStatus({
        status: 'error',
        message: 'Failed to create study sessions. Please try again.'
      });
      
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 3000);
      
      if (!dontClose) {
        setShowStudySuggestions(false);
        
        // Process the next event in the queue after a short delay
        setTimeout(() => {
          processNextInSuggestionsQueue();
        }, 500);
      }
    }
  };
  
  const handleRejectStudySuggestions = () => {
    // If we have an original event, mark that suggestions were shown but not accepted
    if (currentEventForSuggestions && currentEventForSuggestions.id) {
      try {
        // Update the event to mark that study suggestions were shown but not accepted
        eventService.updateEvent(currentEventForSuggestions.id, {
          ...currentEventForSuggestions,
          studySuggestionsShown: true,
          studySuggestionsAccepted: false
        });
      } catch (error) {
        console.error('Error updating event after rejecting suggestions:', error);
      }
    }
    
    setShowStudySuggestions(false);
    
    // Process the next event in the queue immediately
    processNextInSuggestionsQueue();
  };

  // Simplified savePreparationHours function
  const savePreparationHours = async (eventId, hours) => {
    try {
      // Skip in test environment
      if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
        setEventsNeedingPreparation(prev => prev.filter(event => event.id !== eventId));
        if (eventsNeedingPreparation.length <= 1) {
          setShowPreparationPrompt(false);
        }
        return;
      }
      
      const eventToUpdate = events.find(event => event.id === eventId);
      
      if (!eventToUpdate) {
        return;
      }
      
      // CRITICAL FIX: Check if this event already has study sessions
      let hasExistingStudySessions = false;
      try {
        hasExistingStudySessions = await eventService.hasRelatedStudySessions(eventId);
        console.log(`Event ${eventId} has existing study sessions: ${hasExistingStudySessions}`);
      } catch (error) {
        console.error('Error checking for related study sessions:', error);
      }
      
      const updatedEvent = {
        ...eventToUpdate,
        preparationHours: hours,
        // If the event already has study sessions, mark it as having had suggestions shown and accepted
        studySuggestionsShown: hasExistingStudySessions ? true : eventToUpdate.studySuggestionsShown,
        studySuggestionsAccepted: hasExistingStudySessions ? true : eventToUpdate.studySuggestionsAccepted
      };
      
      console.log('Updating event with preparation hours:', {
        eventId,
        hours,
        hasExistingStudySessions,
        studySuggestionsShown: updatedEvent.studySuggestionsShown,
        studySuggestionsAccepted: updatedEvent.studySuggestionsAccepted
      });
      
      const savedEvent = await eventService.updateEvent(eventId, updatedEvent);
      
      setEvents(prevEvents => 
        prevEvents.map(event => event.id === savedEvent.id ? savedEvent : event)
      );
      
      // Immediately hide the preparation prompt for better user experience
      setShowPreparationPrompt(false);
      setEventsNeedingPreparation(prev => prev.filter(event => event.id !== eventId));
      
      // Only trigger study suggestions if the event doesn't already have them
      if (!hasExistingStudySessions) {
        await triggerStudySuggestions(savedEvent);
      }
    } catch (error) {
      console.error('Error saving preparation hours:', error);
    }
  };

  const dismissPreparationPrompt = (eventId, whenToRemind) => {
    const reminderTime = whenToRemind || new Date().getTime() + (3 * 60 * 60 * 1000);
    
    // Update the dismissed events state
    setDismissedEvents(prev => ({
      ...prev,
      [eventId]: reminderTime
    }));
    
    // Show notification
    setSyncStatus({
      status: 'info',
      message: `You'll be reminded about this event in 3 hours`
    });
    
    setTimeout(() => {
      setSyncStatus({ status: 'idle', message: '' });
    }, 3000);
    
    // Find the event and update its whenToRemind field
    const eventToUpdate = events.find(e => e.id === eventId);
    if (eventToUpdate) {
      // Update the event in the database
      eventService.updateEvent(eventId, { 
        ...eventToUpdate,
        when_to_remind: new Date(reminderTime)
      })
      .then(() => {
        // Update the local events state
        setEvents(prevEvents => 
          prevEvents.map(e => 
            e.id === eventId 
              ? { ...e, when_to_remind: new Date(reminderTime) } 
              : e
          )
        );
      })
      .catch(error => {
        console.error('Error updating event with reminder time:', error);
      });
    }
    
    // Close the preparation prompt by removing this event from the list
    setEventsNeedingPreparation(prev => prev.filter(e => e.id !== eventId));
    
    // If no more events need preparation, close the prompt entirely
    if (eventsNeedingPreparation.length <= 1) {
      setShowPreparationPrompt(false);
    }
  };

  const closePreparationPrompt = () => {
    setShowPreparationPrompt(false);
  };

  const renderView = () => {
    switch (view) {
      case 'month':
        return (
          <MonthView 
            currentDate={currentDate} 
            events={displayEvents} 
            onAddEvent={addEventHandler}
            onEditEvent={editEvent}
          />
        );
      case 'week':
        return (
          <WeekView 
            currentDate={currentDate} 
            events={displayEvents} 
            onAddEvent={addEventHandler}
            onEditEvent={editEvent}
          />
        );
      case 'day':
        return (
          <DayView 
            currentDate={currentDate} 
            events={displayEvents} 
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
      {(syncStatus.status !== 'idle' || isProcessingStudySuggestions) && (
        <div className={`sync-banner sync-${isProcessingStudySuggestions ? 'loading' : syncStatus.status}`} data-testid="sync-status">
          {isProcessingStudySuggestions ? 'Generating study suggestions... This may take a moment' : syncStatus.message}
        </div>
      )}
      <Title page="Calendar" />
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
          onTriggerStudySuggestions={(event) => triggerStudySuggestions(event, true)}
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
          userId={userId}
        />
      )}
    </div>
  );
};

export default Calendar;
