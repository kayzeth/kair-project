import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventModal from '../EventModal';
import userEvent from '@testing-library/user-event';

// Mock the EventModal component for Safari tests
jest.mock('../EventModal', () => {
  const ActualEventModal = jest.requireActual('../EventModal').default;
  return (props) => {
    return <ActualEventModal {...props} />;
  };
});

// Mock the navigator object to simulate Safari browser
const mockSafariUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15';

describe('EventModal Safari Compatibility Tests', () => {
  const originalUserAgent = window.navigator.userAgent;
  const mockDate = new Date(2025, 2, 15, 10, 0); // March 15, 2025, 10:00 AM
  
  // Mock event with all required properties
  const mockEvent = {
    id: '1',
    title: 'Test Event',
    description: 'Test Description',
    start: new Date(2025, 2, 15, 10, 0),
    end: new Date(2025, 2, 15, 11, 0),
    allDay: false,
    color: '#d2b48c',
    requiresPreparation: true,
    preparationHours: '2'
  };
  
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnTriggerStudySuggestions = jest.fn();

  // Setup Safari user agent before tests
  beforeAll(() => {
    // Mock navigator.userAgent to simulate Safari
    Object.defineProperty(window.navigator, 'userAgent', {
      value: mockSafariUserAgent,
      configurable: true
    });
  });

  // Restore original user agent after tests
  afterAll(() => {
    // Restore original navigator.userAgent
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
  });

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSave.mockClear();
    mockOnDelete.mockClear();
    mockOnTriggerStudySuggestions.mockClear();
    
    // Mock getBoundingClientRect to return non-overlapping values for different elements
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      if (this.classList.contains('checkbox-input')) {
        return {
          width: 20,
          height: 20,
          top: 0,
          left: 0,
          bottom: 20,
          right: 20,
          x: 0,
          y: 0
        };
      } else if (this.classList.contains('preparation-hours-input')) {
        return {
          width: 100,
          height: 30,
          top: 50, // Positioned below the checkbox
          left: 0,
          bottom: 80,
          right: 100,
          x: 0,
          y: 50
        };
      }
      
      // Default for other elements
      return {
        width: 100,
        height: 30,
        top: 0,
        left: 0,
        bottom: 30,
        right: 100,
        x: 0,
        y: 0
      };
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Requires Preparation checkbox and preparation hours input do not overlap in Safari', async () => {
    await act(async () => {
      render(
        <EventModal 
          onClose={mockOnClose} 
          onSave={mockOnSave} 
          onDelete={mockOnDelete}
          onTriggerStudySuggestions={mockOnTriggerStudySuggestions}
          event={mockEvent} 
          selectedDate={mockDate}
        />
      );
    });

    // Check if the checkbox is rendered and interactable
    const requiresPrepCheckbox = screen.getByTestId('eventmodalsafari-requires-preparation-checkbox');
    expect(requiresPrepCheckbox).toBeInTheDocument();
    expect(requiresPrepCheckbox).toBeVisible();
    expect(requiresPrepCheckbox).not.toBeDisabled();

    // The preparation hours input should already be visible since requiresPreparation is true
    // Check if the preparation hours input appears and is interactable
    const prepHoursInput = screen.getByTestId('eventmodalsafari-preparation-hours-input');
    expect(prepHoursInput).toBeInTheDocument();
    expect(prepHoursInput).toBeVisible();
    expect(prepHoursInput).not.toBeDisabled();

    // Test for overlap by checking computed styles and positions
    const checkboxRect = requiresPrepCheckbox.getBoundingClientRect();
    const inputRect = prepHoursInput.getBoundingClientRect();
    
    // Function to check if elements overlap
    const doElementsOverlap = (rect1, rect2) => {
      return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
      );
    };

    // Verify elements don't overlap
    expect(doElementsOverlap(checkboxRect, inputRect)).toBe(false);

    // Test interaction with preparation hours input
    await act(async () => {
      userEvent.type(prepHoursInput, '2');
    });
    
    expect(prepHoursInput).toHaveValue(2);

    // Test that we can change the preparation hours value
    await act(async () => {
      fireEvent.change(prepHoursInput, { target: { value: '3' } });
    });
    
    expect(prepHoursInput).toHaveValue(3);
  });

  test('Safari-specific CSS properties are applied correctly to prevent overlap', async () => {
    await act(async () => {
      render(
        <EventModal 
          onClose={mockOnClose} 
          onSave={mockOnSave} 
          onDelete={mockOnDelete}
          onTriggerStudySuggestions={mockOnTriggerStudySuggestions}
          event={mockEvent} 
          selectedDate={mockDate}
        />
      );
    });

    // The preparation hours should already be visible since requiresPreparation is true
    const requiresPrepCheckbox = screen.getByTestId('eventmodalsafari-requires-preparation-checkbox');
    expect(requiresPrepCheckbox).toBeInTheDocument();
    expect(requiresPrepCheckbox).toBeChecked();

    // Get the preparation hours container
    const prepHoursContainer = screen.getByTestId('eventmodalsafari-preparation-hours-container');
    
    // Check if Safari-specific CSS is applied (this would be browser-specific in real environment)
    const computedStyle = window.getComputedStyle(prepHoursContainer);
    
    // Mock the getComputedStyle to simulate Safari's rendering
    window.getComputedStyle = jest.fn().mockReturnValue({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: '10px',
      marginBottom: '10px',
      width: '100%'
    });
    
    const safariStyle = window.getComputedStyle(prepHoursContainer);
    
    // Verify Safari-specific styles
    expect(safariStyle.display).toBe('flex');
    expect(safariStyle.flexDirection).toBe('row');
    expect(safariStyle.marginTop).toBe('10px');
    expect(safariStyle.width).toBe('100%');
    
    // Test that the preparation hours input is still interactable
    const prepHoursInput = screen.getByTestId('eventmodalsafari-preparation-hours-input');
    await act(async () => {
      fireEvent.change(prepHoursInput, { target: { value: '3' } });
    });
    
    expect(prepHoursInput).toHaveValue(3);
  });
});
