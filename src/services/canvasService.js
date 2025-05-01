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

      console.log(`[Canvas] API Response status: ${testResponse.status}`);
      
      if (!testResponse.ok) {
        const error = await testResponse.text();
        console.error('[Canvas] API Error response:', error);
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

      console.log(`[Canvas] API Response status: ${response.status}`);
      
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
      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);
      const ninetyDaysAhead = new Date(now);
      ninetyDaysAhead.setDate(now.getDate() + 90);

      const params = new URLSearchParams();
      params.append('include[]', 'due_at');
      params.append('include[]', 'description');
      params.append('include[]', 'submission');
      params.append('include[]', 'overrides');
      params.append('order_by', 'due_at');
      params.append('per_page', '100');
      params.append('start_date', ninetyDaysAgo.toISOString());
      params.append('end_date', ninetyDaysAhead.toISOString());

      const response = await fetch(`${PROXY_URL}courses/${courseId}/assignments?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch assignments: ${error}`);
      }

      const assignments = await response.json();
      return assignments;
    } catch (error) {
      console.error(`Failed to fetch assignments for course ${courseId}:`, error);
      throw error;
    }
  },

  fetchCalendarEventsForCourse: async (courseId) => {
    try {
      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 90);
      const ninetyDaysAhead = new Date(now);
      ninetyDaysAhead.setDate(now.getDate() + 90);

      const params = new URLSearchParams();
      params.append('context_codes[]', `course_${courseId}`);
      params.append('type', 'event');
      params.append('start_date', ninetyDaysAgo.toISOString());
      params.append('end_date', ninetyDaysAhead.toISOString());
      params.append('include[]', 'description');
      params.append('per_page', '100');

      const response = await fetch(`${PROXY_URL}calendar_events?${params.toString()}`);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch calendar events: ${error}`);
      }

      const events = await response.json();
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
      console.log('[Canvas] Syncing with calendar - Starting validation');
      const response = await fetch(`${API_URL}/lmsintegration/sync/canvas/${userId}`, {
        method: 'POST'
      });

      console.log(`[Canvas] API Response status: ${response.status}`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[Canvas] API Error response:', error.message);
        throw new Error(error.message || 'Failed to sync Canvas calendar');
      }

      const result = await response.json();
      console.log('[Canvas] Synced with calendar successfully');

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

    console.log('[Canvas] Setting credentials - Starting validation');
    try {
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

      console.log('[Canvas] Sending integration request with:', {
        domain: formattedDomain,
        tokenLength: formattedToken.length,
        userId
      });

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

      console.log(`[Canvas] API Response status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage;
        try {
          const error = await response.json();
          errorMessage = error.message;
          console.error('[Canvas] Detailed error:', error);
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = errorText;
          console.error('[Canvas] Raw error text:', errorText);
        }
        console.error('[Canvas] API Error response:', errorMessage);
        throw new Error(errorMessage || 'Failed to save Canvas credentials');
      }

      console.log('[Canvas] Credentials validated successfully');

      // Test connection with new credentials
      await canvasService.testConnection(userId);
    } catch (error) {
      console.error('[Canvas] Failed to save credentials:', error);
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

      console.log(`[Canvas] API Response status: ${response.status}`);
      
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

        console.log(`[Canvas] API Response status: ${deleteResponse.status}`);
        
        if (!deleteResponse.ok) {
          throw new Error('Failed to delete Canvas integration');
        }
      }
    } catch (error) {
      console.error('[Canvas] Failed to clear credentials:', error);
      throw error;
    }
  }
};

export default canvasService;
