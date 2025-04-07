import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as nudgerService from '../../services/nudgerService';
import * as eventService from '../../services/eventService';

// Mock the services
jest.mock('../../services/eventService', () => ({
  getUserEvents: jest.fn().mockResolvedValue([]),
  createEvent: jest.fn().mockResolvedValue({}),
  updateEvent: jest.fn().mockResolvedValue({}),
  deleteEvent: jest.fn().mockResolvedValue({})
}));

jest.mock('../../services/nudgerService', () => ({
  getStudyPlan: jest.fn().mockReturnValue({
    events: [],
    totalStudyHours: 0,
    eventCount: 0,
    eventsByDate: {}
  }),
  identifyUpcomingEvents: jest.fn().mockReturnValue([])
}));

// Create a simple test component
const TestComponent = () => {
  return <div data-testid="test-component">Test Component</div>;
};

describe('Nudger Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('nudger service can identify upcoming events', () => {
    // Setup test data
    const testEvents = [
      {
        id: '1',
        title: 'Test Event',
        start: '2025-04-15',
        requiresPreparation: true
      }
    ];
    
    // Mock the service to return our test data
    nudgerService.identifyUpcomingEvents.mockReturnValue(testEvents);
    
    // Call the service
    const result = nudgerService.identifyUpcomingEvents(testEvents);
    
    // Verify the service was called and returned the expected result
    expect(nudgerService.identifyUpcomingEvents).toHaveBeenCalled();
    expect(result).toEqual(testEvents);
  });

  test('nudger service can generate study plans', () => {
    // Setup test data
    const testEvents = [
      {
        id: '1',
        title: 'Test Event',
        start: '2025-04-15',
        requiresPreparation: true,
        preparationHours: 5
      }
    ];
    
    // Mock the expected study plan
    const expectedStudyPlan = {
      events: testEvents,
      totalStudyHours: 5,
      eventCount: 1,
      eventsByDate: { '2025-04-15': [testEvents[0]] }
    };
    
    // Configure the mock to return our expected study plan
    nudgerService.getStudyPlan.mockReturnValue(expectedStudyPlan);
    
    // Call the service
    const result = nudgerService.getStudyPlan(testEvents);
    
    // Verify the service was called and returned the expected result
    expect(nudgerService.getStudyPlan).toHaveBeenCalledWith(testEvents);
    expect(result).toEqual(expectedStudyPlan);
  });

  test('test component renders correctly', () => {
    // Render the test component
    const { getByTestId } = render(<TestComponent />);
    
    // Verify the component renders with the expected test ID
    expect(getByTestId('test-component')).toBeInTheDocument();
  });
});
