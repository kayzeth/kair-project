import React, { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faSpinner } from '@fortawesome/free-solid-svg-icons';
// Import pdf.js with specific version
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'pdfjs-dist/legacy/build/pdf.worker.entry';
import eventService from '../services/eventService';
import { getCurrentUserId } from '../services/userService';
import Title from './Title';

const sendToParser = async (rawContent, setError, setIsLoading, onAddEvents, setApiResponse, setExtractedInfo, setCalendarEvents, setOpenAiError, convertToCalendarEvents) => {
    // Bail if tiny
    if (rawContent.trim().split(/\s+/).length < 10) {
      setError('Not enough text content to parse.');
      setIsLoading(false);
      return;
    }
  
    const maxContentLength = 150000;
    const truncated = rawContent.length > maxContentLength
        ? rawContent.slice(0, maxContentLength) + '... (content truncated)'
        : rawContent;
  
    console.log('Sending request to backend API...');
    const res = await fetch('/api/openai/syllabus-parser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: truncated })
    });
  
    if (!res.ok) {
      const msg = `HTTP error: ${res.status}`;
      setError(msg);
      setIsLoading(false);
      throw new Error(msg);
    }
  
    const data = await res.json();
    console.log('OpenAI API Response:', data);
    
    try {
      const content = data.choices[0].message.content;
      // unwrap ```json ``` or ```
      const match = content.match(/```(?:json)?\n([\s\S]*?)\n```/) || [null, content];
      let parsed;
      
      try {
        parsed = JSON.parse(match[1].trim());
        
        // Check if OpenAI returned an error message
        if (parsed.error) {
          console.error('OpenAI reported an invalid syllabus:', parsed.error);
          if (typeof setOpenAiError === 'function') {
            setOpenAiError(parsed.error);
          }
          setIsLoading(false);
          return;
        }
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        setError('Failed to parse the syllabus data. The AI response was not in the expected format.');
        setIsLoading(false);
        return;
      }
      
      // If we have access to these state setters, update them
      if (typeof setApiResponse === 'function') {
        setApiResponse(data);
      }
      
      if (typeof setExtractedInfo === 'function') {
        setExtractedInfo(parsed);
      }
      
      // If we have access to the convertToCalendarEvents function and setCalendarEvents
      if (typeof convertToCalendarEvents === 'function' && typeof setCalendarEvents === 'function') {
        const events = convertToCalendarEvents(parsed);
        console.log('Generated calendar events:', events);
        setCalendarEvents(events);
      }
      
      // Call the callback to add events
      onAddEvents(parsed);
    } catch (error) {
      console.error('Error processing syllabus:', error);
      setError('Failed to process syllabus data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  

const SyllabusParser = ({ onAddEvents }) => {
  // Get current year for default date handling
  const currentYear = new Date().getFullYear();
  
  // Styles for the event editor modal
  const eventEditorModalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  };
  
  const eventEditorContentStyle = {
    background: 'white',
    padding: '30px',
    borderRadius: '12px',
    maxWidth: '800px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };
  
  const eventEditorHeaderStyle = {
    marginTop: 0,
    marginBottom: '8px',
    color: '#333',
    fontSize: '24px'
  };
  
  const eventEditorDescriptionStyle = {
    marginBottom: '20px',
    color: '#666',
    fontSize: '16px'
  };
  
  const eventEditorTableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '15px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    overflow: 'hidden'
  };
  
  const eventEditorTableContainerStyle = {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '25px',
    borderRadius: '8px'
  };
  
  const eventEditorButtonsStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '10px'
  };
  
  const tableCellStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #eaeaea',
    textAlign: 'left',
    fontSize: '14px'
  };
  
  const tableHeaderStyle = {
    backgroundColor: '#f8f9fa',
    fontWeight: '600',
    color: '#444',
    padding: '14px 16px',
    borderBottom: '2px solid #e0e0e0',
    fontSize: '15px'
  };
  
  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  };
  
  const checkboxStyle = {
    margin: '0 auto',
    display: 'block'
  };
  
  const buttonBaseStyle = {
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    outline: 'none'
  };
  
  const cancelButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#f1f3f5',
    color: '#495057',
    border: '1px solid #ced4da'
  };
  
  const applyButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#4285F4',
    color: 'white',
    boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)'
  };
  
  const editEventsButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#4285F4',
    color: 'white',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)',
    transition: 'all 0.2s ease',
    marginBottom: '10px'
  };
  
  const addToCalendarButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: '#4285F4',
    color: 'white',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(66, 133, 244, 0.3)',
    transition: 'all 0.2s ease'
  };

  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [apiResponse, setApiResponse] = useState(null);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
  const [shouldRepeat, setShouldRepeat] = useState(true);
  const [editableEvents, setEditableEvents] = useState([]);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [openAiError, setOpenAiError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Clear pasted text when a file is selected
      setPastedText('');
      // Reset error states and extracted info when a new file is selected
      setError(null);
      setOpenAiError(null);
      setExtractedInfo(null);
      setCalendarEvents([]);
    }
  };
  
  const handleTextChange = (e) => {
    const text = e.target.value;
    setPastedText(text);
    // Clear file selection if text is entered
    if (text.trim().length > 0 && file) {
      setFile(null);
      // Reset the file input
      const fileInput = document.getElementById('syllabus-file');
      if (fileInput) fileInput.value = '';
    }
    // Reset error states and extracted info when text is modified
    setOpenAiError(null);
    setExtractedInfo(null);
    setCalendarEvents([]);
  };


  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file && !pastedText) {
      setError('Please select a syllabus file to upload or paste syllabus content');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Determine file type and read content appropriately
      let content;
      
      // If using pasted text instead of a file
      if (pastedText && !file) {
        content = pastedText;
        console.log('Processing pasted text...');
        // Use the sendToParser function to process pasted text with all necessary state setters
        await sendToParser(
          content, 
          setError, 
          setIsLoading, 
          onAddEvents, 
          setApiResponse, 
          setExtractedInfo, 
          setCalendarEvents, 
          setOpenAiError, 
          convertToCalendarEvents
        );
        return; // Exit after processing pasted text
      } else {
        // Get file extension
        const fileExt = file.name.split('.').pop().toLowerCase();
        
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
            throw new Error('Not enough text content could be extracted from this PDF. It may be image-based or protected. Try a .txt, .doc, or .docx file instead.');
          }
        } catch (error) {
          console.error('Failed to extract text from PDF:', error);
          setError('Failed to extract text from PDF. Try a .txt, .doc, or .docx file instead.');
          setIsLoading(false);
          return;
        }
        
        // Truncate content if it's too long (though the backend will also handle this)
        const maxContentLength = 150000; // Adjust based on token limits
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
      } else if (fileExt === 'docx' || fileExt === 'doc' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.type === 'application/msword') {
        // For Word documents (.docx and .doc)
        try {
          console.log('Processing Word document...', file.name, fileExt, file.type);
          
          // Check if DocToText is available
          if (typeof window.DocToText !== 'function') {
            console.error('DocToText library not loaded properly');
            throw new Error('Document processing library not loaded properly. Please refresh the page and try again.');
          }
          
          // Use docToText library to extract text from Word documents
          const docToText = new window.DocToText();
          console.log('DocToText instance created');
          
          // Read file as text first as fallback
          const textContent = await readFileAsText(file);
          console.log('Fallback text content length:', textContent.length);
          
          try {
            // Try to extract text using docToText
            console.log('Attempting to extract text with docToText...');
            content = await docToText.extractToText(file, fileExt);
            console.log('DocToText extraction successful, content length:', content ? content.length : 0);
          } catch (docToTextError) {
            console.error('DocToText extraction failed:', docToTextError);
            console.log('Falling back to text content');
            content = textContent;
          }
          
          // If content is empty or undefined, use the text content
          if (!content || content.trim().length === 0) {
            console.log('DocToText returned empty content, using fallback text content');
            content = textContent;
          }
          
          // Check if we have enough content to process
          const wordCount = content.trim().split(/\s+/).length;
          console.log('Word count in extracted content:', wordCount);
          
          if (wordCount < 10) {
            console.error('Not enough text content extracted from Word document:', content);
            throw new Error('Not enough text content could be extracted from this Word document. It may be protected or corrupted.');
          }
          
          // Truncate content if it's too long (though the backend will also handle this)
          const maxContentLength = 150000; // Adjust based on token limits
          const truncatedContent = content.length > maxContentLength 
            ? content.substring(0, maxContentLength) + '... (content truncated)' 
            : content;
          
          console.log('Sending Word document content to backend API...');
          
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
              throw new Error('The AI generated an invalid syllabus structure. This may be due to a non-syllabus document or unrecognizable content.');
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
        } catch (error) {
          console.error('Failed to extract text from Word document:', error);
          setError('Failed to extract text from Word document: ' + error.message);
          setIsLoading(false);
          return;
        }
      } else {
        // For text files
        content = await readFileAsText(file);
        console.log('Processing text file...');
      }
        
        // Truncate content if it's too long (though the backend will also handle this)
        const maxContentLength = 150000; // Adjust based on token limits
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
        setError('Unable to extract text from this PDF. The file may be scanned, image-based, or protected. Try a .txt, .doc, or .docx file instead.');
      } else if (err.message.includes('extract text from Word document')) {
        setError('Unable to extract text from this Word document. The file may be protected or corrupted. Try a different file format.');
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
  // Make sure a start/end pair aligns with the first day listed in recurrenceDays
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
  // Build a Date in local time (America/New_York) from "YYYY-MM-DD"
function buildLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // Month is 0-based
}
  // Convert parsed syllabus data to calendar events
  const convertToCalendarEvents = (syllabusData) => {
    const events = [];
    const currentYear = new Date().getFullYear();
    const instructorName = getInstructorName(syllabusData.instructor);

    // Add class meetings as recurring events
    if (syllabusData.meetingTimes && Array.isArray(syllabusData.meetingTimes)) {
      syllabusData.meetingTimes.forEach((meeting, index) => {
        if (meeting.day && meeting.startTime && meeting.endTime) {
          // Calculate a default recurrence end date (end of semester - about 4 months from now)
          // Use the specified timezone for consistency
          const timezone = 'America/New_York';
          const today = DateTime.now().setZone(timezone);
          const recurrenceEndDate = today.plus({ months: 4 }); // Default to 4 months of classes
          
          // Map day string to array of days for recurrence
          // Use the local day name (not UTC-shifted)
          const dayOfWeek = meeting.day.toLowerCase();
          const recurrenceDays = [dayOfWeek];
          
          // Generate start and end times with proper timezone handling
          let start = formatDateTimeForEvent(meeting.day, meeting.startTime, currentYear);
          let end = formatDateTimeForEvent(meeting.day, meeting.endTime,   currentYear);
          [start, end] = alignToRecurrence(start, end, recurrenceDays);
          events.push({
            id: `class-meeting-${index}`,
            title: `${syllabusData.courseName || 'Class'} - ${meeting.location || ''}`,
            start,
            end,
            allDay: false,
            // Properties needed by Calendar's generateRecurringInstances
            isRecurring: true,
            recurrenceFrequency: 'WEEKLY',
            recurrenceDays: recurrenceDays,
            recurrenceEndDate: recurrenceEndDate.toUTC().toISO(),
            // Keep original properties for backward compatibility
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
    
        // Check if assignment has a specific due time
        if (assignment.dueTime && /^\d{1,2}:\d{2}(?:\s?[APap][Mm])?$/.test(assignment.dueTime)) {
          // If assignment has a valid due time (like "5:00 PM" or "17:00")
          const normalizedTime = normalizeTimeTo24h(assignment.dueTime); // Helper function we'll add
          const startISO = buildDateTimeISO(formattedDate, normalizedTime);
    
          events.push({
            id: `assignment-${index}`,
            title: `Due: ${assignment.title || 'Assignment'}`,
            start: startISO,
            end: startISO,
            allDay: false, //  Timed event
            description: assignment.description || '',
            color: '#0F9D58'
          });
        } else {
          // No due time provided — treat as all-day
          const [startISO, endISO] = toAllDayUtcRange(formattedDate);
    
          if (!startISO || !endISO) {
            console.warn(`Skipping assignment due to invalid ISO dates:`, formattedDate);
            return;
          }
    
          events.push({
            id: `assignment-${index}`,
            title: `Due: ${assignment.title || 'Assignment'}`,
            start: startISO,
            end: endISO,
            allDay: true,
            description: assignment.description || '',
            color: '#0F9D58'
          });
        }
      });
    }
    
    function toAllDayUtcRange(ymd) {
      console.log('toAllDayUtcRange called with:', ymd);

      const [y, m, d] = ymd.split('-').map(Number);
      const localMidnight = new Date(y, m - 1, d); // Local midnight
      const utcStart = localMidnight.toISOString(); // Auto UTC shift
      const endLocalMidnight = new Date(y, m - 1, d + 1); // Next day local midnight
      const utcEnd = new Date(endLocalMidnight.getTime() - 1).toISOString(); // 1 ms before

      return [utcStart, utcEnd];
    }
    function normalizeTimeTo24h(timeStr) {
      // Accepts "5:00 PM", "5:00PM", "17:00", etc.
      timeStr = timeStr.trim().toUpperCase();
      const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/);
      
      if (ampmMatch) {
        let [ , hours, minutes, ampm ] = ampmMatch;
        hours = parseInt(hours, 10);
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }
      
      // If already 24-hour (like "17:00"), just return it
      return timeStr;
    }
    function buildDateTimeISO(ymd, hm) {
      const [year, month, day] = ymd.split('-').map(Number);
      const [hour, minute] = hm.split(':').map(Number);
      const local = new Date(year, month - 1, day, hour, minute);
      return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    }
    // Add exams as events
    if (syllabusData.exams && Array.isArray(syllabusData.exams)) {
      syllabusData.exams.forEach((exam, index) => {
        // Always create an event, even if date is TBD
        const examDate = exam.date || 'TBD';
        // examTime not used in current implementation, but kept for future use
        // eslint-disable-next-line no-unused-vars
        const examTime = exam.time || 'TBD';
        
        // Default to today's date if TBD
        const formattedDate = formatDateForEvent(examDate, currentYear) || formatDateForEvent(new Date().toISOString().split('T')[0], currentYear);
        const [startISO, endISO] = toAllDayUtcRange(formattedDate);

        // Create the event with default values for TBD fields
        events.push({
          id: `exam-${index}`,
          title: `Exam: ${exam.title || 'Exam'}`,
          start: startISO,
          end: endISO,
          allDay: true,
          location: exam.location || '',
          description: exam.description || '',
          color: '#DB4437'
        });
      });
    }

    return events;
  };

  // Helper function to format date strings
  const formatDateForEvent = (dateStr, currentYear) => {
    try {
      //  If the string is already "YYYY-MM-DD", keep it untouched.
      const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoPattern.test(dateStr.trim())) {
      return dateStr.trim();          // e.g. "2025-01-29"
    }
      if (!dateStr || dateStr.toLowerCase().includes('tbd') || dateStr.toLowerCase().includes('to be determined')) {
        const today = new Date();
        return `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
  
      const monthMap = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
        'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
  
      const monthNameRegex = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d+)/i;
      const monthNameMatch = dateStr.match(monthNameRegex);
  
      if (monthNameMatch) {
        const month = monthMap[monthNameMatch[1].toUpperCase()];
        const day = String(parseInt(monthNameMatch[2])).padStart(2, '0');
        return `${currentYear}-${month}-${day}`;
      }
  
      const cleanDate = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1').trim();
      let date = new Date(cleanDate);
  
      if (isNaN(date.getTime())) {
        const parts = cleanDate.split(/[/. -]/);
        if (parts.length >= 2) {
          const month = parseInt(parts[0], 10);
          const day = parseInt(parts[1], 10);
          if (!isNaN(month) && !isNaN(day)) {
            return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
        const today = new Date();
        return `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
  
      if (date.getFullYear() < 2020) {
        return `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
  
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch (err) {
      console.error('Error formatting date:', err);
      const today = new Date();
      return `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
  };

  // Helper function to format date and time strings with proper timezone handling
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


  return (
    <div className="syllabus-parser-container">
      <Title page="Syllabus Parser" />
      <h2 data-testid="syllabus-title">Syllabus Parser</h2>
      <p data-testid="syllabus-upload-instruction">Upload or paste your course syllabus to automatically extract important dates and add them to your calendar using OpenAI.</p>
      
      <form onSubmit={handleSubmit} className="syllabus-form">
  

        <div className="file-upload-container">
          <label htmlFor="syllabus-file" className={`file-upload-label ${pastedText ? 'disabled-upload' : ''}`} style={{ opacity: pastedText ? 0.6 : 1, cursor: pastedText ? 'not-allowed' : 'pointer' }}>
            <FontAwesomeIcon icon={faUpload} />
            {file ? file.name : 'Choose syllabus file'}
          </label>
          <input
            type="file"
            id="syllabus-file"
            data-testid="syllabus-file-input"
            accept=".pdf,.txt,.docx,.doc"
            onChange={handleFileChange}
            className="file-input"
            disabled={!!pastedText}
          />
        </div>
        
        <div className="text-paste-container" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <label htmlFor="syllabus-paste" style={{ display: 'block', marginBottom: '8px', fontWeight: '500', opacity: file ? 0.6 : 1 }}>Or paste syllabus content here:</label>
          <textarea
            id="syllabus-paste"
            data-testid="syllabus-paste-input"
            value={pastedText}
            onChange={handleTextChange}
            placeholder="Paste your syllabus content here..."
            disabled={!!file}
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontFamily: 'inherit',
              fontSize: '14px',
              resize: 'vertical',
              backgroundColor: file ? '#f5f5f5' : 'white',
              cursor: file ? 'not-allowed' : 'text'
            }}
          />
        </div>
        
        <button 
          type="submit" 
          className="parse-button"
          data-testid="syllabus-parse-button"
          disabled={isLoading || (!file && !pastedText)}
        >
          {isLoading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Processing...
            </>
          ) : 'Parse Syllabus'}
        </button>
      </form>
      
      {error && <div className="error-message" data-testid="syllabus-processing-error">{error}</div>}
      
      {/* Show either valid extracted info OR the OpenAI error message */}
      {(extractedInfo && (validateSyllabusData(extractedInfo) || openAiError)) && (
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
  
                    {showEventEditor && (
                      <div style={eventEditorModalStyle}>
                        <div style={eventEditorContentStyle}>
                          <h3 style={eventEditorHeaderStyle}>Review and Edit Events</h3>
                          <p style={eventEditorDescriptionStyle}>You can select which events to add and adjust their details before adding to your calendar.</p>
                          
                          <div style={eventEditorTableContainerStyle}>
                            <table style={eventEditorTableStyle}>
                              <thead>
                                <tr>
                                  <th style={tableHeaderStyle}>Include</th>
                                  <th style={tableHeaderStyle}>Event</th>
                                  <th style={tableHeaderStyle}>Date</th>
                                  <th style={tableHeaderStyle}>Time</th>
                                  <th style={tableHeaderStyle}>All Day</th>
                                </tr>
                              </thead>
                              <tbody>
                                {editableEvents.map((event, index) => (
                                  <tr key={index} style={event.selected === false ? { opacity: 0.5 } : {}}>                                    
                                    <td style={tableCellStyle}>
                                      <input 
                                        type="checkbox" 
                                        style={checkboxStyle}
                                        checked={event.selected !== false} 
                                        onChange={(e) => {
                                          const updatedEvents = [...editableEvents];
                                          updatedEvents[index].selected = e.target.checked;
                                          setEditableEvents(updatedEvents);
                                        }}
                                      />
                                    </td>
                                    <td style={tableCellStyle}>
                                      <input 
                                        type="text" 
                                        style={inputStyle}
                                        value={event.title} 
                                        onChange={(e) => {
                                          const updatedEvents = [...editableEvents];
                                          updatedEvents[index].title = e.target.value;
                                          setEditableEvents(updatedEvents);
                                        }}
                                      />
                                    </td>
                                    <td style={tableCellStyle}>
                                      <input 
                                        type="date" 
                                        style={inputStyle}
                                        value={event.dateString} 
                                        onChange={(e) => {
                                          const updatedEvents = [...editableEvents];
                                          updatedEvents[index].dateString = e.target.value;
                                          setEditableEvents(updatedEvents);
                                        }}
                                      />
                                    </td>
                                    <td style={tableCellStyle}>
                                      <input 
                                        type="time" 
                                        style={inputStyle}
                                        value={event.timeString || ''} 
                                        disabled={event.allDay}
                                        onChange={(e) => {
                                          const updatedEvents = [...editableEvents];
                                          updatedEvents[index].timeString = e.target.value;
                                          setEditableEvents(updatedEvents);
                                        }}
                                      />
                                    </td>
                                    <td style={tableCellStyle}>
                                      <input 
                                        type="checkbox" 
                                        style={checkboxStyle}
                                        checked={event.allDay} 
                                        onChange={(e) => {
                                          const updatedEvents = [...editableEvents];
                                          const checked = e.target.checked;
                                          updatedEvents[index].allDay = checked;
                                          if (!checked && !updatedEvents[index].timeString) {
                                               updatedEvents[index].timeString = '00:00';
                                             }
                                             if (checked) {
                                               updatedEvents[index].timeString = '';   // clear again when re-checking
                                             }
                                             setEditableEvents(updatedEvents);
                                          
                                        }}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          <div style={{marginBottom: '20px'}}>
                            <button 
                              style={{...buttonBaseStyle, backgroundColor: '#4CAF50', color: 'white', marginRight: '10px'}}
                              onClick={() => {
                                // Create a new empty event
                                const today = new Date();
                                const dateString = today.toISOString().split('T')[0];
                                const newEvent = {
                                  id: `custom-${Date.now()}`,
                                  title: 'New Custom Event',
                                  dateString: dateString,
                                  timeString: '09:00',
                                  allDay: false,
                                  selected: true,
                                  color: '#4285F4',
                                  description: '',
                                  location: ''
                                };
                                
                                setEditableEvents([...editableEvents, newEvent]);
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px'}}>
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
                              </svg>
                              Add New Event
                            </button>
                          </div>
                          
                          <div style={eventEditorButtonsStyle}>
                            <button 
                              style={cancelButtonStyle}
                              onClick={() => setShowEventEditor(false)}
                            >
                              Cancel
                            </button>
                            <button 
                              style={applyButtonStyle}
                              onClick={() => {
                                // Filter out deselected events and update values for the rest
                                const updatedCalendarEvents = editableEvents
                                  .filter(event => event.selected !== false) // Only include selected events
                                  .map(event => {
                                    // Create new Date objects from the edited values
                                    let startDate, endDate;
                                    function toAllDayUtcRange(ymd) {
                                      console.log('toAllDayUtcRange called with:', ymd);
                                
                                      const [y, m, d] = ymd.split('-').map(Number);
                                      const localMidnight = new Date(y, m - 1, d); // Local midnight
                                      const utcStart = localMidnight.toISOString(); // Auto UTC shift
                                      const endLocalMidnight = new Date(y, m - 1, d + 1); // Next day local midnight
                                      const utcEnd = new Date(endLocalMidnight.getTime() - 1).toISOString(); // 1 ms before
                                
                                      return [utcStart, utcEnd];
                                    }
                                    if (event.allDay) {
                                      // For all-day events
                                      const [startISO, endISO] = toAllDayUtcRange(event.dateString);
                                      startDate = startISO;
                                      endDate = endISO;
                                    } else if (event.timeString) {
                                      // Build the base date in LOCAL time first
                                      const base = buildLocalDate(event.dateString);

                                      // Parse timeString safely: supports "HH:mm" or "HH:mm AM/PM"
                                      let [tHours, tMinutes] = [0, 0];
                                      const ampmMatch = event.timeString.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                                      if (ampmMatch) {
                                        tHours   = parseInt(ampmMatch[1], 10);
                                        tMinutes = parseInt(ampmMatch[2], 10);
                                        if (ampmMatch[3]) {
                                          const isPM = ampmMatch[3].toUpperCase() === 'PM';
                                          if (isPM && tHours < 12) tHours += 12;
                                          if (!isPM && tHours === 12) tHours = 0;
                                        }
                                      }

                                      base.setHours(tHours, tMinutes, 0, 0);        // local America/New_York
                                      startDate = base.toISOString();               // convert to UTC for storage

                                    // Default 1-hour duration
  const endDateObj = new Date(base);
  endDateObj.setHours(endDateObj.getHours() + 1);
  endDate = endDateObj.toISOString();
                                    } else {
                                      // No time provided ⇒ treat as local midnight
                                      const base = buildLocalDate(event.dateString);   // local date
                                      base.setHours(0, 0, 0, 0);                       // 00:00 local
                                      startDate = base.toISOString();                  // e.g. 2025-10-01T04:00:00Z
                                      const endDateObj = new Date(base);
   endDateObj.setHours(endDateObj.getHours() + 1);  // default 1-hr duration
   endDate = endDateObj.toISOString();
                                    }
                                    // If this is a recurring event, realign the start/end so that the
                                    // first instance lands on the first valid day in recurrenceDays.
                                    if (event.isRecurring && Array.isArray(event.recurrenceDays) && event.recurrenceDays.length) {
                                      [startDate, endDate] = alignToRecurrence(startDate, endDate, event.recurrenceDays);
                                    }
                                    return {
                                      ...event,
                                      start: startDate,
                                      end: endDate
                                    };
                                  });
                                
                                setCalendarEvents(updatedCalendarEvents);
                                setShowEventEditor(false);
                              }}
                            >
                              Apply Changes
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="calendar-events-summary">
                      <h4 style={{marginTop: '20px', marginBottom: '10px', fontSize: '16px', fontWeight: '600'}}>Events to be Added</h4>
                      <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #eaeaea', borderRadius: '8px', padding: '10px', marginBottom: '15px'}}>
                        {showEventEditor ? (
                          // Show dynamically updated list based on edited events
                          editableEvents.filter(e => e.selected !== false).length > 0 ? (
                            <ul style={{listStyleType: 'none', padding: 0, margin: 0}}>
                              {editableEvents
                                .filter(e => e.selected !== false)
                                .map((event, index) => (
                                  <li key={index} style={{padding: '6px 0', borderBottom: index < editableEvents.filter(e => e.selected !== false).length - 1 ? '1px solid #f0f0f0' : 'none'}}>
                                    <div style={{display: 'flex', alignItems: 'center'}}>
                                      <span style={{display: 'inline-block', width: '12px', height: '12px', backgroundColor: event.color || '#4285F4', borderRadius: '50%', marginRight: '8px'}}></span>
                                      <strong>{event.title}</strong>
                                      <span style={{marginLeft: '10px', color: '#666', fontSize: '14px'}}>
                                        {event.dateString ? new Date(event.dateString).toLocaleDateString() : ''}
                                        {!event.allDay && event.timeString ? ` at ${event.timeString}` : ''}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p style={{color: '#666', fontStyle: 'italic', textAlign: 'center', margin: '15px 0'}}>No events selected to add to calendar</p>
                          )
                        ) : (
                          // Show static list based on original calendar events
                          <ul style={{listStyleType: 'none', padding: 0, margin: 0}}>
                            {calendarEvents.map((event, index) => (
                              <li key={index} style={{padding: '6px 0', borderBottom: index < calendarEvents.length - 1 ? '1px solid #f0f0f0' : 'none'}}>
                                <div style={{display: 'flex', alignItems: 'center'}}>
                                  <span style={{display: 'inline-block', width: '12px', height: '12px', backgroundColor: event.color || '#4285F4', borderRadius: '50%', marginRight: '8px'}}></span>
                                  <strong>{event.title}</strong>
                                  <span style={{marginLeft: '10px', color: '#666', fontSize: '14px'}}>
                                    {event.start ? new Date(event.start).toLocaleDateString() : ''}
                                    {!event.allDay && event.start ? ` at ${new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ''}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <p className="calendar-events-count">
                        {showEventEditor 
                          ? `${editableEvents.filter(e => e.selected !== false).length} events will be added to your calendar` 
                          : `${calendarEvents.length} events will be added to your calendar`}
                        {shouldRepeat && calendarEvents.some(e => e.recurring) && 
                          ` (class meetings will repeat weekly${repeatUntilDate ? ` until ${new Date(repeatUntilDate).toLocaleDateString()}` : ''})`}
                      </p>
                    </div>
                    <button 
                      className="edit-events-button"
                      style={{
                        ...editEventsButtonStyle,
                        opacity: calendarEvents.length === 0 ? 0.5 : 1,
                        cursor: calendarEvents.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                      disabled={calendarEvents.length === 0}
                      onMouseOver={(e) => {
                        if (calendarEvents.length > 0) {
                          e.currentTarget.style.backgroundColor = '#3367d6';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(66, 133, 244, 0.4)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (calendarEvents.length > 0) {
                          e.currentTarget.style.backgroundColor = '#4285F4';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(66, 133, 244, 0.3)';
                        }
                      }}
                      onClick={() => {
                        // Prepare events for editing
                        const editableEventsList = calendarEvents.map((event, index) => {
                          try {
                            // Get date from event or use current date as fallback
                            let eventDate;
                            
                            try {
                              eventDate = event.start ? new Date(event.start) : new Date();
                              
                              // Check if the date is valid
                              if (isNaN(eventDate.getTime())) {
                                console.warn('Invalid date detected:', event.start);
                                eventDate = new Date(); // Fallback to current date
                              }
                            } catch (dateError) {
                              console.error('Error creating date object:', dateError);
                              eventDate = new Date(); // Fallback to current date
                            }
                            
                            // If the year is very old (like 2001), update it to current year
                            if (eventDate.getFullYear() < 2020) {
                              eventDate.setFullYear(currentYear);
                            }
                            
                            // Format date and time strings safely
                            let dateString, timeString;
                            try {
                              const pad = (n) => String(n).padStart(2, '0');
                              dateString = [
                                eventDate.getFullYear(),
                                pad(eventDate.getMonth() + 1),
                                pad(eventDate.getDate())
                              ].join('-');
                              // Format HH:mm in LOCAL time
timeString = event.start && !event.allDay
? `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}`
: '';
                            } catch (formatError) {
                              console.error('Error formatting date/time:', formatError);
                              const now = new Date();
                              dateString = now.toISOString().split('T')[0];
                              timeString = '';
                            }
                            
                            return {
                              ...event,
                              editId: index, // Add unique ID for editing
                              dateString,
                              timeString,
                              selected: true // Default to selected
                            };
                          } catch (error) {
                            console.error('Error processing event for editing:', error, event);
                            // Return a safe fallback
                            const now = new Date();
                            return {
                              ...event,
                              editId: index,
                              dateString: now.toISOString().split('T')[0],
                              timeString: ''
                            };
                          }
                        });
                        setEditableEvents(editableEventsList);
                        setShowEventEditor(true);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>
                      </svg>
                      Review & Edit Events
                    </button>
                    
                    <button 
                      className="add-to-calendar-button"
                      style={{
                        ...addToCalendarButtonStyle,
                        opacity: calendarEvents.length === 0 ? 0.5 : 1,
                        cursor: calendarEvents.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                      data-testid="syllabus-add-to-calendar-button" 
                      disabled={calendarEvents.length === 0}
                      onMouseOver={(e) => {
                        if (calendarEvents.length > 0) {
                          e.currentTarget.style.backgroundColor = '#3367d6';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(66, 133, 244, 0.4)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (calendarEvents.length > 0) {
                          e.currentTarget.style.backgroundColor = '#4285F4';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(66, 133, 244, 0.3)';
                        }
                      }}
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
                                source: 'SYLLABUS', // Match the enum values in the database schema
                                // Add recurring event properties
                                isRecurring: event.isRecurring || false,
                                recurrenceFrequency: event.recurrenceFrequency || null,
                                // Use the repeatUntil date if available, otherwise use the default recurrenceEndDate
                                recurrenceEndDate: event.repeatUntil ? new Date(event.repeatUntil) : 
                                                  (event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : null),
                                recurrenceDays: event.recurrenceDays || []
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z" fill="white"/>
                      </svg>
                      Add to Calendar
                    </button>
                    
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
            <details>
              <summary>View Extracted JSON Data</summary>
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
            </details>
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
