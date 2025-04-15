const PROXY_URL = process.env.NODE_ENV === 'production' 
  ? '/api/canvas/'  // In production, use relative path
  : 'http://localhost:3001/api/canvas/';  // In development, use full URL

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'  // In production, use relative path
  : 'http://localhost:3001/api';  // In development, use full URL

const canvasService = {
  testConnection: async (userId) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Get credentials from database
      const response = await fetch(`${API_URL}/lmsintegration`);
      if (!response.ok) {
        throw new Error('Failed to fetch LMS integrations');
      }
      
      const integrations = await response.json();
      const userIntegration = integrations.find(
        integration => integration.user_id === userId && integration.lms_type === 'CANVAS'
      );

      if (!userIntegration) {
        throw new Error('Canvas credentials not found');
      }

      // Test connection with credentials
      const testResponse = await fetch(PROXY_URL + 'users/self', {
        headers: {
          'Authorization': userIntegration.token,
          'x-canvas-domain': userIntegration.domain
        }
      });

      if (!testResponse.ok) {
        const error = await testResponse.text();
        throw new Error(error || 'Failed to connect to Canvas API');
      }
      return true;
    } catch (error) {
      console.error('Canvas API connection error:', error);
      throw error;
    }
  },

  fetchEnrolledCourses: async () => {
    try {
      console.log('Fetching all courses...');
      const response = await fetch(PROXY_URL + 'courses?include[]=term&per_page=100');

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const courses = await response.json();
      console.log('Total courses from API:', courses.length);
      
      // Log each course's basic info
      courses.forEach(course => {
        console.log(`Course: ${course.name}
          ID: ${course.id}
          Term: ${course.term?.name || 'No term'}
          State: ${course.workflow_state}
          Published: ${course.workflow_state === 'available'}
          Access: ${course.access_restricted_by_date ? 'Date restricted' : 'Available'}
          Start: ${course.term?.start_at || 'No start date'}
          End: ${course.term?.end_at || 'No end date'}`
        );
      });

      return courses; // Return ALL courses, no filtering
    } catch (error) {
      console.error('Failed to fetch Canvas courses:', error);
      throw error;
    }
  },

  fetchAssignmentsForCourse: async (courseId) => {
    try {
      console.log(`Fetching assignments for course ${courseId}...`);
      const response = await fetch(PROXY_URL + `courses/${courseId}/assignments?include[]=due_at&include[]=description`);

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to fetch assignments for course ${courseId}:`, error);
        throw new Error(`Failed to fetch assignments: ${error}`);
      }

      const assignments = await response.json();
      console.log(`Found ${assignments.length} assignments for course ${courseId}`);
      return assignments;
    } catch (error) {
      console.error(`Failed to fetch assignments for course ${courseId}:`, error);
      throw error;
    }
  },

  fetchCalendarEventsForCourse: async (courseId) => {
    try {
      console.log(`Fetching calendar events for course ${courseId}...`);
      // Updated query parameters:
      // - Removed type=event since we want all types
      // - Added include[]=web_conference to get more details
      // - Added all_events=1 to get all events including hidden ones
      const response = await fetch(PROXY_URL + `calendar_events?context_codes[]=course_${courseId}&all_events=1&include[]=web_conference&per_page=100`);

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to fetch calendar events for course ${courseId}:`, error);
        throw new Error(`Failed to fetch calendar events: ${error}`);
      }

      const events = await response.json();
      console.log(`Found ${events.length} calendar events for course ${courseId}`);
      // Log a sample event to see its structure
      if (events.length > 0) {
        console.log('Sample calendar event:', JSON.stringify(events[0], null, 2));
      }
      return events;
    } catch (error) {
      console.error(`Failed to fetch calendar events for course ${courseId}:`, error);
      throw error;
    }
  },

  syncWithCalendar: async (userId) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const response = await fetch(`${API_URL}/lmsintegration/sync/canvas/${userId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync Canvas calendar');
      }

      const result = await response.json();
      return result.eventsAdded;
    } catch (error) {
      console.error('Failed to sync Canvas calendar:', error);
      throw error;
    }
  },

  setCredentials: async (token, domain, userId) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Add Bearer prefix to token if not present
    const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    // Accept either canvas.*.edu or *.instructure.com format
    let formattedDomain = domain;
    if (domain.includes('instructure.com')) {
      // Already in instructure.com format, use as is
      formattedDomain = domain;
    } else if (domain.includes('canvas.') && domain.endsWith('.edu')) {
      // Already in canvas.*.edu format, use as is
      formattedDomain = domain;
    } else {
      // Try to format as canvas.*.edu
      formattedDomain = `canvas.${domain}.edu`;
    }

    try {
      // Store in database
      const response = await fetch(`${API_URL}/lmsintegration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          lms_type: 'CANVAS',
          token: formattedToken,
          domain: formattedDomain
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save Canvas credentials');
      }

      // Test connection with new credentials
      await canvasService.testConnection(userId);
    } catch (error) {
      console.error('Failed to save Canvas credentials:', error);
      throw error;
    }
  },

  clearCredentials: async (userId) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Find and delete the integration from database
      const response = await fetch(`${API_URL}/lmsintegration`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LMS integrations');
      }

      const integrations = await response.json();
      const userIntegration = integrations.find(
        integration => integration.user_id === userId && integration.lms_type === 'CANVAS'
      );

      if (userIntegration) {
        const deleteResponse = await fetch(`${API_URL}/lmsintegration/${userIntegration._id}`, {
          method: 'DELETE'
        });

        if (!deleteResponse.ok) {
          throw new Error('Failed to delete Canvas integration');
        }
      }
    } catch (error) {
      console.error('Failed to clear Canvas credentials:', error);
      throw error;
    }
  }
};

export default canvasService;
