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
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event
router.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
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
