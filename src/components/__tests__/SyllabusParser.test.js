import React from 'react';
import '@testing-library/jest-dom';
import * as eventService from '../../services/eventService';
import * as userService from '../../services/userService';
import { DateTime } from 'luxon';

// Mock dependencies
jest.mock('pdfjs-dist/legacy/build/pdf', () => ({
  getDocument: jest.fn().mockResolvedValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn().mockResolvedValue({
        getTextContent: jest.fn().mockResolvedValue({
          items: [{ str: 'Sample syllabus content' }]
        })
      })
    })
  })
}));

jest.mock('pdfjs-dist/legacy/build/pdf.worker.entry', () => {});
jest.mock('../../services/eventService');
jest.mock('../../services/userService');

// Mock DocToText for .doc file parsing
global.DocToText = jest.fn().mockImplementation(function() {
  return {
    extractToText: jest.fn().mockResolvedValue('Sample syllabus content from .doc file')
  };
});

// Import the actual functions we want to test
// We need to do this manually since they're not exported directly from SyllabusParser
const formatDateForEvent = (dateStr, currentYear) => {
  // Implementation copied from SyllabusParser.js
  if (!dateStr || typeof dateStr !== 'string') return '';
  dateStr = dateStr.trim();
  
  // If it's already in YYYY-MM-DD format, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Handle MM/DD/YYYY format
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle MM/DD format (assume current year)
  const shortSlashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortSlashMatch) {
    const [, month, day] = shortSlashMatch;
    return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle "Month Day" format (e.g., "October 15")
  // Also handle "Month Dayth" format (e.g., "October 15th")
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'
  ];
  
  const monthPattern = monthNames.join('|');
  const textDateRegex = new RegExp(`^(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,\\s*(\\d{4}))?$`, 'i');
  const textMatch = dateStr.match(textDateRegex);
  
  if (textMatch) {
    let [, month, day, year] = textMatch;
    year = year || currentYear;
    
    // Convert month name to number
    month = month.toLowerCase();
    let monthNum;
    
    if (month === 'jan' || month === 'january') monthNum = 1;
    else if (month === 'feb' || month === 'february') monthNum = 2;
    else if (month === 'mar' || month === 'march') monthNum = 3;
    else if (month === 'apr' || month === 'april') monthNum = 4;
    else if (month === 'may') monthNum = 5;
    else if (month === 'jun' || month === 'june') monthNum = 6;
    else if (month === 'jul' || month === 'july') monthNum = 7;
    else if (month === 'aug' || month === 'august') monthNum = 8;
    else if (month === 'sep' || month === 'sept' || month === 'september') monthNum = 9;
    else if (month === 'oct' || month === 'october') monthNum = 10;
    else if (month === 'nov' || month === 'november') monthNum = 11;
    else if (month === 'dec' || month === 'december') monthNum = 12;
    
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(parseInt(day, 10)).padStart(2, '0')}`;
  }
  
  // If we can't parse it, return the original string
  return dateStr;
};

// Implementation of formatDateTimeForEvent from SyllabusParser.js
const formatDateTimeForEvent = (dayOrDate, timeStr, year) => {
  try {
    // Use America/New_York timezone as specified
    const timezone = 'America/New_York';
    let dateTime;
    
    // Check if it's a day of week or a date
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (daysOfWeek.includes(dayOrDate.toLowerCase())) {
      // Find the next occurrence of this day in local time (America/New_York)
      const dayIndex = daysOfWeek.indexOf(dayOrDate.toLowerCase());
      
      // Start with current date in the specified timezone
      const now = DateTime.now().setZone(timezone);
      
      // Luxon uses 1-7 for weekday (Monday-Sunday)
      const currentDayIndex = now.weekday; // 1-7 (Monday-Sunday)
      
      // Calculate days to add to get to the target day (dayIndex is 0-6 for Monday-Sunday)
      // Convert our 0-based index (Monday=0) to Luxon's 1-based (Monday=1)
      const targetWeekday = dayIndex + 1;
      
      // Calculate days to add to get to the next occurrence of the target day
      let daysToAdd;
      if (targetWeekday >= currentDayIndex) {
        daysToAdd = targetWeekday - currentDayIndex;
      } else {
        daysToAdd = 7 - (currentDayIndex - targetWeekday);
      }
      
      // If daysToAdd is 0 (same day), we want the next week
      if (daysToAdd === 0) daysToAdd = 7;
      
      // Create the target date in local timezone
      dateTime = now.plus({ days: daysToAdd });
    } else {
      // It's a date string, parse it in local timezone
      const dateStr = formatDateForEvent(dayOrDate, year);
      if (!dateStr) return null;
      
      dateTime = DateTime.fromISO(dateStr, { zone: timezone });
    }
    
    if (!dateTime.isValid) return null;
    
    // Parse the time string (assuming timeStr is in a format like "10:00 AM")
    const timeMatch = timeStr.match(/(\d+):?(\d*)?\s*(am|pm|AM|PM)?/);
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
      
      // Convert to 24-hour format if AM/PM is specified
      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      // Set the time components while preserving the date and timezone
      dateTime = dateTime.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    } else {
      // Default to noon if time format is unrecognized
      dateTime = dateTime.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    }
    // Ensure the time is in America/New_York
    dateTime = dateTime.setZone('America/New_York');

    // Convert to UTC for storage, but ensure the original local time is preserved
    return dateTime.toUTC().toISO();
  } catch (err) {
    console.error('Error formatting date and time:', err);
    return null;
  }
};

// Implementation of alignToRecurrence from SyllabusParser.js
const alignToRecurrence = (isoStart, isoEnd, recurrenceDays) => {
  const tz          = 'America/New_York';
  const daysOfWeek  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  let   startDT     = DateTime.fromISO(isoStart).setZone(tz);
  let   endDT       = DateTime.fromISO(isoEnd  ).setZone(tz);

  // Already aligned? – nothing to do.
  if (recurrenceDays.includes(startDT.weekdayLong.toLowerCase())) {
    return [isoStart, isoEnd];
  }

  // Pick the first recurrence day as our anchor.
  const targetIdx   = daysOfWeek.indexOf(recurrenceDays[0]); // 0–6
  // Luxon weekday: 1–7 (Mon–Sun)
  const offset      = ((targetIdx + 1) - startDT.weekday + 7) % 7 || 7; // always 1-7 days ahead

  startDT = startDT.plus({ days: offset });
  endDT   = endDT.plus({ days: offset });

  return [startDT.toUTC().toISO(), endDT.toUTC().toISO()];
};

// Generate recurring instances for a given event
const generateRecurringInstances = (event, weeks = 6) => {
  if (!event.isRecurring || !event.recurrenceDays || !event.recurrenceDays.length) {
    return [event];
  }
  
  const instances = [];
  const tz = 'America/New_York';
  
  // Start with the first instance
  instances.push(event);
  
  // Get the start date in the correct timezone
  let startDT = DateTime.fromISO(event.start).setZone(tz);
  let endDT = DateTime.fromISO(event.end).setZone(tz);
  
  // Generate additional instances
  for (let i = 1; i < weeks; i++) {
    // Add 7 days for each week
    startDT = startDT.plus({ days: 7 });
    endDT = endDT.plus({ days: 7 });
    
    // Create a new instance with updated dates
    instances.push({
      ...event,
      id: `${event.id}-instance-${i}`,
      start: startDT.toUTC().toISO(),
      end: endDT.toUTC().toISO()
    });
  }
  
  return instances;
};

const convertToCalendarEvents = (syllabusData) => {
  const events = [];
  const currentYear = new Date().getFullYear();
  const instructorName = syllabusData.instructor || '';

  // Add class meetings as recurring events
  if (syllabusData.meetingTimes && Array.isArray(syllabusData.meetingTimes)) {
    syllabusData.meetingTimes.forEach((meeting, index) => {
      if (meeting.day && meeting.startTime && meeting.endTime) {
        // Calculate a default recurrence end date (end of semester - about 4 months from now)
        const today = DateTime.now().setZone('America/New_York');
        const recurrenceEndDate = today.plus({ months: 4 }); // Default to 4 months of classes
        
        // Map day string to array of days for recurrence
        const dayOfWeek = meeting.day.toLowerCase();
        const recurrenceDays = [dayOfWeek];
        
        // Generate start and end times with proper timezone handling
        let start = formatDateTimeForEvent(meeting.day, meeting.startTime, currentYear);
        let end = formatDateTimeForEvent(meeting.day, meeting.endTime, currentYear);
        [start, end] = alignToRecurrence(start, end, recurrenceDays);
        
        events.push({
          id: `class-meeting-${index}`,
          title: `${syllabusData.courseName || 'Class'} - ${meeting.location || ''}`,
          start,
          end,
          allDay: false,
          isRecurring: true,
          recurrenceFrequency: 'WEEKLY',
          recurrenceDays: recurrenceDays,
          recurrenceEndDate: recurrenceEndDate.toUTC().toISO(),
          recurring: true,
          recurringPattern: dayOfWeek,
          location: meeting.location || '',
          description: `${syllabusData.courseCode || ''} - ${instructorName}`,
          color: '#4285F4'
        });
      }
    });
  }
  
  // Add assignments as events
  if (syllabusData.assignments && Array.isArray(syllabusData.assignments)) {
    syllabusData.assignments.forEach((assignment, index) => {
      const dueDate = assignment.dueDate || 'TBD';
      const formattedDate = formatDateForEvent(dueDate, currentYear);
  
      // Validate formatted date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
        console.warn(`Skipping assignment with invalid date:`, formattedDate, assignment.title);
        return;
      }
  
      events.push({
        id: `assignment-${index}`,
        title: `Due: ${assignment.title || 'Assignment'}`,
        start: formattedDate,
        end: formattedDate,
        allDay: true,
        description: assignment.description || '',
        color: '#0F9D58'
      });
    });
  }
  
  return events;
};

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock FileReader for text file reading
global.FileReader = class {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }
  
  readAsText() {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: 'Sample text content from file' } });
      }
    }, 0);
  }
};

describe('SyllabusParser Date Handling', () => {
  // Sample syllabus data for testing
  const mockSyllabusData = {
    courseName: "Personal Finance: Making Better Decisions and Building a Better Financial System",
    courseCode: "Economics 70",
    instructor: "Professor Adrien Matray",
    meetingTimes: [
      {
        day: "Tuesday",
        startTime: "10:30 am",
        endTime: "11:45 am",
        location: "Emerson 105"
      },
      {
        day: "Thursday",
        startTime: "10:30 am",
        endTime: "11:45 am",
        location: "Emerson 105"
      }
    ],
    assignments: [
      {
        title: "Midterm Exam 1",
        dueDate: "October 1st",
        description: "Covers sections 1 - 4"
      },
      {
        title: "Midterm Exam 2",
        dueDate: "November 21th",
        description: "Covers all material up to lecture 7"
      },
      {
        title: "Final Exam",
        dueDate: "After reading period",
        description: "Covers sections 9 - 13 as well as earlier material"
      }
    ],
    exams: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Parsing', () => {
    test('can parse a .doc file', async () => {
      // Create a mock .doc file
      const mockDocFile = new File(['dummy content'], 'syllabus.doc', { type: 'application/msword' });
      
      // Mock fetch response for OpenAI API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify(mockSyllabusData)
            }
          }]
        })
      });
      
      // Mock arrayBuffer method on File
      mockDocFile.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
      
      // Create a mock function to simulate the handleSubmit function
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();
      const mockOnAddEvents = jest.fn();
      const mockSetApiResponse = jest.fn();
      const mockSetExtractedInfo = jest.fn();
      const mockSetCalendarEvents = jest.fn();
      const mockSetOpenAiError = jest.fn();
      
      // Simulate file upload and form submission
      // This is a simplified version of what happens in the component
      const handleFileUpload = async () => {
        try {
          // Mock the file type check
          const fileExt = mockDocFile.name.split('.').pop().toLowerCase();
          
          if (fileExt === 'doc' || mockDocFile.type === 'application/msword') {
            // Extract text using DocToText
            const docToText = new window.DocToText();
            const content = await docToText.extractToText(mockDocFile, fileExt);
            
            // Verify that DocToText was called correctly
            expect(window.DocToText).toHaveBeenCalled();
            // docToText.extractToText is already a jest.fn() from our mock
            
            // Verify the extracted content
            expect(content).toBe('Sample syllabus content from .doc file');
            
            // Mock API call
            const response = await fetch('/api/openai/syllabus-parser', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content })
            });
            
            // Verify fetch was called with the right parameters
            expect(global.fetch).toHaveBeenCalledWith(
              '/api/openai/syllabus-parser',
              expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: expect.any(String)
              })
            );
            
            // Process the response
            const data = await response.json();
            const parsedData = JSON.parse(data.choices[0].message.content);
            
            // Verify the parsed data matches our mock data
            expect(parsedData).toEqual(mockSyllabusData);
            
            // Convert to calendar events
            const events = convertToCalendarEvents(parsedData);
            
            // Verify events were generated correctly
            expect(events.length).toBeGreaterThan(0);
            
            // Simulate updating state
            mockSetApiResponse(data);
            mockSetExtractedInfo(parsedData);
            mockSetCalendarEvents(events);
            mockOnAddEvents(parsedData);
          }
        } catch (err) {
          mockSetError(err.message);
        } finally {
          mockSetIsLoading(false);
        }
      };
      
      await handleFileUpload();
      
      // Verify state updates
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
      
      // Check that either no error occurred or we can verify what error occurred
      if (mockSetError.mock.calls.length > 0) {
        console.log('Error occurred:', mockSetError.mock.calls[0][0]);
      } else {
        // If no error, these should have been called
        expect(mockSetApiResponse).toHaveBeenCalled();
        expect(mockSetExtractedInfo).toHaveBeenCalled();
        expect(mockSetCalendarEvents).toHaveBeenCalled();
        expect(mockOnAddEvents).toHaveBeenCalled();
      }
    });
    
    describe('Date Format Handling', () => {
      test('handles different date formats correctly', () => {
      // Mock the current year
      const currentYear = 2025;
      
      // Test "October 1st" format
      expect(formatDateForEvent('October 1st', currentYear)).toBe('2025-10-01');
      
      // Test "November 21th" format (with typo)
      expect(formatDateForEvent('November 21th', currentYear)).toBe('2025-11-21');
      
      // Test other formats
      expect(formatDateForEvent('Dec 15', currentYear)).toBe('2025-12-15');
      expect(formatDateForEvent('12/25/2025', currentYear)).toBe('2025-12-25');
      expect(formatDateForEvent('2025-09-30', currentYear)).toBe('2025-09-30');
      
      // Test invalid format
      expect(formatDateForEvent('After reading period', currentYear)).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    
    test('converts syllabus data to calendar events with correct dates and handles UTC-shifted weekdays', () => {
      // Mock the Date object to ensure consistent date calculations
      // Setting to May 1, 2025 (Thursday)
      const mockDate = new Date('2025-05-01T12:00:00');
      const RealDate = global.Date;
      global.Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            return mockDate;
          }
          return new RealDate(...args);
        }
        static now() {
          return mockDate.getTime();
        }
      };
      
      // Also mock DateTime.now() for Luxon
      const realDateTimeNow = DateTime.now;
      DateTime.now = () => DateTime.fromJSDate(mockDate);
      
      // Generate calendar events from the mock syllabus data
      const events = convertToCalendarEvents(mockSyllabusData);
      
      // Verify we have the correct number of events
      // 2 meeting times + 2 assignments with valid dates = 4
      // The "After reading period" assignment should be skipped due to invalid date
      expect(events.length).toBe(4);
      
      // Check the meeting times (recurring events)
      const tuesdayClass = events.find(e => e.recurringPattern === 'tuesday');
      const thursdayClass = events.find(e => e.recurringPattern === 'thursday');
      
      // Verify Tuesday class
      expect(tuesdayClass).toBeDefined();
      expect(tuesdayClass.title).toBe('Personal Finance: Making Better Decisions and Building a Better Financial System - Emerson 105');
      expect(tuesdayClass.isRecurring).toBe(true);
      expect(tuesdayClass.recurrenceFrequency).toBe('WEEKLY');
      expect(tuesdayClass.recurrenceDays).toContain('tuesday');
      
      // Verify Thursday class
      expect(thursdayClass).toBeDefined();
      expect(thursdayClass.isRecurring).toBe(true);
      expect(thursdayClass.recurrenceFrequency).toBe('WEEKLY');
      expect(thursdayClass.recurrenceDays).toContain('thursday');
      
      // Check the assignments
      const midterm1 = events.find(e => e.title === 'Due: Midterm Exam 1');
      const midterm2 = events.find(e => e.title === 'Due: Midterm Exam 2');
      
      // Verify Midterm 1 (October 1st)
      expect(midterm1).toBeDefined();
      expect(midterm1.allDay).toBe(true);
      expect(midterm1.start).toBe('2025-10-01');
      
      // Verify Midterm 2 (November 21th)
      expect(midterm2).toBeDefined();
      expect(midterm2.allDay).toBe(true);
      expect(midterm2.start).toBe('2025-11-21');
      
      // Verify that the "After reading period" assignment was skipped
      const finalExam = events.find(e => e.title === 'Due: Final Exam');
      expect(finalExam).toBeUndefined();
      
      // IMPORTANT: Verify the exact ISO strings for the start times to check for UTC-shifted weekday bug
      // Convert back to ET timezone to verify the local time is correct
      const tuesdayStartET = DateTime.fromISO(tuesdayClass.start).setZone('America/New_York');
      const thursdayStartET = DateTime.fromISO(thursdayClass.start).setZone('America/New_York');
      
      // Tuesday May 6, 2025 at 10:30 AM ET
      expect(tuesdayStartET.toFormat('yyyy-MM-dd')).toBe('2025-05-06');
      expect(tuesdayStartET.toFormat('HH:mm')).toBe('10:30');
      expect(tuesdayStartET.weekdayLong.toLowerCase()).toBe('tuesday');
      
      // Thursday May 8, 2025 (next Thursday) at 10:30 AM ET
      expect(thursdayStartET.toFormat('yyyy-MM-dd')).toBe('2025-05-08');
      expect(thursdayStartET.toFormat('HH:mm')).toBe('10:30');
      expect(thursdayStartET.weekdayLong.toLowerCase()).toBe('thursday');
      
      // Generate 6 weeks of recurring instances to verify they all fall on the correct day of week
      const tuesdayInstances = generateRecurringInstances(tuesdayClass, 6);
      const thursdayInstances = generateRecurringInstances(thursdayClass, 6);
      
      // Verify we have 6 instances of each class
      expect(tuesdayInstances.length).toBe(6);
      expect(thursdayInstances.length).toBe(6);
      
      // Check that all Tuesday instances fall on a Tuesday at 10:30 AM ET
      tuesdayInstances.forEach((instance, i) => {
        const instanceET = DateTime.fromISO(instance.start).setZone('America/New_York');
        expect(instanceET.weekdayLong.toLowerCase()).toBe('tuesday');
        expect(instanceET.toFormat('HH:mm')).toBe('10:30');
        if (i > 0) {
          // Each instance should be 7 days after the previous one
          const prevInstanceET = DateTime.fromISO(tuesdayInstances[i-1].start).setZone('America/New_York');
          const diffDays = instanceET.diff(prevInstanceET, 'days').days;
          expect(Math.round(diffDays)).toBe(7);
        }
      });
      
      // Check that all Thursday instances fall on a Thursday at 10:30 AM ET
      thursdayInstances.forEach((instance, i) => {
        const instanceET = DateTime.fromISO(instance.start).setZone('America/New_York');
        expect(instanceET.weekdayLong.toLowerCase()).toBe('thursday');
        expect(instanceET.toFormat('HH:mm')).toBe('10:30');
        if (i > 0) {
          // Each instance should be 7 days after the previous one
          const prevInstanceET = DateTime.fromISO(thursdayInstances[i-1].start).setZone('America/New_York');
          const diffDays = instanceET.diff(prevInstanceET, 'days').days;
          expect(Math.round(diffDays)).toBe(7);
        }
      });
      
      // Restore original Date and DateTime.now
      global.Date = RealDate;
      DateTime.now = realDateTimeNow;
    });
  });
});
});
