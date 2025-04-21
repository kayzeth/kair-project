/**
 * Service for syncing Google Calendar events with MongoDB
 * Handles storing imported Google Calendar events in the database
 * and managing sync tokens for incremental updates
 */

import googleCalendarService from './googleCalendarService';

// Base URL for events API endpoints
const BASE_URL = '/api/events';

/**
 * Get the stored sync token for Google Calendar
 * @param {string} userId - The MongoDB user ID (used to create a user-specific key)
 * @returns {Promise<string|null>} The sync token or null if not found
 */
const getSyncToken = async (userId) => {
  try {
    const response = await fetch(`/api/users/${userId}/google-sync-token`);
    if (!response.ok) throw new Error('Failed to fetch sync token');
    const data = await response.json();
    console.log(`Retrieved sync token from DB for user ${userId}:`, data.syncToken);
    return data.syncToken || null;
  } catch (error) {
    console.error('Error retrieving Google Calendar sync token:', error);
    return null;
  }
};

/**
 * Save the sync token for Google Calendar
 * @param {string} userId - The MongoDB user ID (used to create a user-specific key)
 * @param {string} syncToken - The sync token to save
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
const saveSyncToken = async (userId, syncToken) => {
  try {
    if (!syncToken) {
      console.error('Sync token is required');
      return false;
    }

    const response = await fetch('/api/events/google-sync-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, syncToken }),
    });

    if (!response.ok) throw new Error('Failed to save sync token');
    console.log(`Saved Google Calendar sync token to DB for user ${userId}:`, syncToken);
    return true;
  } catch (error) {
    console.error('Error saving Google Calendar sync token:', error);
    return false;
  }
};


/**
 * Clear the sync token for a user
 * @param {string} userId - The MongoDB user ID (used to create a user-specific key)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
const clearSyncData = async (userId) => {
  try {
    if (!userId) throw new Error('User ID is required to clear sync token');
    // Call backend API to clear the sync token in the user table
    const response = await fetch(`/api/users/${userId}/google-sync-token`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncToken: '' }),
    });
    if (!response.ok) throw new Error('Failed to clear sync token in database');
    console.log(`Cleared Google Calendar sync token in database for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error clearing Google Calendar sync data:', error);
    return false;
  }
};

/**
 * Store Google Calendar events in MongoDB with retry mechanism
 * @param {Array} events - Array of events from Google Calendar
 * @param {string} userId - ID of the current user
 * @param {number} retryCount - Number of retries attempted (internal use)
 * @returns {Promise<Object>} Results of the storage operation
 */
const storeGoogleEventsInDb = async (events, userId, retryCount = 0) => {
  try {
    if (!userId) {
      throw new Error('User ID is required to import events');
    }

    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 60000; // 60 seconds timeout
    
    console.log(`Attempting to store ${events.length} Google Calendar events in database (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    
    // Split events into smaller batches if there are many events
    const BATCH_SIZE = 200;
    if (events.length > BATCH_SIZE && retryCount === 0) {
      console.log(`Large number of events (${events.length}), splitting into batches of ${BATCH_SIZE}`);
      
      const batches = [];
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        batches.push(events.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`Processing ${batches.length} batches`);
      
      // Process batches sequentially to avoid overwhelming the server
      let combinedResults = {
        imported: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        errors: []
      };
      
      for (let i = 0; i < batches.length; i++) {
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batches[i].length} events`);
        try {
          const batchResult = await storeGoogleEventsInDb(batches[i], userId);
          // Combine results
          combinedResults.imported += batchResult.imported || 0;
          combinedResults.updated += batchResult.updated || 0;
          combinedResults.deleted += batchResult.deleted || 0;
          combinedResults.skipped += batchResult.skipped || 0;
          if (batchResult.errors && batchResult.errors.length) {
            combinedResults.errors = [...combinedResults.errors, ...batchResult.errors];
          }
        } catch (error) {
          console.error(`Error processing batch ${i + 1}:`, error);
          combinedResults.errors.push({
            batch: i + 1,
            error: error.message
          });
        }
      }
      
      // Dispatch an event to notify the Calendar component to refresh
      setTimeout(() => {
        console.log('Dispatching calendar update event...');
        window.dispatchEvent(new Event('calendarEventsUpdated'));
      }, 500);
      
      return combinedResults;
    }
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    // Make the API request using the relative URL (works with proxy setup)
    try {
      const response = await fetch(`${BASE_URL}/google-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events,
          userId
        }),
        signal: controller.signal
      });
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || 'Failed to store events in database';
        } catch (parseError) {
          // If not valid JSON, use the text directly
          errorMessage = errorText || 'Failed to store events in database';
        }
        
        throw new Error(errorMessage);
      }

      const resultText = await response.text();
      let result;
      
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response format from server');
      }
      
      console.log('Google Calendar events stored in database:', result);
      
      // Dispatch an event to notify the Calendar component to refresh
      setTimeout(() => {
        console.log('Dispatching calendar update event...');
        window.dispatchEvent(new Event('calendarEventsUpdated'));
      }, 500);
      
      return result.results;
    } catch (fetchError) {
      // Clear the timeout if there was an error
      clearTimeout(timeoutId);
      
      // Handle abort errors (timeout)
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after', TIMEOUT_MS, 'ms');
        throw new Error(`Request timed out after ${TIMEOUT_MS / 1000} seconds`);
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Error storing Google Calendar events in database:', error);
    
    // Implement retry logic
    const MAX_RETRIES = 3;
    if (retryCount < MAX_RETRIES) {
      const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`Retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const result = await storeGoogleEventsInDb(events, userId, retryCount + 1);
            resolve(result);
          } catch (retryError) {
            // If all retries fail, reject with the error
            reject(retryError);
          }
        }, backoffTime);
      });
    }
    
    throw error;
  }
};

/**
 * Imports events from Google Calendar and stores them in MongoDB in one operation
 * @param {string} userId - ID of the current user
 * @param {boolean} forceFullSync - Whether to force a full sync instead of using the sync token
 * @returns {Promise<Object>} Results of the import operation
 */
const syncGoogleCalendarWithDb = async (userId, forceFullSync = false) => {
  try {
    if (!userId) {
      throw new Error('User ID is required to sync events');
    }

    if (!googleCalendarService.isSignedIn()) {
      throw new Error('User is not signed in to Google Calendar');
    }

    // Calculate date range (±2 years from current date)
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    // Get the sync token if we're not forcing a full sync
    const syncToken = await getSyncToken(userId);

    console.log(syncToken ? 'Using sync token for incremental sync' : 'Performing full sync');
    console.log('Sync token from database:', syncToken);
    
    // Import events from Google Calendar with sync token if available
    const { events, nextSyncToken } = await googleCalendarService.importEvents(
      startDate, 
      endDate, 
      syncToken
    );
    
    console.log(`Imported ${events.length} events from Google Calendar`);
    
    // Store events in MongoDB
    const results = await storeGoogleEventsInDb(events, userId);
    
    // Save the next sync token for future syncs
    if (nextSyncToken) {
      await saveSyncToken(userId, nextSyncToken);
      console.log('Saved new sync token to database for future incremental syncs');
    }
    
    return {
      events,
      databaseResults: results,
      nextSyncToken
    };
  } catch (error) {
    // If we get a 410 Gone error, the sync token is invalid
    // Clear it and try again with a full sync
    if (error.message && error.message.includes('410')) {
      console.warn('Sync token expired, clearing and retrying with full sync');
      await clearSyncData(userId);
      
      // Only retry once to prevent infinite loops
      if (!forceFullSync) {
        return syncGoogleCalendarWithDb(userId, true);
      }
    }
    
    console.error('Error syncing Google Calendar with database:', error);
    throw error;
  }
};

/**
 * Force a full sync with Google Calendar
 * @param {string} userId - ID of the current user
 * @returns {Promise<Object>} Promise that resolves with the result of the sync
 */
const forceSyncGoogleCalendar = async (userId) => {
  return syncGoogleCalendarWithDb(userId, true);
};

/**
 * Delete all Google Calendar events for a user
 * @param {string} userId - ID of the current user
 * @returns {Promise<Object>} Promise that resolves with the number of deleted events
 */
const deleteAllGoogleEvents = async (userId) => {
  try {
    if (!userId) {
      console.error('User ID is required to delete Google Calendar events');
      throw new Error('User ID is required');
    }
    
    console.log(`Deleting all Google Calendar events for user ${userId}`);
    
    // Delete all events with type 'google' for this user
    const response = await fetch(`${BASE_URL}/google-delete-all/${userId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response (${response.status}):`, errorText);
      throw new Error(`Failed to delete Google Calendar events: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`Deleted ${result.deletedCount} Google Calendar events`);
    
    // Clear the sync token as well
    await clearSyncData(userId);
    
    return result;
  } catch (error) {
    console.error('Error deleting Google Calendar events:', error);
    throw error;
  }
};

// Create a named export object
const googleCalendarDbService = {
  syncGoogleCalendarWithDb,
  forceSyncGoogleCalendar,
  storeGoogleEventsInDb,
  getSyncToken,
  saveSyncToken,
  clearSyncData,
  deleteAllGoogleEvents
};

export default googleCalendarDbService;
