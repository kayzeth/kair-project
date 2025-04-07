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
    const events = await Event.find({ user_id: userId });
    res.json(events);
  } catch (error) {
    console.error('Error fetching user events:', error);
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
    const eventId = req.params.id;
    console.log(`Deleting event ID: ${eventId}`);
    
    // First, delete all study sessions associated with this event
    const studySessionsResult = await Event.deleteMany({
      related_event_id: eventId,
      is_study_session: true
    });
    
    console.log(`Deleted ${studySessionsResult.deletedCount} associated study sessions`);
    
    // Then delete the main event
    const event = await Event.findByIdAndDelete(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
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
    
    if (!Array.isArray(events) || !userId) {
      return res.status(400).json({ 
        message: 'Invalid request. Events must be an array and userId is required.' 
      });
    }

    const results = {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: []
    };

    // Process each event
    for (const event of events) {
      try {
        // Check if required fields are present
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

module.exports = router;
