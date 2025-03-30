/**
 * Gemini Service - KAIR-35, KAIR-41
 * 
 * This service provides intelligent study suggestions 
 * based on the user's calendar and preparation requirements.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { format } from 'date-fns';

// Global variable to store the Gemini API client
let genAI = null;

/**
 * Get API key from storage or use null if not available
 * @returns {string|null} - The API key or null if not found
 */
export const getApiKey = () => {
  // Try sessionStorage first (temporary, cleared when browser closes)
  const sessionKey = sessionStorage.getItem('geminiApiKey');
  if (sessionKey) return sessionKey;
  
  // Then try localStorage (persists between sessions)
  const localKey = localStorage.getItem('geminiApiKey');
  return localKey || null;
};

/**
 * Save API key with specified persistence
 * @param {string} apiKey - The API key to save
 * @param {string} persistence - Where to save the key: 'session', 'local', or 'none'
 * @returns {boolean} - Whether the operation was successful
 */
export const saveApiKey = (apiKey, persistence = 'session') => {
  if (!apiKey) return false;
  
  try {
    // Clear any existing keys first
    localStorage.removeItem('geminiApiKey');
    sessionStorage.removeItem('geminiApiKey');
    
    // Save according to requested persistence
    if (persistence === 'local') {
      localStorage.setItem('geminiApiKey', apiKey);
    } else if (persistence === 'session') {
      sessionStorage.setItem('geminiApiKey', apiKey);
    }
    // If persistence is 'none', don't save the key at all
    
    return true;
  } catch (error) {
    console.error('Error saving API key:', error);
    return false;
  }
};

/**
 * Clear API key from all storage
 * @returns {boolean} - Whether the operation was successful
 */
export const clearApiKey = () => {
  try {
    localStorage.removeItem('geminiApiKey');
    sessionStorage.removeItem('geminiApiKey');
    return true;
  } catch (error) {
    console.error('Error clearing API key:', error);
    return false;
  }
};

/**
 * Initialize the Gemini API with the API key from storage
 * @returns {Object|null} - The Gemini API client or null if initialization failed
 */
export const initializeGenAI = () => {
  try {
    const apiKey = getApiKey();
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
 * Generates smart study suggestions using Gemini AI
 * @param {Array} events - All calendar events
 * @param {Object} targetEvent - The event that needs preparation
 * @param {number} preparationHours - Total hours needed for preparation
 * @returns {Promise<Array>} - Array of study session suggestions
 */
export const generateSmartStudySuggestions = async (events, targetEvent, preparationHours) => {
  try {
    // Initialize Gemini API if not already initialized
    if (!genAI) {
      const initialized = initializeGenAI();
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
    
    // Filter events to only include those between now and the target event
    const relevantEvents = events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= now && eventStart <= targetEventStart && event.id !== targetEvent.id;
    });
    
    // Format the relevant events for the prompt
    const formattedEvents = relevantEvents.map((event, index) => {
      return `${index + 1}. ${event.title}: ${formatDate(event.start)} - ${formatDate(event.end)}`;
    }).join('\n');
    
    // Create the prompt for Gemini
    const promptText = `
I need to create a study plan for an upcoming ${eventType}. Here are the details:

EVENT INFORMATION:
- Title: ${targetEvent.title}
- Date and Time: ${formattedEventDate}
- Hours needed for preparation: ${preparationHours}
- Days until event: ${daysUntilEvent}
- Current date and time: ${formatDate(now)}

EXISTING CALENDAR EVENTS (that I need to work around):
${formattedEvents || "No other events scheduled"}

STUDY PLAN RULES:
- Total study time MUST EXACTLY add up to ${preparationHours} hours
- Don't schedule any sessions in the past
- Don't schedule any sessions that overlap with the existing calendar events listed above
- Don't schedule anything between 1:00 AM and 8:00 AM (respect natural sleep schedule)
- Maximum session length should be 4 hours
- Schedule all sessions to start and end on 15-minute increments (e.g., 9:00, 9:15, 9:30, 9:45)
- Limit study to a maximum of ${Math.max(1, Math.ceil(preparationHours / 2))} different days

EVENT TYPE SPECIFIC RULES:
${eventType === 'exam' || eventType === 'quiz' ? `
For Exams and Quizzes:
- ALWAYS schedule at least one study session on the day before the exam
- Distribution Strategy: Follow the half-hours rule (${preparationHours} hours = ${Math.max(1, Math.ceil(preparationHours / 2))} days) but ensure at least 2 days of study when possible
- Time Allocation:
  * 40% on the day before the exam
  * 30% two days before
  * 20% three days before
  * Remaining 10% distributed across earlier days
- Session Lengths:
  * Day before: 2-4 hour sessions (intensive final review)
  * Two days before: 1.5-3 hour sessions (practice problems)
  * Earlier days: 1-2 hour sessions (concept study)
- Mark the day-before session as "high" priority
` : `
For Homework, Essays, and Problem Sets:
- Distribution Strategy: Heavily concentrated on the due date itself
- For assignments ≤2 hours: Schedule ALL study time on the due date itself (perfect for 11:59pm deadlines)
- For longer assignments:
  * 60% on the due date itself
  * 25% on the day before
  * 10% two days before
  * 5% on earlier days
- Uses fewer days than the half-hours rule (e.g., ${preparationHours} hours = ~${Math.max(1, Math.ceil(preparationHours / 3))} days)
- Session Lengths:
  * Due date: 2-4 hour sessions (to complete in one sitting)
  * Day before: 1.5-3 hour sessions (to make significant progress)
  * Earlier days: 1-2 hour sessions (to plan and start work)
`}

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

    console.log('Sending prompt to Gemini:', promptText);
    
    // Call the Gemini API
    try {
      // For @google/generative-ai, use the gemini-2.0-flash model
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ]
      });
      const response = await result.response;
      const responseText = response.text();
      
      console.log('Gemini response:', responseText);
      
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
      if (!jsonMatch) {
        console.error('Could not find valid JSON in the Gemini response');
        return [];
      }
      
      try {
        // Parse the JSON response
        const suggestions = JSON.parse(jsonMatch[0]);
        
        // Convert the string dates to Date objects
        const formattedSuggestions = suggestions.map(suggestion => ({
          event: targetEvent,
          suggestedStartTime: new Date(suggestion.suggestedStartTime),
          suggestedEndTime: new Date(suggestion.suggestedEndTime),
          message: suggestion.message,
          priority: suggestion.priority
        }));
        
        console.log('Formatted suggestions:', formattedSuggestions);
        return formattedSuggestions;
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        return [];
      }
    } catch (apiError) {
      console.error('Error calling Gemini API:', apiError);
      return [];
    }
  } catch (error) {
    console.error('Error generating study suggestions:', error);
    return [];
  }
};

// Create a named export object
const geminiService = {
  getApiKey,
  saveApiKey,
  clearApiKey,
  initializeGenAI,
  generateSmartStudySuggestions
};

export default geminiService;
