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
 * Imports events from Google Calendar and stores them in MongoDB
 * @param {Array} events - Array of Google Calendar events
 * @param {string} userId - ID of the current user
 * @returns {Promise<Object>} Results of the import operation
 */
const storeGoogleEventsInDb = async (events, userId) => {
  try {
    if (!events || !Array.isArray(events) || events.length === 0) {
      console.log('No events to import');
      return { 
        imported: 0, 
        updated: 0,
        deleted: 0,
        skipped: 0, 
        errors: [] 
      };
    }

    if (!userId) {
      throw new Error('User ID is required to import events');
    }

    console.log(`Attempting to store ${events.length} Google Calendar events in database`);
    
    // Process events in batches of 200
    const BATCH_SIZE = 200;
    let totalResults = {
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: []
    };

    // Split events into batches
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(events.length/BATCH_SIZE)} (${batch.length} events)`);
      
      try {
        // Make the API request using the relative URL (works with proxy setup)
        const response = await fetch(`${BASE_URL}/google-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            events: batch,
            userId
          }),
        });

        if (!response.ok) {
          // For 504 Gateway Timeout errors, we want to show the full error message
          if (response.status === 504) {
            throw new Error('Server timeout while storing events. The request took too long to complete. This usually happens when trying to process too many events at once.');
          }
          
          // For other errors, try to get the error details from response
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || 'Failed to store events in database';
          } catch (parseError) {
            // If we can't parse the JSON, get the raw text
            const errorText = await response.text();
            errorMessage = `Server error: ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const batchResult = await response.json();
        
        // Aggregate results
        totalResults.imported += batchResult.imported || 0;
        totalResults.updated += batchResult.updated || 0;
        totalResults.deleted += batchResult.deleted || 0;
        totalResults.skipped += batchResult.skipped || 0;
        totalResults.errors = totalResults.errors.concat(batchResult.errors || []);
        
        console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1} completed:`, batchResult);
        
        // Dispatch an event to notify the calendar component to update after each batch
        // This ensures users see events as they're imported without needing to refresh
        window.dispatchEvent(new Event('calendarDataUpdated'));
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        totalResults.errors.push({
          message: error.message,
          batchStart: i,
          batchSize: batch.length
        });
      }
    }

    console.log('All batches processed. Final results:', totalResults);
    return totalResults;
  } catch (error) {
    console.error('Error storing Google Calendar events in database:', error);
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
    
    // Log the full error details
    console.error('Error syncing Google Calendar with database:', {
      message: error.message,
      status: error.status,
      stack: error.stack,
      forceFullSync
    });
    
    // Provide a more descriptive error message
    if (error.message.includes('Server timeout')) {
      throw new Error(`Sync failed: ${error.message}`);
    } else {
      throw new Error(`Failed to sync with Google Calendar: ${error.message}`);
    }
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
