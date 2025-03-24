import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SyllabusParser from '../SyllabusParser';

// Mock the pdf.js library and its worker
jest.mock('pdfjs-dist/legacy/build/pdf', () => ({
  getDocument: jest.fn(),
}));

// Mock the pdf worker entry
jest.mock('pdfjs-dist/legacy/build/pdf.worker.entry', () => {});

// Mock fetch for API calls
global.fetch = jest.fn();

describe('SyllabusParser Component', () => {
  // Mock console methods to suppress logs during tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset fetch mock
    global.fetch.mockReset();
  });

  test('renders without crashing', () => {
    render(<SyllabusParser onAddEvents={() => {}} />);
    expect(screen.getByText('Syllabus Parser')).toBeInTheDocument();
    expect(screen.getByText(/Upload your course syllabus/)).toBeInTheDocument();
  });

  test('button is disabled when no file is selected', () => {
    render(<SyllabusParser onAddEvents={() => {}} />);
    
    // Add an API key
    const apiKeyInput = screen.getByPlaceholderText('Enter your OpenAI API key');
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    
    // Check that the button is disabled when no file is selected
    const parseButton = screen.getByText('Parse Syllabus');
    expect(parseButton).toBeDisabled();
  });

  test('shows error when no API key is provided', () => {
    render(<SyllabusParser onAddEvents={() => {}} />);
    
    // Create a mock file
    const file = new File(['dummy content'], 'syllabus.txt', { type: 'text/plain' });
    
    // Simulate file selection
    const fileInput = screen.getByLabelText(/Choose syllabus file/i);
    Object.defineProperty(fileInput, 'files', {
      value: [file]
    });
    fireEvent.change(fileInput);
    
    // Click the parse button without providing an API key
    fireEvent.click(screen.getByText('Parse Syllabus'));
    
    // Check if API key error message is displayed
    expect(screen.getByText('Please enter your OpenAI API key')).toBeInTheDocument();
  });

  test('handles invalid API key error correctly', async () => {
    render(<SyllabusParser onAddEvents={() => {}} />);
    
    // Create a mock file
    const file = new File(['dummy content'], 'syllabus.txt', { type: 'text/plain' });
    
    // Simulate file selection
    const fileInput = screen.getByLabelText(/Choose syllabus file/i);
    Object.defineProperty(fileInput, 'files', {
      value: [file]
    });
    fireEvent.change(fileInput);
    
    // Add an API key
    const apiKeyInput = screen.getByPlaceholderText('Enter your OpenAI API key');
    fireEvent.change(apiKeyInput, { target: { value: 'invalid-api-key' } });
    
    // Mock fetch to return an authentication error (401)
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({
        error: {
          message: 'Incorrect API key provided'
        }
      })
    });
    
    // Click the parse button
    fireEvent.click(screen.getByText('Parse Syllabus'));
    
    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to process syllabus. Please try again with a different file.')).toBeInTheDocument();
    });
  });

  test('extracts text from PDF correctly', async () => {
    // Get access to the mocked module
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
    
    render(<SyllabusParser onAddEvents={() => {}} />);
    
    // Create a mock PDF file
    const file = new File(['dummy pdf content'], 'syllabus.pdf', { type: 'application/pdf' });
    
    // Mock the ArrayBuffer method
    file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
    
    // Simulate file selection
    const fileInput = screen.getByLabelText(/Choose syllabus file/i);
    Object.defineProperty(fileInput, 'files', {
      value: [file]
    });
    fireEvent.change(fileInput);
    
    // Add an API key
    const apiKeyInput = screen.getByPlaceholderText('Enter your OpenAI API key');
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    
    // Mock PDF.js getDocument function
    const mockPage = {
      getTextContent: jest.fn().mockResolvedValue({
        items: [{ str: 'Course: ' }, { str: 'CS101' }, { str: 'Instructor: ' }, { str: 'John Doe' }]
      })
    };
    
    const mockPdf = {
      numPages: 1,
      getPage: jest.fn().mockResolvedValue(mockPage)
    };
    
    pdfjsLib.getDocument.mockReturnValue({
      promise: Promise.resolve(mockPdf)
    });
    
    // Mock successful API response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                courseName: 'Introduction to Computer Science',
                courseCode: 'CS101',
                instructor: 'John Doe',
                meetingTimes: [
                  { day: 'Monday', startTime: '10:00 AM', endTime: '11:30 AM', location: 'Room 101' }
                ],
                assignments: [],
                exams: []
              })
            }
          }
        ]
      })
    });
    
    // Click the parse button
    fireEvent.click(screen.getByText('Parse Syllabus'));
    
    // Wait for the PDF extraction and API call to complete
    await waitFor(() => {
      // Verify that getDocument was called
      expect(pdfjsLib.getDocument).toHaveBeenCalled();
      
      // Verify that the API was called with the extracted text
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });
  });

  describe('Calendar Event Integration', () => {
    test('converts OpenAI response to calendar events correctly', async () => {
      const mockOnAddEvents = jest.fn();
      render(<SyllabusParser onAddEvents={mockOnAddEvents} />);

      // Mock OpenAI response data
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              courseName: 'Advanced React',
              courseCode: 'CS401',
              instructor: 'Jane Smith',
              meetingTimes: [{
                day: 'Tuesday',
                startTime: '2:00 PM',
                endTime: '3:30 PM',
                location: 'Room 202'
              }],
              assignments: [{
                title: 'Project Proposal',
                dueDate: '2025-03-25',
                description: 'Submit project proposal'
              }],
              exams: []
            })
          }
        }]
      };

      // Mock fetch response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });

      // Simulate file selection and API key input
      const file = new File(['dummy content'], 'syllabus.txt', { type: 'text/plain' });
      const fileInput = screen.getByLabelText(/Choose syllabus file/i);
      Object.defineProperty(fileInput, 'files', {
        value: [file]
      });
      fireEvent.change(fileInput);

      const apiKeyInput = screen.getByPlaceholderText('Enter your OpenAI API key');
      fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });

      // Trigger parsing
      fireEvent.click(screen.getByText('Parse Syllabus'));

      // Wait for parsed data to appear
      await waitFor(() => {
        expect(screen.getByText('Extracted Information')).toBeInTheDocument();
      });

      // Simulate adding events to calendar
      const addToCalendarButton = screen.getByText('Add to Calendar');
      fireEvent.click(addToCalendarButton);

      // Verify calendar events were created correctly
      await waitFor(() => {
        expect(mockOnAddEvents).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({
            title: 'Advanced React - Room 202',
            start: expect.stringMatching(/2025-03-\d{2}T14:00:00/),
            end: expect.stringMatching(/2025-03-\d{2}T15:30:00/),
            recurring: true,
            recurringPattern: 'tuesday'
          }),
          expect.objectContaining({
            title: 'Due: Project Proposal',
            start: expect.stringMatching(/2025-03-\d{2}/),
            end: expect.stringMatching(/2025-03-\d{2}/),
            allDay: true
          })
        ]));
      });
    });
  });
});
