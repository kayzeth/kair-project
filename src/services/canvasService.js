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
      console.log('Fetching all courses...');
      const response = await fetch(PROXY_URL + 'courses?include[]=term&per_page=100', {
        headers: {
          'Authorization': token,
          'x-canvas-domain': domain
        }
      });

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

  fetchCalendarEventsForCourse: async (courseId) => {
    const token = localStorage.getItem('canvasToken');
    const domain = localStorage.getItem('canvasDomain');
    
    if (!token || !domain) {
      throw new Error('Canvas credentials not found');
    }

    try {
      console.log(`Fetching calendar events for course ${courseId}...`);
      // Updated query parameters:
      // - Removed type=event since we want all types
      // - Added include[]=web_conference to get more details
      // - Added all_events=1 to get all events including hidden ones
      const response = await fetch(PROXY_URL + `calendar_events?context_codes[]=course_${courseId}&all_events=1&include[]=web_conference&per_page=100`, {
        headers: {
          'Authorization': token,
          'x-canvas-domain': domain
        }
      });

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

  syncWithCalendar: async () => {
    try {
      // Get all enrolled courses
      const courses = await canvasService.fetchEnrolledCourses();
      console.log('Fetching assignments and calendar events for', courses.length, 'courses...');
      
      // Fetch both assignments and calendar events for each course
      const coursePromises = courses.map(course => 
        Promise.all([
          canvasService.fetchAssignmentsForCourse(course.id)
            .then(assignments => {
              console.log(`Processing ${assignments.length} assignments for course: ${course.name}`);
              return assignments.map(assignment => ({
                ...assignment,
                courseName: course.name,
                type: 'assignment'
              }));
            })
            .catch(error => {
              console.error(`Error fetching assignments for course ${course.name}:`, error);
              return []; // Continue with other courses if one fails
            }),
          canvasService.fetchCalendarEventsForCourse(course.id)
            .then(events => {
              console.log(`Processing ${events.length} calendar events for course: ${course.name}`);
              return events.map(event => ({
                ...event,
                courseName: course.name,
                type: 'class'
              }));
            })
            .catch(error => {
              console.error(`Error fetching calendar events for course ${course.name}:`, error);
              return []; // Continue with other courses if one fails
            })
        ])
      );

      const allCourseData = await Promise.all(coursePromises);
      const allAssignments = allCourseData.map(data => data[0]).flat();
      const allClassEvents = allCourseData.map(data => data[1]).flat();

      console.log('Total assignments found:', allAssignments.length);
      console.log('Total class events found:', allClassEvents.length);

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
      const assignmentEvents = allAssignments
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
          
          return {
            id: `canvas-${assignment.id}`,
            title: `${assignment.courseName}: ${assignment.name}`,
            start: dueDate,
            end: dueDate,
            description: assignment.description || '',
            type: 'canvas',
            color: '#4287f5', // Blue for assignments
            metadata: {
              courseId: assignment.course_id,
              assignmentId: assignment.id,
              points: assignment.points_possible,
              url: assignment.html_url,
              eventType: 'assignment'
            }
          };
        });

      // Convert class events to calendar events
      const classEvents = allClassEvents
        .filter(event => {
          const hasStartDate = !!event.start_at;
          if (!hasStartDate) {
            console.log(`Skipping class event without start date: ${event.title} in ${event.courseName}`);
          }
          return hasStartDate;
        })
        .map(event => {
          const startDate = new Date(event.start_at);
          const endDate = event.end_at ? new Date(event.end_at) : startDate;
          console.log(`Creating calendar event for class: ${event.title} (start: ${startDate.toLocaleString()})`);
          
          return {
            id: `canvas-class-${event.id}`,
            title: `${event.courseName}: ${event.title}`,
            start: startDate,
            end: endDate,
            description: event.description || '',
            location: event.location_name || '',
            type: 'canvas',
            color: '#50C878', // Emerald green for class events
            metadata: {
              courseId: event.context_code?.replace('course_', ''),
              eventId: event.id,
              url: event.html_url,
              eventType: 'class'
            }
          };
        });

      // Combine all events
      const allCanvasEvents = [...assignmentEvents, ...classEvents];
      console.log('Created', allCanvasEvents.length, 'total Canvas events');

      // Merge Canvas events with other events
      const updatedEvents = [...nonCanvasEvents, ...allCanvasEvents];
      console.log('Saving', updatedEvents.length, 'total events to localStorage');
      
      // Store all events in localStorage
      localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));

      // Also save Canvas events to MongoDB
      try {
        // Use a test user ID for now - you'll want to replace this with actual user authentication later
        const testUserId = 'test-user-1';
        await eventService.saveEvents(allCanvasEvents.map(event => ({
          userId: testUserId,
          title: event.title,
          description: event.description,
          startDate: event.start,
          endDate: event.end,
          canvasEventId: event.metadata.assignmentId || event.metadata.eventId,
          courseId: event.metadata.courseId,
          type: 'canvas',
          color: event.color,
          isCompleted: false,
          location: event.location || ''
        })), testUserId);
        console.log('Successfully saved Canvas events to MongoDB');
      } catch (error) {
        console.error('Failed to save events to MongoDB:', error);
        // Don't throw the error - we still want to keep the localStorage functionality working
      }

      // Return the total number of events for display in the UI
      return allCanvasEvents.length;
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
