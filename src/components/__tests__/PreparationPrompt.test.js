import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreparationPrompt from '../PreparationPrompt';

describe('PreparationPrompt Component', () => {
  const mockEvents = [
    {
      id: '123',
      title: 'Final Exam',
      start: '2025-04-15',
      startTime: '10:00',
      requiresPreparation: true
    },
    {
      id: '456',
      title: 'Research Paper Due',
      start: '2025-04-20',
      startTime: '14:00',
      requiresPreparation: true
    }
  ];
  
  const mockSave = jest.fn();
  const mockClose = jest.fn();
  const mockDismiss = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders correctly with event details', () => {
    render(
      <PreparationPrompt 
        events={[mockEvents[0]]} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    // Check that the event title is displayed
    expect(screen.getByText('Final Exam')).toBeInTheDocument();
    
    // Check that the date is displayed - using a more flexible approach
    const dateElement = screen.getByText(/at 10:00/);
    expect(dateElement).toBeInTheDocument();
    
    // Check that the input field is present
    expect(screen.getByTestId('preparation-hours-input-123')).toBeInTheDocument();
    
    // Check that the buttons are present
    expect(screen.getByTitle('Remind me later')).toBeInTheDocument();
    expect(screen.getByTitle('Save hours')).toBeInTheDocument();
  });
  
  it('validates input and shows error for invalid values', () => {
    render(
      <PreparationPrompt 
        events={[mockEvents[0]]} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    const input = screen.getByTestId('preparation-hours-input-123');
    
    // Try to enter a negative number
    fireEvent.change(input, { target: { value: '-5' } });
    
    // Input should remain empty because validation prevents negative numbers
    expect(input.value).toBe('');
    
    // Error message should be displayed
    expect(screen.getByText('Please enter a positive number')).toBeInTheDocument();
  });
  
  it('allows valid input and saves correctly', () => {
    render(
      <PreparationPrompt 
        events={[mockEvents[0]]} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    const input = screen.getByTestId('preparation-hours-input-123');
    
    // Enter a valid number
    fireEvent.change(input, { target: { value: '3.5' } });
    
    // Input should be updated
    expect(input.value).toBe('3.5');
    
    // Click save button
    fireEvent.click(screen.getByTestId('save-button-123'));
    
    // Check that onSave was called with correct values
    expect(mockSave).toHaveBeenCalledWith('123', 3.5);
  });
  
  it('shows error when trying to save without entering hours', () => {
    render(
      <PreparationPrompt 
        events={[mockEvents[0]]} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    // Click save button without entering hours
    fireEvent.click(screen.getByTestId('save-button-123'));
    
    // Check that error message is displayed
    expect(screen.getByText('Please enter preparation hours')).toBeInTheDocument();
    
    // Check that onSave was not called
    expect(mockSave).not.toHaveBeenCalled();
  });
  
  it('dismisses the event when remind later is clicked', () => {
    render(
      <PreparationPrompt 
        events={[mockEvents[0]]} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    // Click remind later button
    fireEvent.click(screen.getByTitle('Remind me later'));
    
    // Check that onDismiss was called with the correct event ID
    expect(mockDismiss).toHaveBeenCalledWith('123');
  });
  
  it('renders multiple events in a list view', () => {
    render(
      <PreparationPrompt 
        events={mockEvents} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    // Check that both events are displayed
    expect(screen.getByText('Final Exam')).toBeInTheDocument();
    expect(screen.getByText('Research Paper Due')).toBeInTheDocument();
    
    // Check that both inputs are present
    expect(screen.getByTestId('preparation-hours-input-123')).toBeInTheDocument();
    expect(screen.getByTestId('preparation-hours-input-456')).toBeInTheDocument();
  });
  
  it('saves hours for multiple events independently', () => {
    render(
      <PreparationPrompt 
        events={mockEvents} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    // Enter hours for first event
    const input1 = screen.getByTestId('preparation-hours-input-123');
    fireEvent.change(input1, { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('save-button-123'));
    
    // Check that onSave was called with correct values for first event
    expect(mockSave).toHaveBeenCalledWith('123', 3);
    
    // Enter hours for second event
    const input2 = screen.getByTestId('preparation-hours-input-456');
    fireEvent.change(input2, { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('save-button-456'));
    
    // Check that onSave was called with correct values for second event
    expect(mockSave).toHaveBeenCalledWith('456', 5);
  });
  
  it('saves when Enter key is pressed', () => {
    render(
      <PreparationPrompt 
        events={[mockEvents[0]]} 
        onSave={mockSave} 
        onClose={mockClose}
        onDismiss={mockDismiss}
      />
    );
    
    const input = screen.getByTestId('preparation-hours-input-123');
    
    // Enter a valid number
    fireEvent.change(input, { target: { value: '2' } });
    
    // Press Enter key
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    // Check that onSave was called with correct values
    expect(mockSave).toHaveBeenCalledWith('123', 2);
  });
});
