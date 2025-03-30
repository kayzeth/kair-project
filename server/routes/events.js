const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Get all events for a user
router.get('/', async (req, res) => {
    try {
        const userId = req.headers['user-id']; // You'll need to pass this from your frontend
        if (!userId) {
            return res.status(401).json({ message: 'User ID required' });
        }

        const events = await Event.find({ userId });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create multiple events
router.post('/', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        if (!userId) {
            return res.status(401).json({ message: 'User ID required' });
        }

        // Check if we received an array of events
        const events = Array.isArray(req.body) ? req.body : [req.body];

        // First, remove existing events of the same type to avoid duplicates
        const firstEvent = events[0];
        if (firstEvent && (firstEvent.type === 'canvas' || firstEvent.type === 'google')) {
            await Event.deleteMany({ userId, type: firstEvent.type });
        }

        // Then create all new events
        const newEvents = await Event.insertMany(events.map(event => ({ ...event, userId })));
        res.status(201).json(newEvents);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update an event
router.put('/:id', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        const event = await Event.findOne({ _id: req.params.id, userId });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        Object.assign(event, req.body);
        const updatedEvent = await event.save();
        res.json(updatedEvent);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete an event
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        const event = await Event.findOneAndDelete({ _id: req.params.id, userId });
        
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
