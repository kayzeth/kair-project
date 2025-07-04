/**
 * Gemini Service - KAIR-35, KAIR-41
 * 
 * This service provides intelligent study suggestions 
 * based on the user's calendar and preparation requirements.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { format } from 'date-fns';
import eventService from './eventService';

// Global variable to store the Gemini API client
let genAI = null;

/**
 * Fetch API key from the server
 * @returns {Promise<string|null>} - The API key or null if not available
 */
export const getApiKey = async () => {
  try {
    // For testing environments, use a mock API key
    if (process.env.NODE_ENV === 'test') {
      console.log('Using mock API key for testing environment');
      return 'test-api-key';
    }
    
    // Try to get the API key from the public endpoint first (no authentication required)
    // This is useful during development and initial page load
    const response = await fetch('/api/gemini/api-key-public', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API key: ${response.status}`);
    }
    
    const data = await response.json();
    return data.apiKey;
  } catch (error) {
    console.error('Error fetching Gemini API key:', error);
    
    // Fallback for testing or when server is unavailable
    if (process.env.NODE_ENV === 'test') {
      return 'test-api-key';
    }
    
    return null;
  }
};

/**
 * Stub function for backward compatibility
 * @deprecated Use server-side API key instead
 * @param {string} apiKey - The API key to save
 * @param {string} persistence - Where to save the key: 'session', 'local', or 'none'
 * @returns {boolean} - Always returns true
 */
export const saveApiKey = (apiKey, persistence = 'session') => {
  console.warn('saveApiKey is deprecated. Using server-side API key instead.');
  return true;
};

/**
 * Stub function for backward compatibility
 * @deprecated Use server-side API key instead
 * @returns {boolean} - Always returns true
 */
export const clearApiKey = () => {
  console.warn('clearApiKey is deprecated. Using server-side API key instead.');
  return true;
};

/**
 * Initialize the Gemini API with the API key from the server
 * @returns {Promise<Object|null>|Object|null} - The Gemini API client or null if initialization failed
 */
export const initializeGenAI = async () => {
  try {
    // If genAI is already initialized, return it
    if (genAI) {
      return genAI;
    }
    
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('No API key available for Gemini');
      return null;
    }
    
    // Initialize the API with the key
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('Gemini API initialized successfully');
    return genAI;
  } catch (error) {
    console.error('Error initializing Gemini API:', error);
    return null;
  }
};

// Synchronous version for backward compatibility
export const initializeGenAISync = () => {
  if (genAI) {
    return genAI;
  }
  
  console.warn('Using synchronous initializeGenAI - this will be deprecated in future versions');
  // Start the async initialization but return the current state
  initializeGenAI().catch(err => console.error('Async initialization failed:', err));
  return genAI;
};

/**
 * Format a date for display in a user-friendly way
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  return format(dateObj, 'EEEE, MMMM d, yyyy h:mm a');
};

/**
 * Determines the type of event based on its title and description
 * @param {Object} event - The event to analyze
 * @returns {string} - The event type: 'exam', 'homework', 'project', or 'general'
 */
const determineEventType = (event) => {
  const title = (event.title || '').toLowerCase();
  const description = (event.description || '').toLowerCase();
  const combinedText = `${title} ${description}`;
  
  if (/\b(exam|test|midterm|final|quiz)\b/.test(combinedText)) {
    return 'exam';
  } else if (/\b(homework|assignment|problem set|pset|exercise)\b/.test(combinedText)) {
    return 'homework';
  } else if (/\b(project|presentation|paper|essay|report)\b/.test(combinedText)) {
    return 'project';
  }
  
  return 'general';
};

/**
 * Validates study suggestions to ensure the total time matches the requested preparation hours
 * @param {Array} suggestions - The study suggestions to validate
 * @param {number} requestedHours - The total hours requested for preparation
 * @param {number} toleranceMinutes - Acceptable difference in minutes (default: 15)
 * @returns {Object} - Validation result with isValid flag and totalHours
 */
const validateStudySuggestions = async (suggestions, requestedHours, toleranceMinutes = null) => {
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    console.error('Invalid suggestions array provided for validation');
    return { isValid: false, totalHours: 0, totalMinutes: 0 };
  }

  // Calculate dynamic tolerance based on requested hours if not explicitly provided
  // For longer study sessions, we allow a slightly larger tolerance
  if (toleranceMinutes === null) {
    // Base tolerance of 15 minutes
    toleranceMinutes = 15;
    
    // Add 5 minutes of tolerance for each hour of study beyond 2 hours
    // This means: 2h = 15min tolerance, 4h = 25min, 8h = 45min
    if (requestedHours > 2) {
      toleranceMinutes += Math.min(45, Math.floor((requestedHours - 2) * 5));
    }
    
    console.log(`Using dynamic tolerance of ${toleranceMinutes} minutes for ${requestedHours} hours of study`);
  }

  let totalMinutes = 0;

  // Calculate total minutes across all suggestions
  suggestions.forEach(suggestion => {
    const startTime = new Date(suggestion.suggestedStartTime);
    const endTime = new Date(suggestion.suggestedEndTime);
    
    // Calculate duration in minutes
    const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
    totalMinutes += durationMinutes;
  });

  // Convert to hours and minutes for logging
  const totalHours = totalMinutes / 60;
  
  // Calculate the difference in minutes between requested and actual
  const requestedMinutes = requestedHours * 60;
  const minutesDifference = Math.abs(totalMinutes - requestedMinutes);
  
  // Check if the difference is within tolerance
  const isValid = minutesDifference <= toleranceMinutes;
  
  console.log(`Validation results:`, {
    requestedHours,
    requestedMinutes,
    actualTotalMinutes: totalMinutes,
    actualTotalHours: totalHours,
    minutesDifference,
    toleranceMinutes,
    isWithinTolerance: isValid
  });
  
  return { 
    isValid, 
    totalHours, 
    totalMinutes,
    minutesDifference,
    toleranceMinutes,
    suggestions 
  };
};

/**
 * Generates smart study suggestions using Gemini AI
 * @param {Array|string} eventsOrUserId - All calendar events or a userId
 * @param {Object} targetEvent - The event that needs preparation
 * @param {number} preparationHours - Total hours needed for preparation
 * @returns {Promise<Array>} - Array of study session suggestions
 */
export const generateSmartStudySuggestions = async (eventsOrUserId, targetEvent, preparationHours) => {
  try {
    // Initialize Gemini API if not already initialized
    if (!genAI) {
      const initialized = await initializeGenAI();
      if (!initialized) {
        console.error('Failed to initialize Gemini API');
        return [];
      }
    }
    
    // Current time as reference point
    const now = new Date();
    
    // Determine event type
    const eventType = determineEventType(targetEvent);
    console.log('Detected event type:', eventType);
    
    // Format target event date
    const targetEventStart = new Date(targetEvent.start);
    const formattedEventDate = formatDate(targetEventStart);
    
    // Calculate days until the event
    const daysUntilEvent = Math.ceil((targetEventStart - now) / (1000 * 60 * 60 * 24));
    
    // Get all relevant events
    let relevantEvents = [];
    
    // Check if we were given a userId or an events array
    if (typeof eventsOrUserId === 'string') {
      // We were given a userId, fetch events from the database
      try {
        console.log(`Fetching events for user ${eventsOrUserId}`);
        const userEvents = await eventService.getUserEvents(eventsOrUserId);
        console.log(`Retrieved ${userEvents.length} events for user ${eventsOrUserId}`);
        relevantEvents = userEvents;
      } catch (error) {
        console.error('Error fetching user events:', error);
        // Continue with an empty events array
        relevantEvents = [];
      }
    } else if (Array.isArray(eventsOrUserId)) {
      // We were given an events array
      relevantEvents = eventsOrUserId;
    } else {
      console.warn('Invalid eventsOrUserId parameter:', eventsOrUserId);
      relevantEvents = [];
    }
    
    // Filter events to only include those between now and the target event
    const filteredEvents = relevantEvents.filter(event => {
      // Skip the target event itself
      if (event.id === targetEvent.id) return false;
      
      // Parse event start date - handle both Date objects and string dates
      let eventStart;
      if (event.start instanceof Date) {
        eventStart = new Date(event.start);
      } else if (typeof event.start === 'string') {
        eventStart = new Date(event.start);
      } else {
        console.error('Invalid event start date format', event);
        return false;
      }
      
      // Include events from now until the target event
      return eventStart >= now && eventStart <= targetEventStart;
    });
    
    console.log(`Found ${filteredEvents.length} relevant events between now and the target event`);
    
    // Format the relevant events for the prompt
    const formattedEvents = filteredEvents.map((event, index) => {
      // Format the event times, handling different formats
      let startTime;
      
      if (event.allDay) {
        startTime = format(new Date(event.start), 'yyyy-MM-dd');
        return `${index + 1}. ${event.title} (All Day): ${startTime}`;
      } else {
        // Handle events with specific times
        if (event.startTime && event.endTime) {
          // If we have specific time strings
          const startDate = format(new Date(event.start), 'yyyy-MM-dd');
          const endDate = format(new Date(event.end), 'yyyy-MM-dd');
          return `${index + 1}. ${event.title}: ${startDate} ${event.startTime} - ${endDate} ${event.endTime}`;
        } else {
          // Use the full date objects
          return `${index + 1}. ${event.title}: ${formatDate(event.start)} - ${formatDate(event.end)}`;
        }
      }
    }).join('\n');
    
    // Get user ID from the events or userId parameter
    let userId;
    if (typeof eventsOrUserId === 'string') {
      userId = eventsOrUserId;
    } else if (targetEvent && targetEvent.userId) {
      userId = targetEvent.userId;
    } else {
      console.warn('No user ID available for sleep schedule, using defaults');
    }
    
    // Get sleep schedule from database or use defaults
    let bedtime = '00:00';
    let wakeupTime = '08:00';
    
    // Try to fetch from database if we have a userId
    if (userId) {
      try {
        const response = await fetch(`/api/users/${userId}/sleep-schedule`);
        if (response.ok) {
          const data = await response.json();
          bedtime = data.bedtime;
          wakeupTime = data.wakeupTime;
          console.log('Using sleep schedule from database:', { bedtime, wakeupTime });
        }
      } catch (error) {
        console.error('Error fetching sleep schedule from database:', error);
        // Fall back to localStorage as backup
        bedtime = localStorage.getItem('bedtime') || '00:00';
        wakeupTime = localStorage.getItem('wakeupTime') || '08:00';
      }
    } else {
      // Fall back to localStorage if no userId
      bedtime = localStorage.getItem('bedtime') || '00:00';
      wakeupTime = localStorage.getItem('wakeupTime') || '08:00';
    }
    
    // Format times for display (convert from 24h to 12h format)
    const formatTimeForDisplay = (time24h) => {
      const [hours, minutes] = time24h.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };
    
    // Calculate sleep hours
    const calculateSleepHours = () => {
      // Parse times
      const [bedHours, bedMinutes] = bedtime.split(':').map(Number);
      const [wakeHours, wakeMinutes] = wakeupTime.split(':').map(Number);
      
      // Convert to minutes since midnight
      let bedTimeMinutes = bedHours * 60 + bedMinutes;
      let wakeTimeMinutes = wakeHours * 60 + wakeMinutes;
      
      // Handle case where wake time is earlier than bed time (next day)
      if (wakeTimeMinutes < bedTimeMinutes) {
        wakeTimeMinutes += 24 * 60; // Add a day in minutes
      }
      
      // Calculate difference in hours, rounded to nearest 0.5
      const sleepHours = Math.round((wakeTimeMinutes - bedTimeMinutes) / 30) / 2;
      return sleepHours;
    };
    
    const sleepHours = calculateSleepHours();
    const availableHours = 24 - sleepHours;
    
    const bedtimeFormatted = formatTimeForDisplay(bedtime);
    const wakeupTimeFormatted = formatTimeForDisplay(wakeupTime);

    // Generate the prompt for Gemini
    const promptText = `I need to create a study plan for an upcoming ${eventType}. Here are the details:

EVENT INFORMATION:
- Title: ${targetEvent.title}
- Date and Time: ${formattedEventDate}
- Hours needed for preparation: ${preparationHours}
- Days until event: ${daysUntilEvent}
- Current date and time: ${formatDate(new Date())}

EXISTING CALENDAR EVENTS (that I need to work around):
${formattedEvents || "No other events scheduled"}

STUDY PLAN RULES:
- Total study time MUST EXACTLY add up to ${preparationHours} hours
- Don't schedule any sessions in the past
- CRITICAL: Do NOT schedule any study sessions that overlap with the existing calendar events listed above
- Ensure at least 15 minutes buffer time before and after existing calendar events
- Don't schedule anything between ${bedtimeFormatted} and ${wakeupTimeFormatted} because the user will be asleep. So you can only schedule events for the ${availableHours.toFixed(1)} hours following ${wakeupTimeFormatted}
- Maximum session length should be 4 hours
- Schedule all sessions to start and end on 15-minute increments (e.g., 9:00, 9:15, 9:30, 9:45)
- Limit study to a maximum of ${Math.max(1, Math.ceil(preparationHours / 2))} different days
- If there are too many conflicts in the calendar, it's better to schedule fewer, longer sessions on days with fewer conflicts

EVENT TYPE SPECIFIC RULES:
${eventType === 'exam' || eventType === 'quiz' || eventType === 'general' ? `
For ${eventType === 'general' ? 'General Events' : 'Exams and Quizzes'}:
- ALWAYS schedule at least one study session on the day before the event IF POSSIBLE (if there are no conflicts)
- Distribution Strategy: Follow the half-hours rule (${preparationHours} hours = ${Math.max(1, Math.ceil(preparationHours / 2))} days) but ensure at least 2 days of study when possible
- PREFERRED Time Allocation (adjust based on calendar availability):
  * ~40% on the day before the event
  * ~30% two days before
  * ~20% three days before
  * Remaining ~10% distributed across earlier days
- If any day has calendar conflicts, redistribute that day's allocation to other available days
- Session Lengths:
  * Day before: 2-4 hour sessions (intensive final review)
  * Two days before: 1.5-3 hour sessions (practice problems)
  * Earlier days: 1-2 hour sessions (concept study)
- Mark the day-before session as "high" priority
` : eventType === 'project' ? `
For Projects and Presentations:
- Distribution Strategy: Balanced approach with focus on early planning and final execution
- PREFERRED Time Allocation (adjust based on calendar availability):
  * ~30% on the day before the deadline
  * ~40% two to three days before
  * ~30% distributed across earlier days for planning
- If any day has significant calendar conflicts, redistribute that day's allocation to other available days
- Uses the half-hours rule (${preparationHours} hours = ${Math.max(1, Math.ceil(preparationHours / 2))} days)
- Session Lengths:
  * Day before: 2-4 hour sessions (finalization and review)
  * Earlier days: 1-3 hour sessions (development and creation)
- Mark the day-before session as "high" priority
` : `
For Homework, Essays, and Problem Sets:
- Distribution Strategy: Decently concentrated on the day before the due date, but allowed to have a strong focus on due date itself if the assignment is due at night. 
- For assignments ≤2 hours: Schedule ALL study time on the due date itself (perfect for 11:59pm deadlines)
- PREFERRED Time Allocation (adjust based on calendar availability):
  * ~35% on the due date itself
  * ~50% on the day before
  * ~10% two days before
  * ~5% on earlier days
- If any day has significant calendar conflicts, redistribute that day's allocation to other available days
- Uses fewer days than the half-hours rule (e.g., ${preparationHours} hours = ~${Math.max(1, Math.ceil(preparationHours / 3))} days)
- Session Lengths:
  * Due date: 2-4 hour sessions (to complete in one sitting)
  * Day before: 1.5-3 hour sessions (to make significant progress)
  * Earlier days: 1-2 hour sessions (to plan and start work)
- If the homework is due before 5pm (which is 17:00), then do not schedule any sessions on the same day.
`}

CRITICAL SCHEDULING RULES:
- NEVER schedule any study sessions that overlap with existing calendar events
- Ensure at least 30 minutes buffer time before and after existing calendar events
- If a day has too many conflicts, it's better to move study time to other days than to try to squeeze sessions in
- The time allocation percentages are guidelines, not strict requirements - prioritize avoiding conflicts
- Under the circumstances study plans are manually generated far in advance, do not schedule any events more than 14 days ahead of time.

Please provide your response ONLY as a JSON array of study sessions, with each session having these properties:
- suggestedStartTime (ISO date string with timezone)
- suggestedEndTime (ISO date string with timezone)
- message (string describing what to study)
- priority (string: "high", "medium", or "low")

Example format:
[
  {
    "suggestedStartTime": "2025-03-15T18:00:00-04:00",
    "suggestedEndTime": "2025-03-15T20:00:00-04:00",
    "message": "Review key concepts",
    "priority": "high"
  }
]`;

    // No retries - just use the initial prompt
    const MAX_RETRIES = 1;
    let attempts = 0;
    let formattedSuggestions = [];
    let isValid = false;
    
    // Store the original prompt text
    let currentPromptText = promptText;
    
    while (attempts < MAX_RETRIES && !isValid) {
      attempts++;
      
      // Add retry-specific instructions to the prompt if this isn't the first attempt
      if (attempts === 1) {
        // First attempt uses the original prompt
      } else {
        // Calculate the difference from the previous attempt
        const previousTotalHours = formattedSuggestions.length > 0 ? 
          calculateTotalHours(formattedSuggestions) : 0;
        
        const hoursDifference = (previousTotalHours - preparationHours).toFixed(2);
        const minutesDifference = Math.round((previousTotalHours - preparationHours) * 60);
        
        // Create a more detailed feedback message
        let feedbackMessage = `Your previous response had a total of ${previousTotalHours.toFixed(2)} hours, `;
        
        if (minutesDifference > 0) {
          feedbackMessage += `which is ${Math.abs(minutesDifference)} minutes (${Math.abs(hoursDifference)} hours) TOO LONG.`;
        } else {
          feedbackMessage += `which is ${Math.abs(minutesDifference)} minutes (${Math.abs(hoursDifference)} hours) TOO SHORT.`;
        }
        
        // Add specific suggestions for how to fix it
        if (minutesDifference > 0) {
          feedbackMessage += ` Please REDUCE the total study time by ${Math.abs(minutesDifference)} minutes.`;
          
          // Suggest specific adjustments based on the magnitude of the difference
          if (Math.abs(minutesDifference) >= 60) {
            feedbackMessage += ` Consider removing a short session or reducing the length of multiple sessions.`;
          } else {
            feedbackMessage += ` Try shortening one or more sessions slightly.`;
          }
        } else {
          feedbackMessage += ` Please INCREASE the total study time by ${Math.abs(minutesDifference)} minutes.`;
          
          // Suggest specific adjustments based on the magnitude of the difference
          if (Math.abs(minutesDifference) >= 60) {
            feedbackMessage += ` Consider adding a short session or extending the length of multiple sessions.`;
          } else {
            feedbackMessage += ` Try extending one or more sessions slightly.`;
          }
        }
        
        // Add the previous session breakdown to help Gemini understand what to adjust
        feedbackMessage += `\n\nHere's a breakdown of your previous suggestion:`;
        
        formattedSuggestions.forEach((suggestion, index) => {
          const startTime = new Date(suggestion.suggestedStartTime);
          const endTime = new Date(suggestion.suggestedEndTime);
          const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
          const durationHours = durationMinutes / 60;
          
          feedbackMessage += `\n${index + 1}. ${format(startTime, 'MMM d, h:mm a')} - ${format(endTime, 'h:mm a')}: ${durationHours.toFixed(2)} hours (${durationMinutes} minutes)`;
        });
        
        // Place the feedback at the beginning of the prompt
        currentPromptText = `IMPORTANT FEEDBACK (Attempt ${attempts} of ${MAX_RETRIES}):\n${feedbackMessage}\n\nYour task is to create a study plan that EXACTLY equals ${preparationHours} hours total.\n\n${promptText}`;
      }
      
      console.log(`Attempt ${attempts} of ${MAX_RETRIES} to generate valid study suggestions`);
      console.log('Sending prompt to Gemini:', currentPromptText);
      
      try {
        // For @google/generative-ai, use the gemini-2.5-flash-preview-04-17 model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: currentPromptText }]
            }
          ]
        });
        const response = await result.response;
        const responseText = response.text();
        
        console.log(`Gemini response for attempt ${attempts}:`, responseText);
        
        // Extract JSON from the response
        const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
        if (!jsonMatch) {
          console.error('Could not find valid JSON in the Gemini response');
          continue; // Try again if possible
        }
        
        try {
          // Parse the JSON response
          const suggestions = JSON.parse(jsonMatch[0]);
          
          // Convert the string dates to Date objects
          formattedSuggestions = suggestions.map(suggestion => ({
            event: targetEvent,
            suggestedStartTime: new Date(suggestion.suggestedStartTime),
            suggestedEndTime: new Date(suggestion.suggestedEndTime),
            message: suggestion.message,
            priority: suggestion.priority
          }));
          
          console.log(`Formatted suggestions for attempt ${attempts}:`, formattedSuggestions);
          
          // Validate the study suggestions
          const validation = await validateStudySuggestions(formattedSuggestions, preparationHours);
          isValid = validation.isValid;
          
          if (isValid) {
            console.log(`Valid study suggestions found on attempt ${attempts}`);
            break; // Exit the loop if we have valid suggestions
          } else {
            console.warn(`Study suggestions from attempt ${attempts} do not match requested hours. ` +
              `Requested: ${preparationHours} hours, Got: ${validation.totalHours.toFixed(2)} hours ` +
              `(${validation.minutesDifference} minutes difference)`);
          }
        } catch (parseError) {
          console.error(`Error parsing Gemini response on attempt ${attempts}:`, parseError);
        }
      } catch (apiError) {
        console.error(`Error calling Gemini API on attempt ${attempts}:`, apiError);
      }
    }
    
    // Return the last set of suggestions even if not valid after MAX_RETRIES
    if (attempts >= MAX_RETRIES && !isValid) {
      console.warn(`Failed to get valid study suggestions after ${MAX_RETRIES} attempts. Using last result.`);
    }
    
    return formattedSuggestions;
  } catch (error) {
    console.error('Error generating study suggestions:', error);
    return [];
  }
};

/**
 * Calculates the total hours across all study suggestions
 * @param {Array} suggestions - The study suggestions to calculate hours for
 * @returns {number} - Total hours
 */
const calculateTotalHours = (suggestions) => {
  if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
    return 0;
  }

  let totalMinutes = 0;

  suggestions.forEach(suggestion => {
    const startTime = new Date(suggestion.suggestedStartTime);
    const endTime = new Date(suggestion.suggestedEndTime);
    
    // Calculate duration in minutes
    const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
    totalMinutes += durationMinutes;
  });

  return totalMinutes / 60;
};

// Create a named export object
const geminiService = {
  getApiKey,
  initializeGenAI,
  initializeGenAISync,
  generateSmartStudySuggestions,
  validateStudySuggestions,
  saveApiKey,
  clearApiKey
};

export default geminiService;
