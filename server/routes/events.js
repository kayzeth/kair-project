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

// Create a new event
router.post('/', async (req, res) => {
    try {
        const userId = req.headers['user-id'];
        if (!userId) {
            return res.status(401).json({ message: 'User ID required' });
        }

        const event = new Event({
            ...req.body,
            userId
        });

        const newEvent = await event.save();
        res.status(201).json(newEvent);
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
