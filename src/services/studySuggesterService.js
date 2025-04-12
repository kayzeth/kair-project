/**
 * Study Suggester Service - KAIR-35, KAIR-41
 * 
 * This service generates intelligent study session suggestions based on 
 * events that require preparation and the preparation hours specified by the user.
 * 
 * Enhanced with Google Gemini AI for smarter suggestions.
 */

import { 
  addDays, 
  format, 
  isSameDay
} from 'date-fns';

import * as geminiService from './geminiService';

/**
 * Study session suggestion object
 * @typedef {Object} StudySessionSuggestion
 * @property {Object} event - The original event that needs preparation
 * @property {Date} suggestedStartTime - Suggested start time for the study session
 * @property {Date} suggestedEndTime - Suggested end time for the study session
 * @property {string} message - Message explaining the suggestion
 * @property {string} priority - Priority level: 'high', 'medium', or 'low'
 */

/**
 * Generates study session suggestions for events that require preparation
 * @param {string|Array} eventsOrUserId - Either an array of calendar events or a userId
 * @param {Object} event - The event that needs preparation
 * @param {number} preparationHours - Total hours needed for preparation
 * @param {boolean} forceGeneration - Force generation even if event is more than 8 days away
 * @returns {Promise<Array<StudySessionSuggestion>>} - Array of study session suggestions
 */
export const generateStudySuggestions = async (eventsOrUserId, event, preparationHours, forceGeneration = false) => {
  try {
    // Check if the first parameter is a userId (string) or events array
    const isUserId = typeof eventsOrUserId === 'string';
    
    // Log what we're doing
    if (isUserId) {
      console.log(`Generating study suggestions for user ${eventsOrUserId} and event ${event.id || 'new event'}`);
    } else {
      console.log(`Generating study suggestions with ${eventsOrUserId.length} events for event ${event.id || 'new event'}`);
    }

    // Validate preparation hours - ensure it's a positive number
    const validPreparationHours = Number(preparationHours);
    if (isNaN(validPreparationHours) || validPreparationHours <= 0) {
      console.log(`Invalid preparation hours (${preparationHours}). Must be a positive number. Skipping suggestions.`);
      return [];
    }

    // Check if the event is within 8 days or if we should force generation
    const isWithin8Days = isEventWithin8Days(event);
    const shouldGenerateSuggestions = isWithin8Days || forceGeneration;

    // If the event is not within 8 days and we're not forcing generation, return empty array
    if (!shouldGenerateSuggestions) {
      console.log(`Event is more than 8 days away and force generation is not enabled. Skipping suggestions.`);
      return [];
    }

    // If suggestions have already been shown or accepted and not forcing, don't generate again
    if ((event.studySuggestionsShown || event.studySuggestionsAccepted) && !forceGeneration) {
      console.log(`Study suggestions have already been shown or accepted for this event. Skipping generation.`);
      console.log(`studySuggestionsShown: ${event.studySuggestionsShown}, studySuggestionsAccepted: ${event.studySuggestionsAccepted}`);
      return [];
    }
    
    // Even if force generation is enabled, never generate suggestions for events that already have accepted suggestions
    if (event.studySuggestionsAccepted) {
      console.log(`Study suggestions have already been accepted for this event. Skipping generation regardless of force setting.`);
      return [];
    }
    
    // First try to use the Gemini API for smart suggestions
    const smartSuggestions = await geminiService.generateSmartStudySuggestions(eventsOrUserId, event, preparationHours);
    
    // If we got valid suggestions from Gemini, use them
    if (smartSuggestions && smartSuggestions.length > 0) {
      console.log('Using Gemini AI for enhanced study suggestions');
      return smartSuggestions;
    } else {
      // If Gemini returned no suggestions, fall back to local algorithm
      console.log('Gemini returned no suggestions, using enhanced local algorithm...');
      
      // For the fallback algorithm, we need an events array
      // If we were given a userId, we'll just use an empty array for now
      // In a real implementation, we would fetch events for this user from the database
      const events = Array.isArray(eventsOrUserId) ? eventsOrUserId : [];
      
      return generateFallbackStudySuggestions(events, event, preparationHours);
    }
  } catch (error) {
    // If there was an error with Gemini, fall back to local algorithm
    console.error('Error with Gemini API, falling back to local algorithm:', error);
    console.log('Using enhanced local algorithm');
    
    // For the fallback algorithm, we need an events array
    // If we were given a userId, we'll just use an empty array for now
    const events = Array.isArray(eventsOrUserId) ? eventsOrUserId : [];
    
    return generateFallbackStudySuggestions(events, event, preparationHours);
  }
};

/**
 * Fallback method to generate study suggestions using the original algorithm
 * @param {Array} events - All calendar events
 * @param {Object} targetEvent - The event that needs preparation
 * @param {number} preparationHours - Total hours needed for preparation
 * @returns {Array<StudySessionSuggestion>} - Array of study session suggestions
 */
const generateFallbackStudySuggestions = (events, targetEvent, preparationHours) => {
  try {
    console.log('Generating fallback study suggestions...');
    
    // Current time as reference point
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour buffer
    
    // Get target event start time
    const targetEventStart = targetEvent.start instanceof Date 
      ? new Date(targetEvent.start) 
      : new Date(targetEvent.start);
    
    // Check if the event is too soon (less than 24 hours away)
    const isTooSoon = (targetEventStart.getTime() - now.getTime()) < (24 * 60 * 60 * 1000);
    if (isTooSoon) {
      console.log('Event is too soon for study suggestions (less than 24 hours away)');
      return [];
    }
    
    // Calculate days until the event
    const daysUntilEvent = Math.ceil((targetEventStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log('Days until event:', daysUntilEvent);
    
    // Analyze event title to determine event type
    const eventTitle = targetEvent.title || '';
    const eventDescription = targetEvent.description || '';
    const combinedText = `${eventTitle} ${eventDescription}`.toLowerCase();
    
    // Determine event type based on keywords in title and description
    let eventType = 'general';
    if (/\b(exam|test|midterm|final|quiz)\b/.test(combinedText)) {
      eventType = 'exam';
    } else if (/\b(homework|assignment|problem set|pset|exercise)\b/.test(combinedText)) {
      eventType = 'homework';
    } else if (/\b(project|presentation|paper|essay|report)\b/.test(combinedText)) {
      eventType = 'project';
    }
    
    console.log('Detected event type:', eventType);
    
    // Create a date array for all days between now and the event
    const availableDates = [];
    for (let i = 0; i < daysUntilEvent; i++) {
      const date = addDays(now, i);
      availableDates.push(date);
    }
    
    // CRITICAL CHANGE: Reverse the dates array to prioritize dates closer to the event
    availableDates.reverse();
    
    // Find available time slots on each day
    const availableSlots = [];
    
    availableDates.forEach(date => {
      // Start at 8 AM
      const dayStart = new Date(date);
      dayStart.setHours(8, 0, 0, 0);
      
      // End at 10 PM
      const dayEnd = new Date(date);
      dayEnd.setHours(22, 0, 0, 0);
      
      // Skip if day is already in the past
      if (dayStart < bufferTime) {
        // If it's today, start from buffer time (now + 1 hour)
        if (isSameDay(dayStart, bufferTime)) {
          // Round buffer time to nearest hour and add 1 hour
          const roundedBufferTime = new Date(bufferTime);
          roundedBufferTime.setMinutes(0, 0, 0);
          roundedBufferTime.setHours(roundedBufferTime.getHours() + 1);
          
          // Only proceed if we still have time today
          if (roundedBufferTime < dayEnd) {
            // Find available slots for today
            findAvailableSlotsForDay(roundedBufferTime, dayEnd, events, availableSlots);
          }
        }
        return;
      }
      
      // Find available slots for this day
      findAvailableSlotsForDay(dayStart, dayEnd, events, availableSlots);
    });
    
    // Calculate how many days we want to distribute study sessions across
    // Different strategies based on event type
    let distributionDays;
    
    if (eventType === 'exam' || eventType === 'quiz') {
      // For exams/quizzes: Start a bit earlier, still following the half rule
      distributionDays = Math.max(1, Math.min(daysUntilEvent, Math.floor(preparationHours / 2)));
      // Ensure at least 2 days for exams if possible (day before + earlier study)
      if (preparationHours >= 2 && daysUntilEvent >= 2) {
        distributionDays = Math.max(2, distributionDays);
      }
    } else {
      // For homework/essays/projects: Focus on days immediately before due date
      // For shorter assignments (1-2 hours), just do it on the due date if possible
      if (preparationHours <= 2 && daysUntilEvent >= 1) {
        distributionDays = 1; // Just the day before
      } else {
        // For longer assignments, use fewer days than the half rule
        distributionDays = Math.max(1, Math.min(daysUntilEvent, Math.ceil(preparationHours / 3)));
      }
    }
    
    // Ensure we have at least 1 distribution day, but not more than days until event
    distributionDays = Math.min(daysUntilEvent, Math.max(1, distributionDays));
    
    console.log(`Distributing ${preparationHours} hours across ${distributionDays} days for ${eventType} type event`);
    
    // Calculate the ideal distribution of study time across days
    const idealDistribution = [];
    
    // For days very close to the event (last 3 days), allocate more time
    const lastThreeDays = Math.min(3, daysUntilEvent);
    let remainingHours = preparationHours;
    let remainingDays = distributionDays;
    
    // Different distribution strategies based on event type
    if (eventType === 'exam' || eventType === 'quiz') {
      // For exams/quizzes: Distribute with more focus on day before, but ensure earlier study too
      
      // Allocate time for the last three days (or fewer if event is sooner)
      for (let i = 0; i < lastThreeDays; i++) {
        let dayAllocation;
        
        if (i === 0) { // Day before exam
          // Allocate 40% of time for day before exam
          dayAllocation = Math.min(remainingHours, preparationHours * 0.4);
        } else if (i === 1) { // Two days before exam
          // Allocate 30% of time for two days before exam
          dayAllocation = Math.min(remainingHours, preparationHours * 0.3);
        } else { // Three days before exam
          // Allocate 20% of time for three days before exam
          dayAllocation = Math.min(remainingHours, preparationHours * 0.2);
        }
        
        idealDistribution.push({
          day: i,
          hours: dayAllocation
        });
        
        remainingHours -= dayAllocation;
        remainingDays--;
      }
      
      // Distribute remaining hours evenly across remaining days (if any)
      if (remainingDays > 0 && remainingHours > 0) {
        const hoursPerDay = remainingHours / remainingDays;
        
        for (let i = lastThreeDays; i < distributionDays; i++) {
          idealDistribution.push({
            day: i,
            hours: hoursPerDay
          });
        }
      }
    } else {
      // For homework/essays/projects: Concentrate on days immediately before due date
      
      // Allocate time for the last three days (or fewer if event is sooner)
      for (let i = 0; i < lastThreeDays && i < distributionDays; i++) {
        let dayAllocation;
        
        if (i === 0) { // Day before due date
          // For homework, allocate 60% of time for day before/due date
          dayAllocation = Math.min(remainingHours, preparationHours * 0.6);
        } else if (i === 1) { // Two days before due date
          // Allocate 25% of time for two days before
          dayAllocation = Math.min(remainingHours, preparationHours * 0.25);
        } else { // Three days before due date
          // Allocate 10% of time for three days before
          dayAllocation = Math.min(remainingHours, preparationHours * 0.1);
        }
        
        idealDistribution.push({
          day: i,
          hours: dayAllocation
        });
        
        remainingHours -= dayAllocation;
        remainingDays--;
      }
      
      // Distribute remaining hours evenly across remaining days (if any)
      if (remainingDays > 0 && remainingHours > 0) {
        const hoursPerDay = remainingHours / remainingDays;
        
        for (let i = lastThreeDays; i < distributionDays; i++) {
          idealDistribution.push({
            day: i,
            hours: hoursPerDay
          });
        }
      }
    }
    
    // Sort by day (closest to event first)
    idealDistribution.sort((a, b) => a.day - b.day);
    
    // Log the ideal distribution
    console.log('Ideal distribution:', idealDistribution);
    
    // Create study suggestions based on the ideal distribution
    const studySuggestions = [];
    
    // For each day in the ideal distribution
    for (let i = 0; i < idealDistribution.length; i++) {
      const dayDistribution = idealDistribution[i];
      const dayIndex = dayDistribution.day;
      const hoursForDay = dayDistribution.hours;
      
      // Skip if no hours allocated for this day
      if (hoursForDay <= 0) continue;
      
      // Get the date for this day (days from event, counting backwards)
      const studyDate = new Date(targetEventStart);
      studyDate.setDate(studyDate.getDate() - (dayIndex + 1));
      
      // Find available slots for this day
      const slotsForDay = availableSlots.filter(slot => 
        isSameDay(slot.start, studyDate)
      );
      
      // If no slots available for this day, try to redistribute to other days
      if (slotsForDay.length === 0) {
        console.log(`No available slots for day ${dayIndex}, redistributing hours`);
        
        // Find the next day with available slots
        let redistributedDay = -1;
        for (let j = 0; j < idealDistribution.length; j++) {
          if (j === i) continue; // Skip current day
          
          const otherDayIndex = idealDistribution[j].day;
          const otherStudyDate = new Date(targetEventStart);
          otherStudyDate.setDate(otherStudyDate.getDate() - (otherDayIndex + 1));
          
          const otherDaySlots = availableSlots.filter(slot => 
            isSameDay(slot.start, otherStudyDate)
          );
          
          if (otherDaySlots.length > 0) {
            redistributedDay = j;
            break;
          }
        }
        
        // If found a day to redistribute to, add the hours to that day
        if (redistributedDay !== -1) {
          idealDistribution[redistributedDay].hours += hoursForDay;
          console.log(`Redistributed ${hoursForDay} hours to day ${idealDistribution[redistributedDay].day}`);
        }
        
        continue;
      }
      
      // Calculate how many minutes we need for this day
      let minutesNeeded = Math.round(hoursForDay * 60);
      
      // Round to the nearest 15 minutes
      minutesNeeded = Math.ceil(minutesNeeded / 15) * 15;
      
      console.log(`Need ${minutesNeeded} minutes for day ${dayIndex}`);
      
      // Sort slots by duration (longest first) to optimize slot usage
      slotsForDay.sort((a, b) => 
        (b.end - b.start) - (a.end - a.start)
      );
      
      // Try to create optimal study sessions
      let remainingMinutes = minutesNeeded;
      
      // Different session length strategies based on event type and proximity
      let minSessionLength = 30; // Minimum 30 minutes
      let maxSessionLength = 180; // Maximum 3 hours
      let preferredSessionLength;
      
      if (eventType === 'exam' || eventType === 'quiz') {
        // For exams: Longer sessions closer to the exam
        if (dayIndex === 0) { // Day before exam
          // Prefer longer sessions (2-5 hours) on day before exam
          preferredSessionLength = Math.min(300, Math.max(120, minutesNeeded));
          maxSessionLength = 300; // Allow up to 5 hours on day before
        } else if (dayIndex === 1) { // Two days before exam
          // Medium length sessions (1.5-3 hours)
          preferredSessionLength = Math.min(180, Math.max(90, minutesNeeded));
        } else {
          // Shorter sessions (1-2 hours) earlier
          preferredSessionLength = Math.min(120, Math.max(60, minutesNeeded));
        }
      } else {
        // For homework/projects: Longer sessions on due date
        if (dayIndex === 0) { // Day before due date
          // Prefer longer sessions (2-4 hours) to complete work
          preferredSessionLength = Math.min(240, Math.max(120, minutesNeeded));
          maxSessionLength = 240; // Allow up to 4 hours on day before
        } else {
          // Shorter sessions (1-2 hours) earlier
          preferredSessionLength = Math.min(120, Math.max(60, minutesNeeded));
        }
      }
      
      console.log(`Preferred session length for day ${dayIndex}: ${preferredSessionLength} minutes`);
      
      // Try to find slots that can accommodate our preferred session length
      const usableSlots = slotsForDay.filter(slot => {
        const durationMinutes = (slot.end - slot.start) / (1000 * 60);
        return durationMinutes >= minSessionLength;
      });
      
      if (usableSlots.length === 0) {
        console.log(`No usable slots of at least ${minSessionLength} minutes for day ${dayIndex}`);
        continue;
      }
      
      // Create study sessions
      while (remainingMinutes > 0 && usableSlots.length > 0) {
        // Get the first available slot
        const slot = usableSlots[0];
        
        // Calculate how many minutes we can use from this slot
        const slotDurationMinutes = (slot.end - slot.start) / (1000 * 60);
        
        // Determine session length based on remaining minutes and slot availability
        let sessionLength = Math.min(
          remainingMinutes, 
          slotDurationMinutes, 
          preferredSessionLength, 
          maxSessionLength
        );
        
        // Ensure session is at least minimum length
        if (sessionLength < minSessionLength) {
          // If we can't fit a minimum session, use all remaining minutes if it's the last bit
          if (remainingMinutes <= minSessionLength && sessionLength === remainingMinutes) {
            // This is fine, use what's left
          } else {
            // Skip this slot, it's too small
            usableSlots.shift();
            continue;
          }
        }
        
        // Round to nearest 15 minutes
        sessionLength = Math.floor(sessionLength / 15) * 15;
        
        // Create start and end times for the session
        const sessionStart = new Date(slot.start);
        const sessionEnd = new Date(sessionStart);
        sessionEnd.setMinutes(sessionEnd.getMinutes() + sessionLength);
        
        // Create a message based on event type and proximity
        let message;
        
        if (eventType === 'exam' || eventType === 'quiz') {
          if (dayIndex === 0) {
            message = `Final review for ${targetEvent.title}`;
          } else if (dayIndex === 1) {
            message = `Practice problems for ${targetEvent.title}`;
          } else {
            message = `Study concepts for ${targetEvent.title}`;
          }
        } else if (eventType === 'homework') {
          if (dayIndex === 0) {
            message = `Complete ${targetEvent.title}`;
          } else if (dayIndex === 1) {
            message = `Work on ${targetEvent.title}`;
          } else {
            message = `Start working on ${targetEvent.title}`;
          }
        } else if (eventType === 'project') {
          if (dayIndex === 0) {
            message = `Finalize ${targetEvent.title}`;
          } else if (dayIndex === 1) {
            message = `Work on ${targetEvent.title}`;
          } else {
            message = `Begin ${targetEvent.title}`;
          }
        } else {
          message = `Study for ${targetEvent.title}`;
        }
        
        // Add the study suggestion
        studySuggestions.push({
          event: targetEvent,
          suggestedStartTime: sessionStart,
          suggestedEndTime: sessionEnd,
          message: message,
          priority: dayIndex === 0 ? 'high' : (dayIndex === 1 ? 'medium' : 'low')
        });
        
        // Update the slot's start time
        slot.start = sessionEnd;
        
        // Reduce remaining minutes
        remainingMinutes -= sessionLength;
        
        // If the slot is now too small, remove it
        const remainingSlotDuration = (slot.end - slot.start) / (1000 * 60);
        if (remainingSlotDuration < minSessionLength) {
          usableSlots.shift();
        }
      }
    }
    
    // Sort suggestions by start time
    studySuggestions.sort((a, b) => 
      new Date(a.suggestedStartTime) - new Date(b.suggestedStartTime)
    );
    
    return studySuggestions;
  } catch (error) {
    console.error('Error in fallback study suggestions:', error);
    return [];
  }
};

/**
 * Finds available time slots for a specific day
 * @param {Date} dayStart - Start time of the day
 * @param {Date} dayEnd - End time of the day
 * @param {Array} events - All calendar events
 * @param {Array} availableSlots - Array to store available slots
 */
const findAvailableSlotsForDay = (dayStart, dayEnd, events, availableSlots) => {
  // Ensure events is an array
  if (!events || !Array.isArray(events)) {
    console.warn('findAvailableSlotsForDay: No events provided or invalid events format');
    // If no events, the entire day is available
    availableSlots.push({
      start: dayStart,
      end: dayEnd
    });
    return;
  }

  // Get events for this day
  const eventsForDay = events.filter(event => {
    const eventStart = event.start instanceof Date ? new Date(event.start) : new Date(event.start);
    return isSameDay(eventStart, dayStart);
  });
  
  // If no events, the entire day is available
  if (eventsForDay.length === 0) {
    availableSlots.push({
      start: dayStart,
      end: dayEnd
    });
    return;
  }
  
  // Convert events to time ranges
  const busyRanges = [];
  
  eventsForDay.forEach(event => {
    // Skip study sessions (to avoid conflicts with our own suggestions)
    if (event.isStudySession) return;
    
    let eventStart, eventEnd;
    
    if (event.allDay) {
      // For all-day events, block the entire day
      // NOTE: We're actually not blocking all-day events completely
      // This is because they often represent deadlines rather than actual busy time
      // Instead, we'll just note them but still allow study time
      return;
    } else {
      // For timed events, use the specific times
      eventStart = new Date(event.start);
      eventEnd = new Date(event.end);
      
      // If we have startTime and endTime strings, use those instead
      // (this is for events created through our calendar)
      if (event.startTime && event.endTime) {
        const [startHour, startMinute] = event.startTime.split(':').map(Number);
        const [endHour, endMinute] = event.endTime.split(':').map(Number);
        
        eventStart = new Date(eventStart);
        eventStart.setHours(startHour, startMinute, 0, 0);
        
        eventEnd = new Date(eventEnd);
        eventEnd.setHours(endHour, endMinute, 0, 0);
      }
    }
    
    // Only add if the event is within our day bounds
    if (eventEnd > dayStart && eventStart < dayEnd) {
      busyRanges.push({
        start: eventStart < dayStart ? dayStart : eventStart,
        end: eventEnd > dayEnd ? dayEnd : eventEnd
      });
    }
  });
  
  // Sort busy ranges by start time
  busyRanges.sort((a, b) => a.start - b.start);
  
  // Merge overlapping ranges
  const mergedRanges = [];
  
  busyRanges.forEach(range => {
    if (mergedRanges.length === 0) {
      mergedRanges.push(range);
      return;
    }
    
    const lastRange = mergedRanges[mergedRanges.length - 1];
    
    if (range.start <= lastRange.end) {
      // Ranges overlap, merge them
      lastRange.end = new Date(Math.max(lastRange.end, range.end));
    } else {
      // No overlap, add as new range
      mergedRanges.push(range);
    }
  });
  
  // Find available slots between busy ranges
  let currentTime = dayStart;
  
  mergedRanges.forEach(range => {
    if (currentTime < range.start) {
      // We have an available slot
      availableSlots.push({
        start: currentTime,
        end: range.start
      });
    }
    
    // Move current time to the end of this busy range
    currentTime = range.end;
  });
  
  // Add final available slot if needed
  if (currentTime < dayEnd) {
    availableSlots.push({
      start: currentTime,
      end: dayEnd
    });
  }
};

/**
 * Creates calendar events from study suggestions (synchronous version for tests)
 * @param {Array} suggestions - Study session suggestions
 * @returns {Array} - Calendar events to be added
 */
export const createStudyEvents = (suggestions) => {
  // If no suggestions provided, return empty array immediately
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    console.warn('No valid suggestions provided to createStudyEvents');
    return [];
  }

  // Create events in memory (for tests or UI preview)
  return suggestions.map((suggestion, index) => {
    const startTime = new Date(suggestion.suggestedStartTime);
    const endTime = new Date(suggestion.suggestedEndTime);
    
    // Format the event title to include the original event name in square brackets
    const eventTitle = suggestion.event?.title || 'Event';
    const studySessionTitle = `[${eventTitle}] ${suggestion.message || 'Study Session'}`;
    
    return {
      id: `study-${Date.now()}-${index}`,
      title: studySessionTitle,
      start: startTime,
      end: endTime,
      allDay: false,
      isStudySession: true,
      relatedEventId: suggestion.event?.id || null,
      color: '#4285F4', // Google Blue
      textColor: '#FFFFFF'
    };
  });
};

/**
 * Creates and saves calendar events from study suggestions to the database
 * @param {Array} suggestions - Study session suggestions
 * @param {string} userId - User ID to associate with the events
 * @param {Object} originalEvent - The original event that these study sessions are for
 * @returns {Promise<Array>} - Calendar events that were added
 */
export const createAndSaveStudyEvents = async (suggestions, userId, originalEvent = null) => {
  try {
    console.log(`Creating ${suggestions.length} study events for user ${userId}`);
    console.log('Suggestions received:', suggestions);
    console.log('User ID:', userId);
    console.log('Original event:', originalEvent);
    
    // Check if suggestions are in the expected format
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      console.error('No valid suggestions provided to createAndSaveStudyEvents');
      return [];
    }
    
    // Check if any suggestion is missing required fields
    const hasInvalidSuggestions = suggestions.some(suggestion => {
      const missing = [];
      if (!suggestion.suggestedStartTime) missing.push('suggestedStartTime');
      if (!suggestion.suggestedEndTime) missing.push('suggestedEndTime');
      if (missing.length > 0) {
        console.error(`Suggestion missing required fields: ${missing.join(', ')}`, suggestion);
        return true;
      }
      return false;
    });
    
    if (hasInvalidSuggestions) {
      console.error('Some suggestions are missing required fields');
      return [];
    }
    
    // Import here to avoid circular dependency
    const eventService = await import('./eventService').then(module => module.default);
    
    // Collection to store created events
    const createdEvents = [];
    
    // Process each suggestion
    for (const suggestion of suggestions) {
      // Create start and end time Date objects
      const startTime = new Date(suggestion.suggestedStartTime);
      const endTime = new Date(suggestion.suggestedEndTime);
      
      console.log('Processing suggestion:', {
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        message: suggestion.message,
        event: suggestion.event
      });
      
      // Create the event object in the format expected by the eventService
      // Format the event title to include the original event name in square brackets
      const eventTitle = suggestion.event?.title || 'Event';
      const studySessionTitle = `[${eventTitle}] ${suggestion.message || 'Study Session'}`;
      
      const eventData = {
        title: studySessionTitle,
        start: startTime,
        end: endTime,
        allDay: false,
        description: `Study session for: ${suggestion.event?.title || 'Upcoming event'}`,
        location: '',
        requiresPreparation: false, // Study sessions don't themselves require preparation
        color: '#4285F4', // Google Blue
        isStudySession: true,
        relatedEventId: suggestion.event?.id || null,
        source: 'NUDGER' // Set the source to NUDGER for study events
      };
      
      console.log('Event data to be saved:', eventData);
      
      try {
        // Save to database
        const savedEvent = await eventService.createEvent(eventData, userId);
        console.log('Study event saved to database:', savedEvent);
        
        // Add to our collection with the isStudySession flag for UI
        createdEvents.push({
          ...savedEvent,
          isStudySession: true,
          textColor: '#FFFFFF'
        });
      } catch (error) {
        console.error('Error saving individual study event:', error);
        console.error('Error details:', error.message);
        if (error.stack) console.error('Stack trace:', error.stack);
      }
    }
    
    console.log(`Created ${createdEvents.length} study events:`, createdEvents);
    
    // If we have an original event, mark that study suggestions have been shown and accepted
    if (originalEvent && originalEvent.id) {
      try {
        console.log(`Updating original event ${originalEvent.id} to mark study suggestions as shown and accepted`);
        const eventService = await import('./eventService').then(module => module.default);
        
        // Update the original event to mark that study suggestions have been shown and accepted
        await eventService.updateEvent(originalEvent.id, {
          ...originalEvent,
          studySuggestionsShown: true,
          studySuggestionsAccepted: createdEvents.length > 0 // Only mark as accepted if we created events
        });
      } catch (error) {
        console.error('Error updating original event:', error);
      }
    }
    
    console.log(`Successfully created ${createdEvents.length} study events`);
    return createdEvents;
  } catch (error) {
    console.error('Error in createAndSaveStudyEvents:', error);
    return [];
  }
};

/**
 * Formats a study suggestion into a user-friendly message
 * @param {Object} suggestion - Study session suggestion
 * @returns {string} - Formatted message
 */
export const formatSuggestionMessage = (suggestion) => {
  const startTime = new Date(suggestion.suggestedStartTime);
  const endTime = new Date(suggestion.suggestedEndTime);
  
  const date = format(startTime, 'EEE, MMM d');
  const start = format(startTime, 'h:mm a');
  const end = format(endTime, 'h:mm a');
  
  return `${date} from ${start} to ${end}: ${suggestion.message}`;
};

/**
 * Checks if an event is within 8 days from now
 * @param {Object} event - The event to check
 * @returns {boolean} - True if the event is within 8 days, false otherwise
 */
export const isEventWithin8Days = (event) => {
  if (!event || !event.start) return false;
  
  // Get event start time
  const eventStart = event.start instanceof Date 
    ? new Date(event.start) 
    : new Date(event.start);
  
  // Current time as reference point
  const now = new Date();
  
  // Calculate days until the event
  const daysUntilEvent = Math.ceil((eventStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log(`Event "${event.title}" is in ${daysUntilEvent} days`);
  
  // Check if the event is within 8 days
  return daysUntilEvent <= 8 && daysUntilEvent >= 0;
};

/**
 * Checks if an event is between 8 days and 2 weeks away from now
 * @param {Object} event - The event to check
 * @returns {boolean} - True if the event is between 8 days and 2 weeks away, false otherwise
 */
export const isEventBetween8DaysAnd2Weeks = (event) => {
  if (!event || !event.start) return false;
  
  // Get event start time
  const eventStart = event.start instanceof Date 
    ? new Date(event.start) 
    : new Date(event.start);
  
  // Current time as reference point
  const now = new Date();
  
  // Calculate days until the event
  const daysUntilEvent = Math.ceil((eventStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log(`Event "${event.title}" is in ${daysUntilEvent} days (checking 8-14 day range)`);
  
  // Check if the event is between 8 days and 2 weeks away
  return daysUntilEvent > 8 && daysUntilEvent <= 14;
};

// Create a named export object
const studySuggesterService = {
  generateStudySuggestions,
  createStudyEvents,
  createAndSaveStudyEvents,
  formatSuggestionMessage,
  isEventWithin8Days,
  isEventBetween8DaysAnd2Weeks
};

export default studySuggesterService;
