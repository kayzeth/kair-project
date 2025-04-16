const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get events by user_id
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('Fetching events for user ID:', userId);
    
    // Check if we have any Google Calendar events for this user
    const googleEvents = await Event.find({ user_id: userId, source: 'GOOGLE_CALENDAR' });
    console.log(`Found ${googleEvents.length} Google Calendar events for user ID ${userId}`);
    
    // Get all events for this user
    const events = await Event.find({ user_id: userId });
    console.log(`Found ${events.length} total events for user ID ${userId}`);
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete all Google Calendar events for a user
router.delete('/google-delete-all/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`Deleting all Google Calendar events for user ${userId}`);
    
    // Delete all events with type 'google' for this user
    const result = await Event.deleteMany({ 
      user_id: userId, 
      $or: [
        { type: 'google' },
        { source: 'GOOGLE_CALENDAR' }
      ]
    });
    
    console.log(`Deleted ${result.deletedCount} Google Calendar events for user ${userId}`);
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error deleting Google Calendar events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new event
router.post('/', async (req, res) => {
  try {
    console.log('Creating event with data:', req.body);
    
    // Ensure dates are properly preserved with their exact values
    const eventData = { ...req.body };
    
    // Handle date strings to preserve exact time
    if (eventData.start_time && typeof eventData.start_time === 'string') {
      // Keep the exact string format to preserve timezone information
      console.log('Preserving exact start_time string:', eventData.start_time);
    }
    
    if (eventData.end_time && typeof eventData.end_time === 'string') {
      // Keep the exact string format to preserve timezone information
      console.log('Preserving exact end_time string:', eventData.end_time);
    }
    
    // Create the event with the exact date values from the client
    const event = new Event(eventData);
    await event.save();
    
    // Log the saved event dates for debugging
    console.log('Saved event dates:', {
      start: event.start_time,
      end: event.end_time,
      startISO: event.start_time.toISOString(),
      startLocal: event.start_time.toString()
    });
    
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event
router.put('/:id', async (req, res) => {
  try {
    console.log('Updating event with data:', req.body);
    
    // Ensure dates are properly preserved with their exact values
    const eventData = { ...req.body };
    
    // Handle date strings to preserve exact time
    if (eventData.start_time && typeof eventData.start_time === 'string') {
      // Keep the exact string format to preserve timezone information
      console.log('Preserving exact start_time string for update:', eventData.start_time);
    }
    
    if (eventData.end_time && typeof eventData.end_time === 'string') {
      // Keep the exact string format to preserve timezone information
      console.log('Preserving exact end_time string for update:', eventData.end_time);
    }
    
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      eventData,
      { new: true }
    );
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Log the updated event dates for debugging
    console.log('Updated event dates:', {
      start: event.start_time,
      end: event.end_time,
      startISO: event.start_time.toISOString(),
      startLocal: event.start_time.toString()
    });
    
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event
router.delete('/:id', async (req, res) => {
  try {
    let eventId = req.params.id;
    console.log(`Deleting event ID: ${eventId}`);
    
    // Check if this is a recurring instance ID (format: originalId-timestamp)
    let isRecurringInstance = false;
    if (eventId.includes('-')) {
      isRecurringInstance = true;
      // Extract the original event ID
      eventId = eventId.split('-')[0];
      console.log(`Recurring instance detected. Original event ID: ${eventId}`);
    }
    
    // First, delete all study sessions associated with this event
    const studySessionsResult = await Event.deleteMany({
      related_event_id: eventId,
      is_study_session: true
    });
    
    console.log(`Deleted ${studySessionsResult.deletedCount} associated study sessions`);
    
    // Whether it's a recurring instance or a regular event, delete the original event
    const event = await Event.findByIdAndDelete(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // If it was a recurring instance, inform the client
    if (isRecurringInstance) {
      return res.json({ 
        message: 'Recurring event deleted successfully',
        originalEventId: eventId,
        wasRecurring: true,
        studySessionsDeleted: studySessionsResult.deletedCount
      });
    }
    
    // For regular events
    res.json({ 
      message: 'Event deleted successfully', 
      studySessionsDeleted: studySessionsResult.deletedCount 
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Import events from Google Calendar with uniqueness check
router.post('/google-import', async (req, res) => {
  try {
    const { events, userId } = req.body;
    
    console.log(`Received request to import ${events?.length || 0} Google Calendar events for user ID: ${userId}`);
    console.log('User ID type:', typeof userId);
    
    if (!Array.isArray(events) || !userId) {
      return res.status(400).json({ 
        message: 'Invalid request. Events must be an array and userId is required.' 
      });
    }

    const results = {
      imported: 0,
      skipped: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Process each event
    for (const event of events) {
      try {
        // Check if event is deleted
        if (event.isDeleted) {
          // If the event is deleted, remove it from our database
          if (event.googleEventId) {
            const deleteResult = await Event.deleteOne({ google_event_id: event.googleEventId });
            if (deleteResult.deletedCount > 0) {
              results.deleted++;
              console.log(`Deleted event with Google ID: ${event.googleEventId}`);
            }
          }
          continue;
        }
        
        // Check if required fields are present for non-deleted events
        if (!event.title || event.allDay === undefined || 
            !event.start || !event.end || !event.googleEventId) {
          results.errors.push({
            eventId: event.googleEventId || 'unknown',
            error: 'Missing required fields'
          });
          continue;
        }

        // Check if event already exists by google_event_id
        const existingEvent = await Event.findOne({ google_event_id: event.googleEventId });

        if (existingEvent) {
          // Update existing event
          existingEvent.title = event.title;
          existingEvent.all_day = event.allDay;
          existingEvent.start_time = new Date(event.start);
          existingEvent.end_time = new Date(event.end);
          existingEvent.description = event.description || '';
          existingEvent.location = event.location || '';
          existingEvent.color = event.color || '#d2b48c';
          
          await existingEvent.save();
          results.updated++;
        } else {
          // Create new event
          const newEvent = new Event({
            user_id: userId,
            title: event.title,
            all_day: event.allDay,
            start_time: new Date(event.start),
            end_time: new Date(event.end),
            source: 'GOOGLE_CALENDAR',
            description: event.description || '',
            location: event.location || '',
            requires_preparation: false,
            color: event.color || '#d2b48c',
            google_event_id: event.googleEventId
            // group_id is not required as we've made it optional in the schema
          });
          
          await newEvent.save();
          results.imported++;
        }
      } catch (error) {
        console.error(`Error processing event ${event.googleEventId || 'unknown'}:`, error);
        results.errors.push({
          eventId: event.googleEventId || 'unknown',
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: 'Google Calendar import completed',
      results
    });
  } catch (error) {
    console.error('Error importing Google Calendar events:', error);
    res.status(500).json({ message: 'Server error during import' });
  }
});

// Update Google Calendar sync token for a user
router.post('/google-sync-token', async (req, res) => {
  try {
    const { userId, syncToken } = req.body;
    
    console.log(`Updating Google Calendar sync token for user ${userId}`);
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Find the user
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update the sync token
    user.google_calendar_sync_token = syncToken || '';
    await user.save();
    
    res.json({
      message: 'Google Calendar sync token updated successfully',
      syncToken: user.google_calendar_sync_token
    });
  } catch (error) {
    console.error('Error updating Google Calendar sync token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Google Calendar sync token for a user
router.get('/google-sync-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`Getting Google Calendar sync token for user ${userId}`);
    
    // Find the user
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      syncToken: user.google_calendar_sync_token || null
    });
  } catch (error) {
    console.error('Error getting Google Calendar sync token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
