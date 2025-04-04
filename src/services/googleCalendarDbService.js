/**
 * Service for syncing Google Calendar events with MongoDB
 * Handles storing imported Google Calendar events in the database
 */

// Base URL for events API endpoints
const BASE_URL = '/api/events';

/**
 * Imports events from Google Calendar and stores them in MongoDB
 * @param {Array} events - Array of Google Calendar events
 * @param {string} userId - ID of the current user
 * @returns {Promise<Object>} Results of the import operation
 */
export const storeGoogleEventsInDb = async (events, userId) => {
  try {
    if (!events || !Array.isArray(events) || events.length === 0) {
      console.log('No events to import');
      return { 
        imported: 0, 
        updated: 0,
        skipped: 0, 
        errors: [] 
      };
    }

    if (!userId) {
      throw new Error('User ID is required to import events');
    }

    console.log(`Attempting to store ${events.length} Google Calendar events in database`);
    
    // Make the API request using the relative URL (works with proxy setup)
    const response = await fetch(`${BASE_URL}/google-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events,
        userId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to store events in database');
    }

    const result = await response.json();
    console.log('Google Calendar events stored in database:', result);
    return result.results;
  } catch (error) {
    console.error('Error storing Google Calendar events in database:', error);
    throw error;
  }
};

/**
 * Imports events from Google Calendar and stores them in MongoDB in one operation
 * @param {Object} googleCalendarService - Instance of the Google Calendar service
 * @param {string} userId - ID of the current user
 * @param {Date} startDate - Start date for events to import
 * @param {Date} endDate - End date for events to import
 * @returns {Promise<Object>} Results of the import operation
 */
export const importAndStoreGoogleEvents = async (googleCalendarService, userId, startDate = new Date(), endDate = null) => {
  try {
    // Import events from Google Calendar
    const events = await googleCalendarService.importEvents(startDate, endDate);
    
    // Store events in MongoDB
    const results = await storeGoogleEventsInDb(events, userId);
    
    return {
      events,
      databaseResults: results
    };
  } catch (error) {
    console.error('Error importing and storing Google Calendar events:', error);
    throw error;
  }
};

// Create a named export object to fix ESLint warning
const googleCalendarDbService = {
  storeGoogleEventsInDb,
  importAndStoreGoogleEvents
};

export default googleCalendarDbService;
