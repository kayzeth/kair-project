import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Calendar from '../Calendar';
import * as nudgerService from '../../services/nudgerService';
import PreparationPrompt from '../PreparationPrompt';

// Mock the nudger service
jest.mock('../../services/nudgerService');

describe('Preparation Hours Integration Tests [KAIR-16]', () => {
  const mockEvents = [
    {
      id: '1',
      title: 'Regular Meeting',
      start: '2025-03-20',
      end: '2025-03-20',
      allDay: true
    },
    {
      id: '2',
      title: 'Final Exam',
      start: '2025-03-25',
      end: '2025-03-25',
      requiresPreparation: true, // Requires preparation but no hours specified
      allDay: false,
      startTime: '09:00',
      endTime: '11:00'
    }
  ];

  // Mock study plan with an event needing preparation input
  const mockStudyPlan = {
    events: [
      {
        id: '2',
        title: 'Final Exam',
        start: '2025-03-25',
        end: '2025-03-25',
        requiresPreparation: true,
        requiresStudy: true,
        suggestedStudyHours: 3,
        needsPreparationInput: true, // This flag triggers the preparation prompt
        allDay: false,
        startTime: '09:00',
        endTime: '11:00'
      }
    ],
    totalStudyHours: 3,
    eventCount: 1,
    eventsByDate: {
      '2025-03-25': [
        {
          id: '2',
          title: 'Final Exam',
          start: '2025-03-25',
          end: '2025-03-25',
          requiresPreparation: true,
          requiresStudy: true,
          suggestedStudyHours: 3,
          needsPreparationInput: true,
          allDay: false,
          startTime: '09:00',
          endTime: '11:00'
        }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the nudger service functions
    nudgerService.identifyUpcomingEvents.mockImplementation(() => mockStudyPlan.events);
    nudgerService.getStudyPlan.mockImplementation(() => mockStudyPlan);
    
    // Mock console.log to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  // Test the PreparationPrompt component in isolation
  describe('PreparationPrompt Component', () => {
    const mockEvent = {
      id: '2',
      title: 'Final Exam',
      start: '2025-03-25',
      startTime: '09:00',
      needsPreparationInput: true
    };
    
    const mockSave = jest.fn();
    const mockClose = jest.fn();
    const mockDismiss = jest.fn();
    
    it('renders correctly with event details', () => {
      render(
        <PreparationPrompt 
          events={[mockEvent]} 
          onSave={mockSave} 
          onClose={mockClose}
          onDismiss={mockDismiss}
        />
      );
      
      // Check that the component renders with the correct event title
      expect(screen.getByTestId('preparation-event-title-2')).toBeInTheDocument();
      expect(screen.getByTestId('preparation-event-title-2')).toHaveTextContent('Final Exam');
      
      // Check that the input field is present
      expect(screen.getByTestId('preparation-hours-input-2')).toBeInTheDocument();
    });
    
    it('calls onSave with correct values when save button is clicked', () => {
      render(
        <PreparationPrompt 
          events={[mockEvent]} 
          onSave={mockSave} 
          onClose={mockClose}
          onDismiss={mockDismiss}
        />
      );
      
      // Enter preparation hours
      const input = screen.getByTestId('preparation-hours-input-2');
      fireEvent.change(input, { target: { value: '4' } });
      
      // Click save button
      fireEvent.click(screen.getByTestId('save-button-2'));
      
      // Check that onSave was called with the correct values
      expect(mockSave).toHaveBeenCalledWith('2', 4);
    });
    
    it('calls onDismiss when remind later button is clicked', () => {
      render(
        <PreparationPrompt 
          events={[mockEvent]} 
          onSave={mockSave} 
          onClose={mockClose}
          onDismiss={mockDismiss}
        />
      );
      
      // Click remind later button
      fireEvent.click(screen.getByTestId('preparation-remind-later-2'));
      
      // Check that onDismiss was called
      expect(mockDismiss).toHaveBeenCalledWith('2');
    });
  });

  // Test the Calendar component's integration with preparation features
  describe('Calendar Integration', () => {
    it('renders the calendar with events', () => {
      render(<Calendar initialEvents={mockEvents} />);
      
      // Check that the calendar container is rendered
      expect(screen.getByTestId('calendar-container')).toBeInTheDocument();
    });
  });
});
