/**
 * Nudger Service - KAIR-15/16
 * 
 * This service identifies events in the next two weeks that may require 
 * additional study time based on the requiresPreparation flag.
 */

/**
 * Identifies events in the next two weeks that may require additional study time
 * @param {Array} events - Array of calendar events
 * @returns {Array} - Array of events that need additional study time
 */
export const identifyUpcomingEvents = (events) => {
  if (!events || !Array.isArray(events)) {
    console.warn('Nudger: No events provided or invalid events format');
    return [];
  }

  // Calculate date range (now to two weeks from now)
  const now = new Date();
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(now.getDate() + 14);
  
  console.log(`Nudger: Scanning for events between ${now.toLocaleDateString()} and ${twoWeeksFromNow.toLocaleDateString()}`);

  // Filter events within the next two weeks
  const upcomingEvents = events.filter(event => {
    // Parse event start date - handle both Date objects and string dates
    let eventDate;
    if (event.start instanceof Date) {
      eventDate = new Date(event.start);
    } else if (typeof event.start === 'string') {
      eventDate = new Date(event.start.split('T')[0]);
    } else {
      console.error('Nudger: Invalid event start date format', event);
      return false;
    }
    
    // Check if event is within the next two weeks
    return eventDate >= now && eventDate <= twoWeeksFromNow;
  });

  console.log(`Nudger: Found ${upcomingEvents.length} events in the next two weeks`);
  
  // Identify events that require preparation based on the requiresPreparation flag
  const studyEvents = upcomingEvents.filter(event => {
    // Only include events explicitly marked as requiring preparation
    return event.requiresPreparation === true;
  });

  console.log(`Nudger: Identified ${studyEvents.length} events that require preparation`);
  
  // Add metadata to identified events
  return studyEvents.map(event => {
    // Check if the event already has preparation hours specified
    const needsPreparationInput = event.requiresPreparation === true && 
      (event.preparationHours === undefined || 
       event.preparationHours === null || 
       event.preparationHours === '');
    
    return {
      ...event,
      requiresStudy: true,
      // Use user-specified preparation hours if available, otherwise use default
      suggestedStudyHours: event.preparationHours ? Number(event.preparationHours) : getDefaultStudyHours(),
      identifiedBy: 'nudger',
      needsPreparationInput // Flag to indicate if we need to prompt for preparation hours
    };
  });
};

/**
 * Returns default study hours when no user input is available
 * @returns {number} - Default study hours
 */
const getDefaultStudyHours = () => {
  return 3; // Default to 3 hours of study time
};

/**
 * Gets study plan for the next two weeks
 * @param {Array} events - Array of calendar events
 * @returns {Object} - Object containing study events and statistics
 */
export const getStudyPlan = (events) => {
  // Identify events that require study time
  const studyEvents = identifyUpcomingEvents(events);
  
  // Calculate total study hours
  const totalStudyHours = studyEvents.reduce((total, event) => {
    return total + (event.suggestedStudyHours || 0);
  }, 0);
  
  // Group events by date for easier display
  const eventsByDate = studyEvents.reduce((acc, event) => {
    // Handle both Date objects and string dates
    let dateStr;
    if (event.start instanceof Date) {
      dateStr = event.start.toISOString().split('T')[0];
    } else if (typeof event.start === 'string') {
      dateStr = event.start.split('T')[0];
    } else {
      console.error('Nudger: Invalid event start date format in getStudyPlan', event);
      dateStr = 'unknown-date';
    }
    
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(event);
    return acc;
  }, {});
  
  return {
    events: studyEvents,
    totalStudyHours,
    eventCount: studyEvents.length,
    eventsByDate
  };
};

/**
 * Identifies events that need study suggestions based on the 8-day threshold and suggestion status
 * @param {Array} events - Array of calendar events
 * @returns {Array} - Array of events that need study suggestions
 */
export const identifyEventsNeedingStudySuggestions = (events) => {
  if (!events || !Array.isArray(events)) {
    console.warn('Nudger: No events provided or invalid events format');
    return [];
  }

  // Calculate date range (now to 8 days from now)
  const now = new Date();
  const eightDaysFromNow = new Date();
  eightDaysFromNow.setDate(now.getDate() + 8);
  
  console.log(`Nudger: Scanning for events needing study suggestions between ${now.toLocaleDateString()} and ${eightDaysFromNow.toLocaleDateString()}`);

  // Filter events within the next 8 days
  const upcomingEvents = events.filter(event => {
    // Parse event start date - handle both Date objects and string dates
    let eventDate;
    if (event.start instanceof Date) {
      eventDate = new Date(event.start);
    } else if (typeof event.start === 'string') {
      eventDate = new Date(event.start.split('T')[0]);
    } else {
      console.error('Nudger: Invalid event start date format', event);
      return false;
    }
    
    // Check if event is within the next 8 days
    return eventDate >= now && eventDate <= eightDaysFromNow;
  });

  console.log(`Nudger: Found ${upcomingEvents.length} events in the next 8 days`);
  
  // Identify events that require preparation, have hours specified, and haven't had suggestions shown yet
  const eventsNeedingSuggestions = upcomingEvents.filter(event => {
    // Skip events where studySuggestionsShown is undefined or not explicitly set to false
    // This ensures we don't process events from before the schema update
    if (event.studySuggestionsShown === undefined) {
      console.log(`Nudger: Skipping event "${event.title}" because studySuggestionsShown field is undefined`);
      return false;
    }
    
    // Skip events where studySuggestionsAccepted is true
    // This ensures we don't suggest study sessions for events that already have accepted study sessions
    if (event.studySuggestionsAccepted === true) {
      console.log(`Nudger: Skipping event "${event.title}" because study suggestions have already been accepted`);
      return false;
    }
    
    // Check if preparation hours are explicitly set and valid
    // This is critical - we only want to show study suggestions if hours are actually specified
    if (event.preparationHours === undefined || event.preparationHours === null || event.preparationHours === '') {
      console.log(`Nudger: Skipping event "${event.title}" because preparation hours are not specified yet`);
      return false;
    }
    
    // Ensure preparation hours are greater than 0
    const preparationHours = Number(event.preparationHours);
    if (isNaN(preparationHours) || preparationHours <= 0) {
      console.log(`Nudger: Skipping event "${event.title}" because preparation hours (${event.preparationHours}) are invalid or not greater than 0`);
      return false;
    }
    
    return event.requiresPreparation === true && 
           event.studySuggestionsShown === false;
  });

  console.log(`Nudger: Identified ${eventsNeedingSuggestions.length} events that need study suggestions`);
  
  return eventsNeedingSuggestions;
};

/**
 * Updates an event to mark that study suggestions have been shown
 * @param {Object} event - The event to update
 * @param {boolean} accepted - Whether any suggestions were accepted
 * @returns {Object} - Updated event object
 */
export const markStudySuggestionsShown = (event, accepted = false) => {
  return {
    ...event,
    studySuggestionsShown: true,
    studySuggestionsAccepted: accepted
  };
};

// Create a named export object
const nudgerService = {
  identifyUpcomingEvents,
  getStudyPlan,
  identifyEventsNeedingStudySuggestions,
  markStudySuggestionsShown
};

export default nudgerService;
