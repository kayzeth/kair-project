const express = require('express');
const router = express.Router();
const LmsIntegration = require('../models/LmsIntegration');
const Event = require('../models/Event');
const fetch = require('node-fetch');

// Get all LMS integrations
router.get('/', async (req, res) => {
  try {
    const integrations = await LmsIntegration.find();
    res.json(integrations);
  } catch (error) {
    console.error('Error fetching LMS integrations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get LMS integration by ID
router.get('/:id', async (req, res) => {
  try {
    const integration = await LmsIntegration.findById(req.params.id);
    if (!integration) {
      return res.status(404).json({ message: 'LMS integration not found' });
    }
    res.json(integration);
  } catch (error) {
    console.error('Error fetching LMS integration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new LMS integration
router.post('/', async (req, res) => {
  try {
    const integration = new LmsIntegration(req.body);
    await integration.save();

    // If this is a Canvas integration, trigger initial sync
    if (integration.lms_type === 'CANVAS') {
      try {
        // Make internal request to sync endpoint
        await syncCanvasEvents(integration.user_id);
      } catch (syncError) {
        console.error('Error during initial Canvas sync:', syncError);
        // Don't fail the integration creation if sync fails
      }
    }

    res.status(201).json(integration);
  } catch (error) {
    console.error('Error creating LMS integration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update LMS integration
router.put('/:id', async (req, res) => {
  try {
    const integration = await LmsIntegration.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!integration) {
      return res.status(404).json({ message: 'LMS integration not found' });
    }
    res.json(integration);
  } catch (error) {
    console.error('Error updating LMS integration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete LMS integration
router.delete('/:id', async (req, res) => {
  try {
    const integration = await LmsIntegration.findByIdAndDelete(req.params.id);
    if (!integration) {
      return res.status(404).json({ message: 'LMS integration not found' });
    }
    res.json({ message: 'LMS integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting LMS integration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to sync Canvas events
async function syncCanvasEvents(userId) {
  const integration = await LmsIntegration.findOne({ 
    user_id: userId,
    lms_type: 'CANVAS'
  });

  if (!integration) {
    throw new Error('Canvas integration not found for user');
  }

  // Fetch courses from Canvas
  const coursesResponse = await fetch(`https://${integration.domain}/api/v1/courses?include[]=term&per_page=100`, {
    headers: {
      'Authorization': integration.token,
      'Content-Type': 'application/json'
    }
  });

  if (!coursesResponse.ok) {
    throw new Error('Failed to fetch Canvas courses');
  }

  const courses = await coursesResponse.json();
  const events = [];

  // For each course, fetch assignments and calendar events
  for (const course of courses) {
    // Fetch assignments
    const assignmentsResponse = await fetch(
      `https://${integration.domain}/api/v1/courses/${course.id}/assignments?` +
      `include[]=due_at&` +
      `include[]=description&` +
      `order_by=due_at&` +
      `per_page=100`,
      {
        headers: {
          'Authorization': integration.token,
          'Content-Type': 'application/json'
        }
      }
    );

    if (assignmentsResponse.ok) {
      const assignments = await assignmentsResponse.json();
      
      const assignmentEvents = assignments
        .filter(assignment => assignment.due_at)
        .map(assignment => ({
          user_id: userId,
          title: `${course.name}: ${assignment.name}`,
          all_day: false,
          start_time: new Date(assignment.due_at),
          end_time: new Date(assignment.due_at),
          description: assignment.description || '',
          source: 'LMS',
          requires_preparation: true,
          metadata: {
            courseId: course.id,
            assignmentId: assignment.id,
            points: assignment.points_possible,
            url: assignment.html_url
          }
        }));
      
      events.push(...assignmentEvents);
    }

    // Fetch calendar events
    const calendarResponse = await fetch(
      `https://${integration.domain}/api/v1/calendar_events?` + 
      `context_codes[]=course_${course.id}&` +
      `all_events=1&` +
      `type=event&` +
      `start_date=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}&` +
      `end_date=${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()}`,
      {
        headers: {
          'Authorization': integration.token,
          'Content-Type': 'application/json'
        }
      }
    );

    if (calendarResponse.ok) {
      const calendarEvents = await calendarResponse.json();
      
      const classEvents = calendarEvents
        .filter(event => event.start_at)
        .map(event => ({
          user_id: userId,
          title: `${course.name}: ${event.title}`,
          all_day: event.all_day || false,
          start_time: new Date(event.start_at),
          end_time: event.end_at ? new Date(event.end_at) : new Date(event.start_at),
          description: event.description || '',
          location: event.location_name || '',
          source: 'LMS',
          metadata: {
            courseId: course.id,
            eventId: event.id,
            url: event.html_url
          }
        }));
      
      events.push(...classEvents);
    }
  }

  // Delete existing Canvas events for this user
  await Event.deleteMany({ 
    user_id: userId,
    source: 'LMS'
  });

  // Insert new events
  if (events.length > 0) {
    await Event.insertMany(events);
  }

  // Update last_synced timestamp
  integration.last_synced = new Date();
  await integration.save();

  return events.length;
}

// Sync Canvas events for a user
router.post('/sync/canvas/:userId', async (req, res) => {
  try {
    const eventsAdded = await syncCanvasEvents(req.params.userId);
    res.json({ 
      message: 'Canvas sync completed successfully',
      eventsAdded
    });
  } catch (error) {
    console.error('Error syncing Canvas events:', error);
    res.status(500).json({ message: 'Server error during Canvas sync' });
  }
});

module.exports = router;