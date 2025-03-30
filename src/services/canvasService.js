import eventService from './eventService';

const PROXY_URL = process.env.NODE_ENV === 'production' 
  ? '/api/canvas/'  // In production, use relative path
  : 'http://localhost:3001/api/canvas/';  // In development, use full URL

console.log(process.env.NODE_ENV);

const canvasService = {
  testConnection: async () => {
    const token = localStorage.getItem('canvasToken');
    const domain = localStorage.getItem('canvasDomain');
    
    if (!token || !domain) {
      throw new Error('Canvas credentials not found');
    }

    try {
      const response = await fetch(PROXY_URL + 'users/self', {
        headers: {
          'Authorization': token,
          'x-canvas-domain': domain
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to connect to Canvas API');
      }

      return true;
    } catch (error) {
      console.error('Canvas API connection error:', error);
      throw error;
    }
  },

  fetchEnrolledCourses: async () => {
    const token = localStorage.getItem('canvasToken');
    const domain = localStorage.getItem('canvasDomain');
    
    if (!token || !domain) {
      throw new Error('Canvas credentials not found');
    }

    try {
      const response = await fetch(PROXY_URL + 'courses?enrollment_state=active&include[]=term', {
        headers: {
          'Authorization': token,
          'x-canvas-domain': domain
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      console.log(response);

      const courses = await response.json();
      
      // Filter for courses in the current term
      const now = new Date();
      const currentCourses = courses.filter(course => {
        const term = course.term;
        if (!term) return false;
        
        const startDate = term.start_at ? new Date(term.start_at) : null;
        const endDate = term.end_at ? new Date(term.end_at) : null;
        
        // If no dates are specified, include the course
        if (!startDate && !endDate) return true;
        
        // If only start date is specified, check if it's in the past
        if (startDate && !endDate) return startDate <= now;
        
        // If only end date is specified, check if it's in the future
        if (!startDate && endDate) return endDate >= now;
        
        // If both dates are specified, check if current date is within range
        return startDate <= now && endDate >= now;
      });

      console.log('Found', currentCourses.length, 'current active courses');
      return currentCourses;
    } catch (error) {
      console.error('Failed to fetch Canvas courses:', error);
      throw error;
    }
  },

  fetchAssignmentsForCourse: async (courseId) => {
    const token = localStorage.getItem('canvasToken');
    const domain = localStorage.getItem('canvasDomain');
    
    if (!token || !domain) {
      throw new Error('Canvas credentials not found');
    }

    try {
      console.log(`Fetching assignments for course ${courseId}...`);
      const response = await fetch(PROXY_URL + `courses/${courseId}/assignments?include[]=due_at&include[]=description`, {
        headers: {
          'Authorization': token,
          'x-canvas-domain': domain
        }
      });

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

  syncWithCalendar: async () => {
    try {
      // Get all enrolled courses
      const courses = await canvasService.fetchEnrolledCourses();
      console.log('Fetching assignments for', courses.length, 'courses...');
      
      // Fetch assignments for each course
      const assignmentPromises = courses.map(course => 
        canvasService.fetchAssignmentsForCourse(course.id)
          .then(assignments => {
            console.log(`Processing ${assignments.length} assignments for course: ${course.name}`);
            return assignments.map(assignment => ({
              ...assignment,
              courseName: course.name
            }));
          })
          .catch(error => {
            console.error(`Error fetching assignments for course ${course.name}:`, error);
            return []; // Continue with other courses if one fails
          })
      );

      const allAssignments = (await Promise.all(assignmentPromises)).flat();
      console.log('Total assignments found:', allAssignments.length);

      // Get existing events from localStorage
      const existingEvents = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
      console.log('Found', existingEvents.length, 'existing events in localStorage');
      
      // Convert non-canvas events back to Date objects
      const nonCanvasEvents = existingEvents
        .filter(event => event.type !== 'canvas')
        .map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
      console.log('Keeping', nonCanvasEvents.length, 'non-Canvas events');

      // Convert assignments to calendar events
      const calendarEvents = allAssignments
        .filter(assignment => {
          const hasDueDate = !!assignment.due_at;
          if (!hasDueDate) {
            console.log(`Skipping assignment without due date: ${assignment.name} in ${assignment.courseName}`);
          }
          return hasDueDate;
        })
        .map(assignment => {
          const dueDate = new Date(assignment.due_at);
          console.log(`Creating calendar event for: ${assignment.name} (due: ${dueDate.toLocaleString()})`);
          
          // Create an all-day event if the due time is midnight (00:00:00)
          const isAllDay = dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
          
          return {
            id: `canvas-${assignment.id}`, // Unique ID for Canvas assignments
            title: `${assignment.courseName}: ${assignment.name}`,
            start: dueDate,
            end: dueDate,
            description: assignment.description || '',
            type: 'canvas',
            allDay: isAllDay,
            color: '#4287f5', // Nice shade of blue
            metadata: {
              courseId: assignment.course_id,
              assignmentId: assignment.id,
              points: assignment.points_possible,
              url: assignment.html_url
            }
          };
        });

      console.log('Created', calendarEvents.length, 'calendar events');

      // Merge Canvas events with other events
      const updatedEvents = [...nonCanvasEvents, ...calendarEvents];
      console.log('Saving', updatedEvents.length, 'total events to localStorage');
      
      // Store all events in localStorage
      localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));

      // Also save Canvas events to MongoDB
      try {
        // Use a test user ID for now - you'll want to replace this with actual user authentication later
        const testUserId = 'test-user-1';
        await eventService.saveEvents(calendarEvents.map(event => ({
          userId: testUserId,
          title: event.title,
          description: event.description,
          startDate: event.start,
          endDate: event.end,
          canvasEventId: event.metadata.assignmentId,
          courseId: event.metadata.courseId,
          type: 'canvas',
          color: event.color,
          isCompleted: false
        })), testUserId);
        console.log('Successfully saved Canvas events to MongoDB');
      } catch (error) {
        console.error('Failed to save events to MongoDB:', error);
        // Don't throw the error - we still want to keep the localStorage functionality working
      }

      return calendarEvents.length;
    } catch (error) {
      console.error('Failed to sync Canvas calendar:', error);
      throw error;
    }
  },

  setCredentials: (token, domain) => {
    // Format domain to ensure it has the canvas.*.edu format
    let formattedDomain = domain;
    if (!domain.includes('.')) {
      // If domain is just the school name (e.g., 'harvard'), format it properly
      formattedDomain = `canvas.${domain}.edu`;
    } else if (!domain.startsWith('canvas.')) {
      // If domain has dots but doesn't start with 'canvas.' (e.g., 'harvard.edu')
      formattedDomain = `canvas.${domain}`;
    } else if (!domain.endsWith('.edu')) {
      // If domain starts with 'canvas.' but doesn't end with '.edu'
      formattedDomain = `${domain}.edu`;
    }

    // Add Bearer prefix to token and store credentials in localStorage
    const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    localStorage.setItem('canvasToken', formattedToken);
    localStorage.setItem('canvasDomain', formattedDomain);
  },

  clearCredentials: () => {
    localStorage.removeItem('canvasToken');
    localStorage.removeItem('canvasDomain');
  }
};

export default canvasService;
