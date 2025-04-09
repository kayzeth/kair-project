/**
 * Service for managing Google Calendar events in local storage
 * This service handles caching Google Calendar events and retrieving them
 */

import googleCalendarService from './googleCalendarService';

// Local storage key for Google Calendar events
const GOOGLE_EVENTS_STORAGE_KEY = 'kairos_google_calendar_events';
const GOOGLE_EVENTS_LAST_SYNC_KEY = 'kairos_google_calendar_last_sync';

/**
 * Get Google Calendar events from local storage
 * @returns {Array} Array of Google Calendar events
 */
const getEventsFromLocalStorage = () => {
  try {
    const eventsJson = localStorage.getItem(GOOGLE_EVENTS_STORAGE_KEY);
    if (!eventsJson) return [];
    
    const events = JSON.parse(eventsJson);
    
    // Convert date strings back to Date objects
    return events.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    }));
  } catch (error) {
    console.error('Error retrieving Google Calendar events from local storage:', error);
    return [];
  }
};

/**
 * Save Google Calendar events to local storage
 * @param {Array} events - Array of Google Calendar events
 */
const saveEventsToLocalStorage = (events) => {
  try {
    localStorage.setItem(GOOGLE_EVENTS_STORAGE_KEY, JSON.stringify(events));
    // Update last sync timestamp
    localStorage.setItem(GOOGLE_EVENTS_LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error saving Google Calendar events to local storage:', error);
  }
};

/**
 * Get the last sync timestamp
 * @returns {Date|null} Last sync timestamp or null if never synced
 */
const getLastSyncTimestamp = () => {
  try {
    const timestamp = localStorage.getItem(GOOGLE_EVENTS_LAST_SYNC_KEY);
    return timestamp ? new Date(timestamp) : null;
  } catch (error) {
    console.error('Error retrieving last sync timestamp:', error);
    return null;
  }
};

/**
 * Check if events need to be synced based on view date
 * @param {Date} viewDate - The current view date
 * @param {Array} cachedEvents - The currently cached events
 * @returns {boolean} True if events need to be synced
 */
const needsSync = (viewDate, cachedEvents = []) => {
  if (!cachedEvents || cachedEvents.length === 0) return true;
  
  // Get the date range of cached events
  let earliestDate = new Date();
  let latestDate = new Date();
  
  if (cachedEvents.length > 0) {
    // Find the earliest and latest dates in the cached events
    earliestDate = new Date(Math.min(...cachedEvents.map(e => new Date(e.start).getTime())));
    latestDate = new Date(Math.max(...cachedEvents.map(e => new Date(e.end).getTime())));
  }
  
  // Check if the view date is outside the cached range
  return viewDate < earliestDate || viewDate > latestDate;
};

/**
 * Sync Google Calendar events for a specific date range
 * @param {Date} centerDate - The center date to sync around (typically the current view date)
 * @returns {Promise<Array>} Promise that resolves with the synced events
 */
const syncGoogleCalendarEvents = async (centerDate = new Date()) => {
  try {
    // If not signed in, return empty array
    if (!googleCalendarService.isSignedIn()) {
      console.log('User not signed in to Google Calendar');
      return [];
    }
    
    // Calculate date range (±1 year from center date)
    const startDate = new Date(centerDate);
    startDate.setFullYear(startDate.getFullYear() - 1);
    
    const endDate = new Date(centerDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    console.log(`Syncing Google Calendar events from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Import events from Google Calendar
    const importedEvents = await googleCalendarService.importEvents(startDate, endDate);
    console.log(`Imported ${importedEvents.length} events from Google Calendar`);
    
    // Add event date logging
    if (importedEvents.length > 0) {
      const eventDates = importedEvents.map(e => new Date(e.start).getTime());
      const earliestDate = new Date(Math.min(...eventDates));
      const latestDate = new Date(Math.max(...eventDates));
      console.log(`Event date range: ${earliestDate.toLocaleDateString()} - ${latestDate.toLocaleDateString()}`);
    }
    
    // Get existing events from local storage
    const existingEvents = getEventsFromLocalStorage();
    
    // Merge events by checking Google event IDs
    const existingGoogleIds = new Set(existingEvents.map(e => e.googleEventId));
    const mergedEvents = [
      // Keep existing events that aren't Google events or aren't in the new import
      ...existingEvents.filter(event => 
        !event.googleEventId || 
        !existingGoogleIds.has(event.googleEventId)
      ),
      // Add all imported events (will overwrite any with same googleEventId)
      ...importedEvents
    ];
    
    // Save to local storage
    saveEventsToLocalStorage(mergedEvents);
    
    return mergedEvents;
  } catch (error) {
    console.error('Error syncing Google Calendar events:', error);
    // Return existing events from local storage in case of error
    return getEventsFromLocalStorage();
  }
};

/**
 * Get Google Calendar events for the calendar
 * @param {Date} viewDate - Current view date on the calendar
 * @returns {Promise<Array>} Promise that resolves with Google Calendar events
 */
const getGoogleCalendarEvents = async (viewDate = new Date()) => {
  try {
    // Get cached events
    const cachedEvents = getEventsFromLocalStorage();
    
    // Check if we need to sync based on the view date
    if (needsSync(viewDate, cachedEvents)) {
      console.log('View date outside cached range, syncing with Google Calendar');
      return await syncGoogleCalendarEvents(viewDate);
    }
    
    return cachedEvents;
  } catch (error) {
    console.error('Error getting Google Calendar events:', error);
    return [];
  }
};

/**
 * Force a sync with Google Calendar
 * @returns {Promise<Array>} Promise that resolves with the synced events
 */
const forceSyncGoogleCalendar = async () => {
  try {
    return await syncGoogleCalendarEvents(new Date());
  } catch (error) {
    console.error('Error forcing Google Calendar sync:', error);
    return [];
  }
};

/**
 * Clear Google Calendar events from local storage
 */
const clearGoogleCalendarEvents = () => {
  try {
    localStorage.removeItem(GOOGLE_EVENTS_STORAGE_KEY);
    localStorage.removeItem(GOOGLE_EVENTS_LAST_SYNC_KEY);
  } catch (error) {
    console.error('Error clearing Google Calendar events from local storage:', error);
  }
};

// Create a named export object
const googleCalendarLocalStorageService = {
  getGoogleCalendarEvents,
  syncGoogleCalendarEvents,
  forceSyncGoogleCalendar,
  clearGoogleCalendarEvents,
  getLastSyncTimestamp
};

export default googleCalendarLocalStorageService;
