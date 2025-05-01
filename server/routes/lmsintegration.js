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
  const coursesResponse = await fetch(`https://${integration.domain}/api/v1/courses?` +
    `include[]=term&` +
    `include[]=concluded&` + // Include concluded courses
    `enrollment_state[]=active&` +
    `enrollment_state[]=completed&` + // Include completed enrollments
    `per_page=100&` +
    `state[]=available&` +
    `state[]=completed&` + // Include completed courses
    `state[]=unpublished`, // Include unpublished courses
    {
      headers: {
        'Authorization': integration.token,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!coursesResponse.ok) {
    throw new Error('Failed to fetch Canvas courses');
  }

  const courses = await coursesResponse.json();
  const events = [];

  // For each course, fetch assignments and calendar events
  for (const course of courses) {
    // Skip if assignments tab is hidden
    if (course.tab_configuration?.some(tab => tab.id === 'assignments' && tab.hidden)) {
      continue;
    }

    // Fetch assignments
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const oneYearAhead = new Date(now);
    oneYearAhead.setFullYear(now.getFullYear() + 1);

    const assignmentParams = new URLSearchParams({
      'include[]': 'description',
      'include[]': 'due_at',
      'include[]': 'submission',
      'include[]': 'overrides',
      'order_by': 'due_at',
      'per_page': '100',
      'start_date': oneYearAgo.toISOString(),
      'end_date': oneYearAhead.toISOString()
    });

    const assignmentsResponse = await fetch(
      `https://${integration.domain}/api/v1/courses/${course.id}/assignments?${assignmentParams.toString()}`,
      {
        headers: {
          'Authorization': integration.token
        }
      }
    );

    if (!assignmentsResponse.ok) {
      console.warn(`Failed to fetch assignments for course ${course.id}:`, await assignmentsResponse.text());
      continue;
    }

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
        source: 'CANVAS', // Use 'CANVAS' instead of 'LMS' for better tracking
        requires_preparation: true,
        requires_hours: null, // Explicitly set to null instead of defaulting to 0
        study_suggestions_shown: false, // Ensure this is set to false so nudger will identify it
        study_suggestions_accepted: false, // Initialize as false
        metadata: {
          courseId: course.id,
          assignmentId: assignment.id,
          points: assignment.points_possible,
          url: assignment.html_url
        }
      }));
    
    events.push(...assignmentEvents);

    // Fetch calendar events
    const calendarParams = new URLSearchParams({
      'context_codes[]': `course_${course.id}`,
      'type': 'event',
      'start_date': oneYearAgo.toISOString(),
      'end_date': oneYearAhead.toISOString(),
      'per_page': '100'
    });

    const calendarResponse = await fetch(
      `https://${integration.domain}/api/v1/calendar_events?${calendarParams.toString()}`,
      {
        headers: {
          'Authorization': integration.token
        }
      }
    );

    if (!calendarResponse.ok) {
      console.warn(`Failed to fetch calendar events for course ${course.id}:`, await calendarResponse.text());
      continue;
    }

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
        source: 'CANVAS', // Use 'CANVAS' instead of 'LMS' for better tracking
        metadata: {
          courseId: course.id,
          eventId: event.id,
          url: event.html_url
        }
      }));
    
    events.push(...classEvents);
  }

  // Delete existing Canvas events for this user
  await Event.deleteMany({ 
    user_id: userId,
    source: 'CANVAS'
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