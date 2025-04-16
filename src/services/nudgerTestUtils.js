/**
 * Nudger Test Utilities - KAIR-15
 * 
 * Utility functions to help test the Nudger functionality from the browser console.
 */

import { identifyUpcomingEvents, getStudyPlan } from './nudgerService';

/**
 * Creates a test event for the specified date
 * @param {string} title - Event title
 * @param {Date} date - Event date
 * @param {Object} options - Additional event options
 * @returns {Object} - Test event object
 */
export const createTestEvent = (title, date, options = {}) => {
  const eventDate = date instanceof Date ? date : new Date(date);
  const formattedDate = eventDate.toISOString().split('T')[0];
  
  return {
    id: Date.now().toString(),
    title,
    start: `${formattedDate}T09:00`,
    end: `${formattedDate}T10:00`,
    description: options.description || '',
    allDay: options.allDay || false,
    requiresPreparation: options.requiresPreparation || false,
    preparationHours: options.preparationHours || '',
    ...options
  };
};

/**
 * Creates a set of test events spanning the next month
 * @returns {Array} - Array of test events
 */
export const generateTestEvents = () => {
  const now = new Date();
  const events = [];
  let hasQuiz = false;
  
  // Create events for the next 30 days
  for (let i = 0; i < 30; i++) {
    const eventDate = new Date();
    eventDate.setDate(now.getDate() + i);
    
    // Skip weekends
    
    // Add different types of events
    if (i === 5) {
      events.push(createTestEvent('Midterm Exam', eventDate, {
        description: 'Comprehensive exam covering all material from weeks 1-5',
        requiresPreparation: true,
        preparationHours: '5'
      }));
    } else if (i === 12) {
      events.push(createTestEvent('Research Paper Due', eventDate, {
        description: 'Final submission of research paper',
        requiresPreparation: true,
        preparationHours: '4'
      }));
    } else if (i === 19) {
      events.push(createTestEvent('Group Project Presentation', eventDate, {
        description: 'Present group findings to the class',
        requiresPreparation: true,
        preparationHours: '3'
      }));
    } else if (i === 26) {
      events.push(createTestEvent('Final Exam', eventDate, {
        description: 'Comprehensive final exam',
        requiresPreparation: true
        // No preparation hours specified to test the prompt
      }));
    } else if (i % 7 === 3) {
      events.push(createTestEvent('Quiz', eventDate, {
        description: 'Weekly quiz on recent material',
        requiresPreparation: true,
        preparationHours: '2'
      }));
      hasQuiz = true;
    } else {
      events.push(createTestEvent('Lecture', eventDate, {
        description: 'Regular class lecture',
        requiresPreparation: false
      }));
    }
  }
  
  // Ensure at least one Quiz event is included
  if (!hasQuiz) {
    // Find a suitable date for the quiz (not a weekend)
    const quizDate = new Date();
    quizDate.setDate(now.getDate() + 10); // Add 10 days to current date
    
    // Adjust if it falls on a weekend
    if (quizDate.getDay() === 0) { // Sunday
      quizDate.setDate(quizDate.getDate() + 1); // Move to Monday
    } else if (quizDate.getDay() === 6) { // Saturday
      quizDate.setDate(quizDate.getDate() + 2); // Move to Monday
    }
    
    events.push(createTestEvent('Quiz', quizDate, {
      description: 'Weekly quiz on recent material',
      requiresPreparation: true,
      preparationHours: '2'
    }));
  }
  
  return events;
};

/**
 * Tests the Nudger functionality with sample events
 * @returns {Object} - Study plan for test events
 */
export const testNudger = () => {
  const testEvents = generateTestEvents();
  console.log(`[KAIR-15] Generated ${testEvents.length} test events`);
  
  const studyEvents = identifyUpcomingEvents(testEvents);
  console.log(`[KAIR-15] Identified ${studyEvents.length} events requiring study time`);
  
  const studyPlan = getStudyPlan(testEvents);
  console.log('[KAIR-15] Study plan:', studyPlan);
  
  return {
    allEvents: testEvents,
    studyEvents,
    studyPlan
  };
};

// Export functions to window for console testing
if (typeof window !== 'undefined') {
  window.nudgerTest = {
    createTestEvent,
    generateTestEvents,
    testNudger,
    identifyUpcomingEvents,
    getStudyPlan
  };
}

const nudgerTestUtils = {
  createTestEvent,
  generateTestEvents,
  testNudger
};

export default nudgerTestUtils;
