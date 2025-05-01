import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventModal from '../EventModal';

describe('Canvas Event Modal Tests', () => {
  // Mock functions
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnTriggerStudySuggestions = jest.fn();

  // Test data - simulating a Canvas event with HTML in description
  const canvasEvent = {
    title: 'Canvas Assignment: Final Project',
    description: '<p>Submit your final project</p><ul><li>Include documentation</li><li>Add tests</li></ul>',
    source: 'CANVAS',
    start: new Date('2025-05-15T14:00:00'),
    end: new Date('2025-05-15T15:00:00'),
    allDay: false,
    metadata: {
      courseId: '12345',
      assignmentId: '67890'
    }
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('displays Canvas event description without HTML tags', () => {
    render(
      <EventModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        onTriggerStudySuggestions={mockOnTriggerStudySuggestions}
        event={canvasEvent}
      />
    );

    // Check that HTML tags are not visible but text content is
    const description = screen.getByTestId('eventmodal-description');
    expect(description).toHaveValue(
      'Submit your final project\n• Include documentation\n• Add tests'
    );
    expect(description).not.toHaveValue(expect.stringContaining('<p>'));
    expect(description).not.toHaveValue(expect.stringContaining('<ul>'));
    expect(description).not.toHaveValue(expect.stringContaining('<li>'));
  });

  test('allows saving event with same start and end time', async () => {
    // Create an event with same start and end time
    const sameTimeEvent = {
      ...canvasEvent,
      start: new Date('2025-05-15T14:00:00'),
      end: new Date('2025-05-15T14:00:00')
    };

    render(
      <EventModal
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        onTriggerStudySuggestions={mockOnTriggerStudySuggestions}
        event={sameTimeEvent}
      />
    );

    // Verify the start and end times are the same
    const startTime = screen.getByTestId('eventmodal-start-time');
    const endTime = screen.getByTestId('eventmodal-end-time');
    expect(startTime).toHaveValue('14:00');
    expect(endTime).toHaveValue('14:00');

    // Try to save the event
    const saveButton = screen.getByTestId('eventmodal-save-button');
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    // Verify save was called with correct data
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      const savedEvent = mockOnSave.mock.calls[0][0];
      expect(savedEvent.start).toEqual(sameTimeEvent.start);
      expect(savedEvent.end).toEqual(sameTimeEvent.end);
    });
  });
});
