/**
 * Service for handling combined events from database and Google Calendar cache
 * This service acts as a facade over eventService and calendarCacheService
 */

import eventService from './eventService';
import calendarCacheService from './calendarCacheService';
import googleCalendarService from './googleCalendarService';
import calendarViewService from './calendarViewService';

/**
 * Get all events for a user, combining database events with Google Calendar events
 * @param {string} userId - The user ID to fetch events for
 * @param {Date} [viewDate] - Optional current view date to center the date range
 * @returns {Promise<Array>} - Array of combined events
 */
const getCombinedEvents = async (userId, viewDate = null) => {
  try {
    if (!userId) {
      console.error('No user ID provided to getCombinedEvents');
      return [];
    }
    
    // Calculate date range based on view date (±1 year)
    let startDate, endDate;
    if (viewDate) {
      const date = new Date(viewDate);
      startDate = new Date(date);
      startDate.setFullYear(date.getFullYear() - 1);
      endDate = new Date(date);
      endDate.setFullYear(date.getFullYear() + 1);      
      console.log(`Using date range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    }
    
    // Get user events from database with date range
    const dbEvents = await eventService.getUserEvents(userId, startDate, endDate);
    console.log(`Retrieved ${dbEvents.length} events from database for date range`);
    
    // If Google Calendar is not authenticated, just return database events
    if (!googleCalendarService.isSignedIn()) {
      return dbEvents;
    }
    
    // Initialize cache service
    calendarCacheService.initialize(userId);
    
    // Check if we need to update the cache for this view date
    if (viewDate && googleCalendarService.isSignedIn()) {
      // This will trigger a cache update if needed
      await calendarViewService.updateViewDate(viewDate, userId, 'unknown');
    }
    
    // Get Google Calendar events from local storage cache
    const googleEvents = calendarCacheService.getCachedEvents(userId);
    console.log(`Retrieved ${googleEvents.length} events from Google Calendar cache`);
    
    // Filter Google Calendar events to the same date range if viewDate is provided
    let filteredGoogleEvents = googleEvents;
    if (viewDate && startDate && endDate) {
      filteredGoogleEvents = googleEvents.filter(event => {
        const eventStart = new Date(event.start);
        return eventStart >= startDate && eventStart <= endDate;
      });
      console.log(`Filtered to ${filteredGoogleEvents.length} Google Calendar events in date range`);
    }
    
    // Create a map of database events by ID for quick lookup
    const dbEventMap = new Map();
    dbEvents.forEach(event => {
      dbEventMap.set(event.id, event);
    });
    
    // Create a map of Google events by ID for quick lookup
    const googleEventMap = new Map();
    googleEvents.forEach(event => {
      googleEventMap.set(event.id, event);
      // Also map by googleEventId if it exists
      if (event.googleEventId) {
        googleEventMap.set(event.googleEventId, event);
      }
    });
    
    // Combine events, giving preference to Google Calendar events for duplicates
    const combinedEvents = [...dbEvents];
    
    // Add Google Calendar events, avoiding duplicates
    filteredGoogleEvents.forEach(googleEvent => {
      // Check if this Google event already exists in the database events
      // by looking for matching ID or googleEventId
      const existingDbEvent = dbEvents.find(e => 
        e.id === googleEvent.id || 
        (e.googleEventId && e.googleEventId === googleEvent.id) ||
        (googleEvent.googleEventId && e.id === googleEvent.googleEventId)
      );
      
      if (existingDbEvent) {
        // Replace the existing event in the combined list
        const index = combinedEvents.findIndex(e => e.id === existingDbEvent.id);
        if (index >= 0) {
          combinedEvents[index] = googleEvent;
        }
      } else {
        // Add new Google Calendar event
        combinedEvents.push(googleEvent);
      }
    });
    
    console.log(`Returning ${combinedEvents.length} combined events`);
    return combinedEvents;
  } catch (error) {
    console.error('Error getting combined events:', error);
    return [];
  }
};

/**
 * Create a new event
 * @param {Object} eventData - Event data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Created event
 */
const createEvent = async (eventData, userId) => {
  // We only create non-Google events in the database
  return eventService.createEvent(eventData, userId);
};

/**
 * Update an existing event
 * @param {string} eventId - Event ID
 * @param {Object} eventData - Updated event data
 * @returns {Promise<Object>} - Updated event
 */
const updateEvent = async (eventId, eventData) => {
  // We only update non-Google events in the database
  return eventService.updateEvent(eventId, eventData);
};

/**
 * Delete an event
 * @param {string} eventId - Event ID to delete
 * @returns {Promise<Object>} - Deletion result
 */
const deleteEvent = async (eventId) => {
  // We only delete non-Google events from the database
  return eventService.deleteEvent(eventId);
};

// Create an object with all the service methods
const combinedEventService = {
  getCombinedEvents,
  createEvent,
  updateEvent,
  deleteEvent
};

export default combinedEventService;
