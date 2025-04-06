import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faSpinner, faCalendarPlus } from '@fortawesome/free-solid-svg-icons';
// Import pdf.js with specific version
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'pdfjs-dist/legacy/build/pdf.worker.entry';
import eventService from '../services/eventService';
import { getCurrentUserId } from '../services/userService';


const SyllabusParser = ({ onAddEvents }) => {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [apiResponse, setApiResponse] = useState(null);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
  const [shouldRepeat, setShouldRepeat] = useState(true);
  const [openAiError, setOpenAiError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a syllabus file to upload');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Determine file type and read content appropriately
      let content;
      
      if (file.type === 'application/pdf') {
        // For PDF files, extract text using pdf.js
        try {
          // Convert file to ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          
          // Load PDF document
          const loadingTask = pdfjsLib.getDocument(arrayBuffer);
          const pdf = await loadingTask.promise;
          
          // Get total number of pages
          const numPages = pdf.numPages;
          let fullText = '';
          
          // Extract text from each page
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          content = fullText;
          console.log('PDF text extracted successfully for API processing');
          
          // Check if we have enough content to process (more than 10 words)
          const wordCount = content.trim().split(/\s+/).length;
          if (wordCount < 10) {
            console.error('Not enough text content extracted from PDF:', content);
            throw new Error('Not enough text content could be extracted from this PDF. It may be image-based or protected. Try a .txt or .doc file instead.');
          }
        } catch (error) {
          console.error('Failed to extract text from PDF:', error);
          setError('Failed to extract text from PDF. Try a .txt or .doc file instead.');
          setIsLoading(false);
          return;
        }
        
        // Truncate content if it's too long (though the backend will also handle this)
        const maxContentLength = 15000; // Adjust based on token limits
        const truncatedContent = content.length > maxContentLength 
          ? content.substring(0, maxContentLength) + '... (content truncated)' 
          : content;
        
        console.log('Sending request to backend API...');
        
        // Call our secure backend API route
        const response = await fetch('/api/openai/syllabus-parser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: truncatedContent })
        });
        
        // Check response status
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          // Try to get error details
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            console.error('OpenAI API error details:', JSON.stringify(errorData, null, 2));
            errorMessage = `OpenAI API error: ${errorData.error?.message || errorData.message || 'Unknown error'}`;
          } catch (jsonError) {
            console.error('Failed to parse error response:', jsonError);
            const errorText = await response.text();
            console.error('Error response text:', errorText);
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('OpenAI API Response:', data);
        
        // Extract and parse the content
        let parsedData;
        try {
          const content = data.choices[0].message.content;
          // Extract JSON from the response (it might be wrapped in markdown)
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                           content.match(/```([\s\S]*?)```/) || 
                           [null, content];
          
          // Handle the case where content might already be a JSON string with escape characters
          const jsonString = jsonMatch[1].trim();
          try {
            // First try to parse it directly
            parsedData = JSON.parse(jsonString);
          } catch (directParseError) {
            // If that fails, it might be a string with escape characters that needs to be parsed differently
            console.log('Direct parsing failed, trying alternative method');
            try {
              // If the string contains escaped characters, try to clean it up
              if (jsonString.includes('\\n')) {
                // This is a JSON string with escape characters
                // eslint-disable-next-line no-eval
                parsedData = JSON.parse(JSON.stringify(eval('(' + jsonString + ')')));
              } else {
                throw directParseError; // Re-throw if not the escape character issue
              }
            } catch (evalError) {
              console.error('Alternative parsing method failed:', evalError);
              throw directParseError; // Use the original error for better debugging
            }
          }
        } catch (parseError) {
          console.error('Error parsing OpenAI response:', parseError);
          throw new Error('Failed to parse the syllabus data. The AI response was not in the expected format.');
        }
        
        setApiResponse(data);
        setExtractedInfo(parsedData);
        
        // Convert parsed data to calendar events
        const events = convertToCalendarEvents(parsedData);
        console.log('Generated calendar events:', events);
        
        // Set the events
        setCalendarEvents(events);
        
        // We'll no longer automatically add events to calendar
        // The user will confirm via a button click
      } else {
        // For text files
        content = await readFileAsText(file);
        console.log('Processing text file...');
        
        // Truncate content if it's too long (though the backend will also handle this)
        const maxContentLength = 15000; // Adjust based on token limits
        const truncatedContent = content.length > maxContentLength 
          ? content.substring(0, maxContentLength) + '... (content truncated)' 
          : content;
        
        console.log('Sending request to backend API...');
        
        // Call our secure backend API route
        const response = await fetch('/api/openai/syllabus-parser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: truncatedContent })
        });
        
        // Check response status
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          // Try to get error details
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            console.error('OpenAI API error details:', JSON.stringify(errorData, null, 2));
            errorMessage = `OpenAI API error: ${errorData.error?.message || errorData.message || 'Unknown error'}`;
          } catch (jsonError) {
            console.error('Failed to parse error response:', jsonError);
            const errorText = await response.text();
            console.error('Error response text:', errorText);
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('OpenAI API Response:', data);
        
        // Parse the JSON response
        let parsedData;
        try {
          const content = data.choices[0].message.content;
          
          try {
            // First try to parse it directly
            parsedData = JSON.parse(content);
            
            // Check if OpenAI returned an error message
            if (parsedData.error) {
              console.error('OpenAI reported an invalid syllabus:', parsedData.error);
              setOpenAiError(parsedData.error);
              // Still set the extracted info and API response so we can display them
              setApiResponse(data);
              setExtractedInfo(parsedData);
              setCalendarEvents([]);
              setIsLoading(false);
              return; // Exit early without throwing an error
            }
          } catch (directParseError) {
            // If that fails, it might be a string with escape characters that needs to be parsed differently
            console.log('Direct parsing failed, trying alternative method');
            try {
              // If the string contains escaped characters, try to clean it up
              if (content.includes('\\n')) {
                // This is a JSON string with escape characters
                // eslint-disable-next-line no-eval
                parsedData = JSON.parse(JSON.stringify(eval('(' + content + ')')));
              } else {
                throw directParseError; // Re-throw if not the escape character issue
              }
            } catch (evalError) {
              console.error('Alternative parsing method failed:', evalError);
              throw directParseError; // Use the original error for better debugging
            }
          }
          
          // Validate that the parsed data contains expected syllabus fields
          if (!validateSyllabusData(parsedData)) {
            console.error('Invalid syllabus data structure:', parsedData);
            throw new Error('The AI generated an invalid syllabus structure. This may be due to a non-syllabus PDF or unrecognizable content.');
          }
        } catch (parseError) {
          console.error('Error parsing OpenAI response:', parseError);
          throw new Error('Failed to parse the syllabus data. The AI response was not in the expected format.');
        }
        
        setApiResponse(data);
        setExtractedInfo(parsedData);
        
        // Convert parsed data to calendar events
        const events = convertToCalendarEvents(parsedData);
        console.log('Generated calendar events:', events);
        
        // Set the events
        setCalendarEvents(events);
        
        // We'll no longer automatically add events to calendar
        // The user will confirm via a button click
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error processing syllabus:', err);
      
      // Provide more specific error messages based on the error type
      if (err.message.includes('non-syllabus PDF') || err.message.includes('invalid syllabus structure')) {
        setError('This doesn\'t appear to be a valid syllabus. Please try a different file or check that your PDF contains recognizable syllabus content.');
      } else if (err.message.includes('extract text from PDF')) {
        setError('Unable to extract text from this PDF. The file may be scanned, image-based, or protected. Try a .txt or .doc file instead.');
      } else if (err.message.includes('API')) {
        setError('There was an issue with the AI service. Please try again later.');
      } else {
        setError('Failed to process syllabus. Please try again with a different file.');
      }
      
      setIsLoading(false);
    }
  };

  // Helper function to read file as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          if (!content || typeof content !== 'string') {
            reject(new Error('Could not read file content as text'));
            return;
          }
          resolve(content);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (e) => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };
  


  // Helper function to validate syllabus data structure
  const validateSyllabusData = (data) => {
    // Check if data is an object
    if (!data || typeof data !== 'object') return false;
    
    // Check for required fields
    const requiredFields = ['courseName', 'courseCode'];
    for (const field of requiredFields) {
      if (!data[field] || typeof data[field] !== 'string' || data[field].trim() === '') {
        return false;
      }
    }
    
    // Check if the data looks like a fake class (heuristic check)
    const courseNameLower = data.courseName.toLowerCase();
    const courseCodeLower = data.courseCode.toLowerCase();
    
    // Check for generic/placeholder terms that might indicate a fake class
    const suspiciousTerms = ['example', 'sample', 'dummy', 'test class', 'not a real', 'placeholder'];
    for (const term of suspiciousTerms) {
      if (courseNameLower.includes(term) || courseCodeLower.includes(term)) {
        console.warn('Detected potentially fake class data:', data);
        return false;
      }
    }
    
    // Check if assignments or meeting times exist and are arrays
    if (data.assignments && !Array.isArray(data.assignments)) return false;
    if (data.meetingTimes && !Array.isArray(data.meetingTimes)) return false;
    
    // If we have meeting times, check that at least one has day and time info
    if (data.meetingTimes && data.meetingTimes.length > 0) {
      const hasValidMeeting = data.meetingTimes.some(meeting => 
        meeting && typeof meeting === 'object' && 
        ((meeting.day && typeof meeting.day === 'string') || 
         (meeting.days && typeof meeting.days === 'string'))
      );
      if (!hasValidMeeting) return false;
    }
    
    return true;
  };
  
  // Helper function to get instructor name from different formats
  const getInstructorName = (instructor) => {
    if (!instructor) return '';
    if (typeof instructor === 'string') return instructor;
    if (typeof instructor === 'object') {
      if (instructor.name) return instructor.name;
      // If there's no name property but there are other properties, try to construct a name
      const keys = Object.keys(instructor);
      if (keys.includes('firstName') && keys.includes('lastName')) {
        return `${instructor.firstName} ${instructor.lastName}`;
      }
      // Return the first string property as a fallback
      for (const key of keys) {
        if (typeof instructor[key] === 'string' && !key.toLowerCase().includes('email')) {
          return instructor[key];
        }
      }
    }
    return 'Unknown';
  };

  // Set default repeat until date (end of semester - about 4 months from now)
  useEffect(() => {
    if (!repeatUntilDate) {
      const today = new Date();
      const fourMonthsLater = new Date(today);
      fourMonthsLater.setMonth(today.getMonth() + 4);
      setRepeatUntilDate(fourMonthsLater.toISOString().split('T')[0]);
    }
  }, [repeatUntilDate]);

  // Hide calendar events when OpenAI returns an error
  useEffect(() => {
    if (openAiError) {
      setCalendarEvents([]);
    }
  }, [openAiError]);

  // Convert parsed syllabus data to calendar events
  const convertToCalendarEvents = (syllabusData) => {
    const events = [];
    const currentYear = new Date().getFullYear();
    const instructorName = getInstructorName(syllabusData.instructor);

    // Add class meetings as recurring events
    if (syllabusData.meetingTimes && Array.isArray(syllabusData.meetingTimes)) {
      syllabusData.meetingTimes.forEach((meeting, index) => {
        if (meeting.day && meeting.startTime && meeting.endTime) {
          events.push({
            id: `class-meeting-${index}`,
            title: `${syllabusData.courseName || 'Class'} - ${meeting.location || ''}`,
            start: formatDateTimeForEvent(meeting.day, meeting.startTime, currentYear),
            end: formatDateTimeForEvent(meeting.day, meeting.endTime, currentYear),
            allDay: false,
            recurring: true,
            recurringPattern: meeting.day.toLowerCase(),
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
        if (assignment.dueDate) {
          events.push({
            id: `assignment-${index}`,
            title: `Due: ${assignment.title || 'Assignment'}`,
            start: formatDateForEvent(assignment.dueDate, currentYear),
            end: formatDateForEvent(assignment.dueDate, currentYear),
            allDay: true,
            description: assignment.description || '',
            color: '#0F9D58'
          });
        }
      });
    }

    // Add exams as events
    if (syllabusData.exams && Array.isArray(syllabusData.exams)) {
      syllabusData.exams.forEach((exam, index) => {
        if (exam.date) {
          events.push({
            id: `exam-${index}`,
            title: `Exam: ${exam.title || 'Exam'}`,
            start: exam.time 
              ? formatDateTimeForEvent(exam.date, exam.time, currentYear) 
              : formatDateForEvent(exam.date, currentYear),
            end: exam.time 
              ? formatDateTimeForEvent(exam.date, addHoursToTime(exam.time, 2), currentYear) 
              : formatDateForEvent(exam.date, currentYear),
            allDay: !exam.time,
            location: exam.location || '',
            description: exam.description || '',
            color: '#DB4437'
          });
        }
      });
    }

    return events;
  };

  // Helper function to format date strings
  const formatDateForEvent = (dateStr, year) => {
    // This is a simplified version - in a real app, you'd want more robust date parsing
    try {
      // Handle various date formats
      const cleanDate = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1').trim();
      const date = new Date(cleanDate);
      
      // If date is invalid, try some common formats
      if (isNaN(date.getTime())) {
        // Try MM/DD format
        const parts = cleanDate.split(/[/\-.]/); // Fixed escape characters
        if (parts.length >= 2) {
          const month = parseInt(parts[0], 10) - 1;
          const day = parseInt(parts[1], 10);
          return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
        return null;
      }
      
      // Format as YYYY-MM-DD
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    } catch (err) {
      console.error('Error formatting date:', err);
      return null;
    }
  };

  // Helper function to format date and time strings
  const formatDateTimeForEvent = (dayOrDate, timeStr, year) => {
    try {
      let dateStr;
      
      // Check if it's a day of week or a date
      const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (daysOfWeek.includes(dayOrDate.toLowerCase())) {
        // Find the next occurrence of this day
        const dayIndex = daysOfWeek.indexOf(dayOrDate.toLowerCase());
        const today = new Date();
        const targetDay = new Date();
        const currentDayIndex = today.getDay() || 7; // Convert Sunday from 0 to 7
        const daysToAdd = (dayIndex + 1 - currentDayIndex + 7) % 7;
        
        targetDay.setDate(today.getDate() + daysToAdd);
        dateStr = `${targetDay.getFullYear()}-${(targetDay.getMonth() + 1).toString().padStart(2, '0')}-${targetDay.getDate().toString().padStart(2, '0')}`;
      } else {
        // It's a date, format it
        dateStr = formatDateForEvent(dayOrDate, year);
      }
      
      if (!dateStr) return null;
      
      // Format the time (assuming timeStr is in a format like "10:00 AM")
      let formattedTime = '';
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
        
        formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      } else {
        // Default to noon if time format is unrecognized
        formattedTime = '12:00:00';
      }
      
      return `${dateStr}T${formattedTime}`;
    } catch (err) {
      console.error('Error formatting date and time:', err);
      return null;
    }
  };

  // Helper function to add hours to a time string
  const addHoursToTime = (timeStr, hoursToAdd) => {
    try {
      const timeMatch = timeStr.match(/(\d+):?(\d*)?\s*(am|pm|AM|PM)?/);
      if (!timeMatch) return timeStr;
      
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
      
      // Convert to 24-hour format
      if (period === 'pm' && hours < 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      // Add hours
      hours = (hours + hoursToAdd) % 24;
      
      // Convert back to original format
      let newPeriod = period;
      if (period) {
        newPeriod = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
      }
      
      return `${hours}:${minutes.toString().padStart(2, '0')}${newPeriod ? ' ' + newPeriod : ''}`;
    } catch (err) {
      console.error('Error adding hours to time:', err);
      return timeStr;
    }
  };

  return (
    <div className="syllabus-parser-container">
      <h2 data-testid="syllabus-title">Syllabus Parser</h2>
      <p data-testid="syllabus-upload-instruction">Upload your course syllabus (PDF or text file) to automatically extract important dates and add them to your calendar using OpenAI.</p>
      
      <form onSubmit={handleSubmit} className="syllabus-form">
  

        <div className="file-upload-container">
          <label htmlFor="syllabus-file" className="file-upload-label">
            <FontAwesomeIcon icon={faUpload} />
            {file ? file.name : 'Choose syllabus file'}
          </label>
          <input
            type="file"
            id="syllabus-file"
            data-testid="syllabus-file-input"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            className="file-input"
          />
        </div>
        
        <button 
          type="submit" 
          className="parse-button"
          data-testid="syllabus-parse-button"
          disabled={isLoading || !file}
        >
          {isLoading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Processing...
            </>
          ) : 'Parse Syllabus'}
        </button>
      </form>
      
      {error && <div className="error-message" data-testid="syllabus-processing-error">{error}</div>}
      
      {extractedInfo && (
        <div className="parsed-data-container">
          {openAiError ? (
            <div className="error-message-container" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#ffebee', border: '1px solid #f44336', borderRadius: '4px' }}>
              <h4 style={{ color: '#d32f2f', margin: '0 0 10px 0' }}>Error Processing Syllabus</h4>
              <p>OpenAI could not process this file as a valid syllabus:</p>
              <p style={{ fontWeight: 'bold' }}>"{openAiError}"</p>
              <p>Please try uploading a different file that contains recognizable syllabus content.</p>
            </div>
          ) : (
            <>
              <h3 data-testid="syllabus-extracted-info-heading">Extracted Information</h3>
              <div className="parsed-data-summary">
                <p><strong>Course:</strong> {extractedInfo.courseName} ({extractedInfo.courseCode})</p>
                <p><strong>Instructor:</strong> {(() => {
                  const instructor = extractedInfo.instructor;
                  if (!instructor) return 'Not specified';
                  if (typeof instructor === 'string') return instructor;
                  if (typeof instructor === 'object') {
                    if (instructor.name) return instructor.name;
                    if (instructor.firstName && instructor.lastName) return `${instructor.firstName} ${instructor.lastName}`;
                    // Find the first string property that's not email
                    for (const key of Object.keys(instructor)) {
                      if (typeof instructor[key] === 'string' && !key.toLowerCase().includes('email')) {
                        return instructor[key];
                      }
                    }
                  }
                  return 'Unknown';
                })()}</p>
              
                {extractedInfo.meetingTimes && extractedInfo.meetingTimes.length > 0 && (
                  <div className="section">
                    <h4>Class Schedule</h4>
                    <ul>
                      {extractedInfo.meetingTimes.map((meeting, index) => (
                        <li key={index}>
                          {meeting.day}: {meeting.startTime} - {meeting.endTime}
                          {meeting.location && ` at ${meeting.location}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {extractedInfo.assignments && extractedInfo.assignments.length > 0 && (
                  <div className="section">
                    <h4>Assignments</h4>
                    <ul>
                      {extractedInfo.assignments.map((assignment, index) => (
                        <li key={index}>
                          <strong>{assignment.title}</strong> - Due: {assignment.dueDate}
                          {assignment.description && <p>{assignment.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {extractedInfo.exams && extractedInfo.exams.length > 0 && (
                  <div className="section">
                    <h4>Exams</h4>
                    <ul>
                      {extractedInfo.exams.map((exam, index) => (
                        <li key={index}>
                          <strong>{exam.title}</strong> - {exam.date} {exam.time && `at ${exam.time}`}
                          {exam.location && ` in ${exam.location}`}
                          {exam.description && <p>{exam.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {!openAiError && (
                  <div className="add-to-calendar-section">
                    <div className="calendar-options">
                      <div className="repeat-option">
                        <label className="repeat-label">
                          <input 
                            type="checkbox"
                            data-testid="syllabus-repeat-checkbox" 
                            checked={shouldRepeat} 
                            onChange={(e) => setShouldRepeat(e.target.checked)}
                          />
                          Repeat weekly class meetings
                        </label>
                      </div>
                      
                      {shouldRepeat && (
                        <div className="repeat-until-option">
                          <label htmlFor="repeat-until-date">Repeat until:</label>
                          <input
                            type="date"
                            id="repeat-until-date"
                            data-testid="syllabus-repeat-until-date"
                            value={repeatUntilDate}
                            onChange={(e) => setRepeatUntilDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      )}
                    </div>
                    
                    <button 
                      className="add-to-calendar-button"
                      data-testid="syllabus-add-to-calendar-button" 
                      disabled={calendarEvents.length === 0}
                      onClick={async () => {
                        if (calendarEvents.length > 0) {
                          try {
                            setIsLoading(true);
                            setSaveSuccess(false);
                            
                            // Get current user ID
                            const userId = getCurrentUserId();
                            console.log('👤 Current user ID for saving events:', userId);
                            if (!userId) {
                              throw new Error('User ID not found. Please log in to save events.');
                            }
                            
                            // Apply repeat settings to events
                            const eventsToAdd = calendarEvents.map(event => {
                              // Only apply repeat settings to class meetings (not assignments or exams)
                              if (event.recurring && shouldRepeat) {
                                return {
                                  ...event,
                                  repeatUntil: repeatUntilDate || null
                                };
                              }
                              return event;
                            });
                            
                            // Save each event to the database
                            const savedEvents = [];
                            for (const event of eventsToAdd) {
                              // Convert to the format expected by the eventService
                              // Ensure we have valid Date objects for start and end times
                              const start = event.start ? new Date(event.start) : null;
                              const end = event.end ? new Date(event.end) : null;
                              
                              // Skip events with invalid dates
                              if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
                                console.error('Skipping event with invalid dates:', event.title);
                                continue;
                              }
                              
                              const eventToSave = {
                                title: event.title,
                                start: start,
                                end: end,
                                allDay: event.allDay || false,
                                description: event.description || '',
                                location: event.location || '',
                                requiresPreparation: event.requiresPreparation || false,
                                color: event.color || '#d2b48c',
                                source: 'SYLLABUS' // Match the enum values in the database schema
                              };
                              
                              // Save to database
                              console.log(`💾 Saving event to database: ${eventToSave.title}`);
                              const savedEvent = await eventService.createEvent(eventToSave, userId);
                              console.log(`✅ Event saved with ID: ${savedEvent.id}`);
                              savedEvents.push(savedEvent);
                            }
                            
                            console.log(`💾 Successfully saved ${savedEvents.length} events to database!`);
                            setSaveSuccess(true);
                            alert('Events added to calendar successfully!');
                            
                            // Also pass events to parent component if onAddEvents prop is provided
                            // This maintains compatibility with the local state approach
                            if (onAddEvents && typeof onAddEvents === 'function') {
                              onAddEvents(savedEvents);
                            }
                            
                            // Clear the form after successful save
                            setFile(null);
                            setExtractedInfo(null);
                            setCalendarEvents([]);
                            setApiResponse(null);
                            setOpenAiError(null);
                          } catch (error) {
                            console.error('Error saving events to database:', error);
                            setError(`Failed to save events: ${error.message}`);
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faCalendarPlus} /> Add to Calendar
                    </button>
                    
                    <p className="calendar-events-count">
                      {calendarEvents.length} events will be added to your calendar
                      {shouldRepeat && calendarEvents.some(e => e.recurring) && 
                        ` (class meetings will repeat weekly${repeatUntilDate ? ` until ${new Date(repeatUntilDate).toLocaleDateString()}` : ''})`}
                    </p>
                    
                    {saveSuccess && (
                      <div className="success-message" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '4px', color: '#2e7d32' }}>
                        <p style={{ margin: 0 }}>
                          <strong>Success!</strong> Events have been saved to the database and will appear on your calendar.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="section json-response-section">
            <h4>Extracted JSON Data</h4>
            <div className="json-response-container">
              <pre className="json-response">
                {JSON.stringify(extractedInfo, null, 2)}
              </pre>
              <div className="json-response-note">
                <p><small>
                  {openAiError 
                    ? "The AI model detected that this file does not contain valid syllabus content."
                    : "This is the structured data extracted from your syllabus that will be used to create calendar events."}
                </small></p>
              </div>
            </div>
          </div>
          
          <div className="section">
            <h4>Raw API Response</h4>
            <details>
              <summary>View Raw API Response</summary>
              <pre className="api-response">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </details>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SyllabusParser;
