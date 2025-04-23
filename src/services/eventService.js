/**
 * Service for handling event operations with the MongoDB backend
 */
// Import constants
import { API_URL } from '../config';

// Log the API URL to help with debugging
console.log('Event Service initialized with API_URL:', API_URL);

/**
 * Get all events for a specific user
 * @param {string} userId - The user ID to fetch events for
 * @returns {Promise<Array>} - Array of events
 */
const getUserEvents = async (userId) => {
  try {
    if (!userId) {
      console.error('No user ID provided to getUserEvents');
      return [];
    }
    
    console.log(`Fetching events for user ID: ${userId}`);
    console.log(`API URL: ${API_URL}/events/user/${userId}`);
    
    const response = await fetch(`${API_URL}/events/user/${userId}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response (${response.status}):`, errorText);
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }
    const events = await response.json();
    
    // console.log(`Received ${events.length} events from API`);
    
    // Transform MongoDB format to the format expected by the Calendar component
    return events.map(event => ({
      id: event._id,
      title: event.title,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      allDay: event.all_day,
      description: event.description,
      location: event.location,
      color: event.color,
      requiresPreparation: event.requires_preparation,
      preparationHours: event.requires_hours,
      googleEventId: event.google_event_id,
      userId: event.user_id,
      // Include the source field
      source: event.source || 'LMS',
      // Map the study session fields
      isStudySession: event.is_study_session || false,
      relatedEventId: event.related_event_id || null,
      // Map the study suggestion status fields
      studySuggestionsShown: event.study_suggestions_shown || false,
      studySuggestionsAccepted: event.study_suggestions_accepted || false,
      // Map the recurring event fields
      isRecurring: event.is_recurring || false,
      recurrenceFrequency: event.recurrence_frequency || null,
      recurrenceEndDate: event.recurrence_end_date ? new Date(event.recurrence_end_date) : null,
      recurrenceDays: event.recurrence_days || []
    }));
  } catch (error) {
    console.error('Error fetching user events:', error);
    return []; // Return empty array instead of throwing to prevent app crashes
  }
};

/**
 * Create a new event
 * @param {Object} eventData - Event data
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Created event
 */
const createEvent = async (eventData, userId) => {
  try {
    if (!userId) {
      console.error('No user ID provided to createEvent');
      throw new Error('User ID is required to create an event');
    }
    
    console.log(`Creating event for user ID: ${userId}`);
    console.log('Event data received:', eventData);
    
    // Transform from Calendar format to MongoDB format
    const eventForDb = {
      user_id: userId,
      title: eventData.title,
      all_day: eventData.allDay,
      // Preserve the exact local time by using the raw Date object
      // MongoDB will handle the conversion to UTC
      start_time: eventData.start,
      end_time: eventData.end,
      description: eventData.description || '',
      location: eventData.location || '',
      requires_preparation: eventData.requiresPreparation || false,
      requires_hours: eventData.preparationHours !== undefined && eventData.preparationHours !== '' ? 
        Number(eventData.preparationHours) : null,
      color: eventData.color || '#d2b48c',
      source: eventData.source || 'LMS', // Use provided source or default to LMS
      // Add fields for study sessions
      is_study_session: eventData.isStudySession || false,
      related_event_id: eventData.relatedEventId || null,
      // Add fields for study suggestion status
      study_suggestions_shown: eventData.studySuggestionsShown || false,
      study_suggestions_accepted: eventData.studySuggestionsAccepted || false,
      // Add fields for recurring events
      is_recurring: eventData.isRecurring || false,
      recurrence_frequency: eventData.recurrenceFrequency || null,
      recurrence_end_date: eventData.recurrenceEndDate || null,
      recurrence_days: eventData.recurrenceDays || []
    };
    
    console.log('Sending to server:', {
      start_time_type: typeof eventForDb.start_time,
      start_time: eventForDb.start_time instanceof Date ? eventForDb.start_time.toString() : eventForDb.start_time,
      end_time_type: typeof eventForDb.end_time,
      end_time: eventForDb.end_time instanceof Date ? eventForDb.end_time.toString() : eventForDb.end_time
    });
    
    const response = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventForDb),
    });

    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const createdEvent = await response.json();
    console.log('Created event from API:', createdEvent);
    
    // Transform back to Calendar format
    return {
      id: createdEvent._id,
      title: createdEvent.title,
      start: new Date(createdEvent.start_time),
      end: new Date(createdEvent.end_time),
      allDay: createdEvent.all_day,
      description: createdEvent.description,
      location: createdEvent.location,
      color: createdEvent.color,
      requiresPreparation: createdEvent.requires_preparation,
      preparationHours: createdEvent.requires_hours,
      googleEventId: createdEvent.google_event_id,
      userId: createdEvent.user_id,
      source: createdEvent.source || 'LMS',
      // Map the study session fields
      isStudySession: createdEvent.is_study_session || false,
      relatedEventId: createdEvent.related_event_id || null,
      // Map the study suggestion status fields
      studySuggestionsShown: createdEvent.study_suggestions_shown || false,
      studySuggestionsAccepted: createdEvent.study_suggestions_accepted || false,
      // Map the recurring event fields
      isRecurring: createdEvent.is_recurring || false,
      recurrenceFrequency: createdEvent.recurrence_frequency || null,
      recurrenceEndDate: createdEvent.recurrence_end_date ? new Date(createdEvent.recurrence_end_date) : null,
      recurrenceDays: createdEvent.recurrence_days || []
    };
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

/**
 * Update an existing event
 * @param {string} eventId - Event ID
 * @param {Object} eventData - Updated event data
 * @returns {Promise<Object>} - Updated event
 */
const updateEvent = async (eventId, eventData) => {
  try {
    if (!eventId) {
      console.error('No event ID provided to updateEvent');
      throw new Error('Event ID is required to update an event');
    }
    
    console.log(`Updating event ID: ${eventId}`);
    console.log('Event data received:', eventData);
    console.log('studySuggestionsAccepted flag:', eventData.studySuggestionsAccepted);
    
    // First, get the current event from the database to preserve important flags
    let currentEvent;
    try {
      // Fetch the current event to get the current studySuggestionsAccepted value
      const response = await fetch(`${API_URL}/events/${eventId}`);
      if (response.ok) {
        currentEvent = await response.json();
        console.log('Current event from database:', {
          id: currentEvent._id,
          title: currentEvent.title,
          studySuggestionsAccepted: currentEvent.study_suggestions_accepted
        });
      }
    } catch (error) {
      console.error('Error fetching current event:', error);
      // Continue with the update even if we couldn't fetch the current event
    }
    
    // Transform from Calendar format to MongoDB format
    const eventForDb = {
      title: eventData.title,
      all_day: eventData.allDay,
      // Preserve the exact local time by using the raw Date object
      // MongoDB will handle the conversion to UTC
      start_time: eventData.start,
      end_time: eventData.end,
      description: eventData.description || '',
      location: eventData.location || '',
      requires_preparation: eventData.requiresPreparation || false,
      requires_hours: eventData.preparationHours !== undefined && eventData.preparationHours !== '' ? 
        Number(eventData.preparationHours) : null,
      color: eventData.color || '#d2b48c',
      // Include the source field
      source: eventData.source || 'LMS',
      // Add fields for study sessions
      is_study_session: eventData.isStudySession || false,
      related_event_id: eventData.relatedEventId || null,
      // Add fields for study suggestion status - PRESERVE THE CURRENT VALUE IF AVAILABLE
      study_suggestions_shown: eventData.studySuggestionsShown || false,
      study_suggestions_accepted: currentEvent?.study_suggestions_accepted || eventData.studySuggestionsAccepted || false,
      // Add fields for recurring events
      is_recurring: eventData.isRecurring || false,
      recurrence_frequency: eventData.recurrenceFrequency || null,
      recurrence_end_date: eventData.recurrenceEndDate || null,
      recurrence_days: eventData.recurrenceDays || []
    };
    
    console.log('Sending to server with preserved flags:', {
      study_suggestions_accepted: eventForDb.study_suggestions_accepted,
      original_value: currentEvent?.study_suggestions_accepted,
      eventData_value: eventData.studySuggestionsAccepted
    });
    
    console.log('Sending to server:', {
      start_time_type: typeof eventForDb.start_time,
      start_time: eventForDb.start_time instanceof Date ? eventForDb.start_time.toString() : eventForDb.start_time,
      end_time_type: typeof eventForDb.end_time,
      end_time: eventForDb.end_time instanceof Date ? eventForDb.end_time.toString() : eventForDb.end_time
    });
    
    const response = await fetch(`${API_URL}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventForDb),
    });

    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const updatedEvent = await response.json();
    console.log('Updated event from API:', updatedEvent);
    
    // Transform back to Calendar format
    return {
      id: updatedEvent._id,
      title: updatedEvent.title,
      start: new Date(updatedEvent.start_time),
      end: new Date(updatedEvent.end_time),
      allDay: updatedEvent.all_day,
      description: updatedEvent.description,
      location: updatedEvent.location,
      color: updatedEvent.color,
      requiresPreparation: updatedEvent.requires_preparation,
      preparationHours: updatedEvent.requires_hours,
      googleEventId: updatedEvent.google_event_id,
      userId: updatedEvent.user_id,
      // Include the source field
      source: updatedEvent.source || 'LMS',
      // Map the study session fields
      isStudySession: updatedEvent.is_study_session || false,
      relatedEventId: updatedEvent.related_event_id || null,
      // Map the study suggestion status fields
      studySuggestionsShown: updatedEvent.study_suggestions_shown || false,
      studySuggestionsAccepted: updatedEvent.study_suggestions_accepted || false,
      // Map the recurring event fields (if they exist)
      isRecurring: updatedEvent.is_recurring || false,
      recurrenceFrequency: updatedEvent.recurrence_frequency || null,
      recurrenceEndDate: updatedEvent.recurrence_end_date ? new Date(updatedEvent.recurrence_end_date) : null,
      recurrenceDays: updatedEvent.recurrence_days || []
    };
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

/**
 * Delete an event
 * @param {string} eventId - Event ID to delete
 * @returns {Promise<Object>} - Deletion result
 */
const deleteEvent = async (eventId) => {
  try {
    if (!eventId) {
      console.error('No event ID provided to deleteEvent');
      throw new Error('Event ID is required to delete an event');
    }
    
    console.log(`Deleting event with ID: ${eventId}`);

    // Delete from our backend
    const response = await fetch(`${API_URL}/events/${eventId}`, {
      method: 'DELETE',
    });

    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const deletionResult = await response.json();
    console.log('Deletion result from API:', deletionResult);
    
    return deletionResult;
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

/**
 * Get a single event by its ID
 * @param {string} eventId - The event ID to fetch
 * @returns {Promise<Object>} - The event object
 */
const getEventById = async (eventId) => {
  try {
    if (!eventId) {
      console.error('No event ID provided to getEventById');
      throw new Error('Event ID is required to fetch an event');
    }
    
    console.log(`Fetching event with ID: ${eventId}`);
    console.log(`API URL: ${API_URL}/events/${eventId}`);
    
    const response = await fetch(`${API_URL}/events/${eventId}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response (${response.status}):`, errorText);
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }
    const event = await response.json();
    
    console.log('Received event from API:', event);
    
    // Transform MongoDB format to the format expected by the Calendar component
    return {
      id: event._id,
      title: event.title,
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      allDay: event.all_day,
      description: event.description,
      location: event.location,
      color: event.color,
      requiresPreparation: event.requires_preparation,
      preparationHours: event.requires_hours,
      googleEventId: event.google_event_id,
      userId: event.user_id,
      source: event.source || 'LMS',
      // Map the study session fields
      isStudySession: event.is_study_session || false,
      relatedEventId: event.related_event_id || null,
      // Map the study suggestion status fields
      studySuggestionsShown: event.study_suggestions_shown || false,
      studySuggestionsAccepted: event.study_suggestions_accepted || false,
      // Map the recurring event fields
      isRecurring: event.is_recurring || false,
      recurrenceFrequency: event.recurrence_frequency || null,
      recurrenceEndDate: event.recurrence_end_date ? new Date(event.recurrence_end_date) : null,
      recurrenceDays: event.recurrence_days || []
    };
  } catch (error) {
    console.error('Error fetching event by ID:', error);
    throw error;
  }
};

/**
 * Check if an event has related study sessions
 * @param {string} eventId - The event ID to check
 * @returns {Promise<boolean>} - True if the event has related study sessions
 */
const hasRelatedStudySessions = async (eventId) => {
  try {
    if (!eventId) {
      console.error('No event ID provided to hasRelatedStudySessions');
      return false;
    }
    
    console.log(`Checking for study sessions related to event ID: ${eventId}`);
    console.log(`API URL: ${API_URL}/events/related/${eventId}`);
    
    const response = await fetch(`${API_URL}/events/related/${eventId}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response (${response.status}):`, errorText);
      return false;
    }
    
    const relatedEvents = await response.json();
    console.log(`Found ${relatedEvents.length} related study sessions for event ID: ${eventId}`);
    
    // If there are any related study sessions, return true
    return relatedEvents.length > 0;
  } catch (error) {
    console.error('Error checking for related study sessions:', error);
    return false;
  }
};



// Create an object with all the service methods
const eventService = {
  getUserEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  hasRelatedStudySessions
};

// Export the service object
export default eventService;
