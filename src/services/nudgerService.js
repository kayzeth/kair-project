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

// Create a named export object
const nudgerService = {
  identifyUpcomingEvents,
  getStudyPlan
};

export default nudgerService;
