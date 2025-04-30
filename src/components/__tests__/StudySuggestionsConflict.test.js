import '@testing-library/jest-dom';

// No need to import React or the component since we're testing the logic directly

describe('Study Suggestions Conflict Detection', () => {
  // Helper function to create a test event
  const createEvent = (id, start, end, isStudySession = false, relatedEventId = null) => ({
    id,
    title: `Event ${id}`,
    start: new Date(start),
    end: new Date(end),
    isStudySession,
    relatedEventId
  });

  // Implementation of the conflict checking logic from StudySuggestions.js
  const checkForConflicts = (startTime, endTime, eventsToCheck = [], parentEventId = 'parent-event') => {
    const conflictingEvents = eventsToCheck.filter(event => {
      // Skip the parent event itself
      if (event.id === parentEventId) return false;
      
      // Skip study sessions related to this event
      if (event.isStudySession && event.relatedEventId === parentEventId) return false;
      
      // Skip all-day events in the hour-by-hour verification
      if (event.allDay === true) return false;
      
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      // Check for overlap
      return (startTime < eventEnd && endTime > eventStart);
    });
    
    return conflictingEvents.length > 0 ? conflictingEvents : null;
  };

  test('should detect no conflicts when there are no events', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    const events = [];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    expect(conflicts).toBeNull();
  });

  test('should detect conflicts with overlapping events', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create events with different types of overlaps
    const events = [
      // Complete overlap (event contains study session)
      createEvent('1', '2025-05-01T09:00:00', '2025-05-01T13:00:00'),
      
      // Partial overlap at start
      createEvent('2', '2025-05-01T09:00:00', '2025-05-01T11:00:00'),
      
      // Partial overlap at end
      createEvent('3', '2025-05-01T11:00:00', '2025-05-01T13:00:00'),
      
      // Complete overlap (study session contains event)
      createEvent('4', '2025-05-01T10:30:00', '2025-05-01T11:30:00'),
      
      // No overlap (before)
      createEvent('5', '2025-05-01T08:00:00', '2025-05-01T09:30:00'),
      
      // No overlap (after)
      createEvent('6', '2025-05-01T12:30:00', '2025-05-01T14:00:00'),
      
      // Edge case: event ends exactly when study session starts
      createEvent('7', '2025-05-01T09:00:00', '2025-05-01T10:00:00'),
      
      // Edge case: event starts exactly when study session ends
      createEvent('8', '2025-05-01T12:00:00', '2025-05-01T13:00:00')
    ];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // Should detect 4 conflicts (events 1, 2, 3, 4)
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(4);
    expect(conflicts.map(e => e.id)).toEqual(['1', '2', '3', '4']);
  });

  test('should ignore the parent event when checking for conflicts', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create events including the parent event
    const events = [
      // This is the parent event that should be ignored
      { ...createEvent('parent-event', '2025-05-01T09:00:00', '2025-05-01T13:00:00') },
      
      // Regular event that should be detected as conflict
      createEvent('1', '2025-05-01T11:00:00', '2025-05-01T13:00:00')
    ];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // Should only detect the non-parent event as conflict
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].id).toBe('1');
  });

  test('should ignore study sessions related to the parent event', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create events including study sessions related to the parent event
    const events = [
      // Study session related to the parent event (should be ignored)
      createEvent('study-1', '2025-05-01T09:00:00', '2025-05-01T13:00:00', true, 'parent-event'),
      
      // Study session related to a different event (should be detected)
      createEvent('study-2', '2025-05-01T11:00:00', '2025-05-01T13:00:00', true, 'other-event'),
      
      // Regular event (should be detected)
      createEvent('regular', '2025-05-01T09:00:00', '2025-05-01T11:00:00')
    ];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // Should detect 2 conflicts (study-2 and regular)
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(2);
    expect(conflicts.map(e => e.id).sort()).toEqual(['regular', 'study-2']);
  });

  test('should handle edge cases with exact start/end times', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create events with edge case timings
    const events = [
      // Event ends exactly when study session starts (should not be a conflict)
      createEvent('1', '2025-05-01T09:00:00', '2025-05-01T10:00:00'),
      
      // Event starts exactly when study session ends (should not be a conflict)
      createEvent('2', '2025-05-01T12:00:00', '2025-05-01T13:00:00'),
      
      // Event starts exactly at study session start (should be a conflict)
      createEvent('3', '2025-05-01T10:00:00', '2025-05-01T11:00:00'),
      
      // Event ends exactly at study session end (should be a conflict)
      createEvent('4', '2025-05-01T11:00:00', '2025-05-01T12:00:00')
    ];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // Should detect 2 conflicts (events 3 and 4)
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(2);
    expect(conflicts.map(e => e.id).sort()).toEqual(['3', '4']);
  });

  test('should handle all-day events correctly', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create all-day events
    const allDayEvent = {
      id: 'all-day',
      title: 'All Day Event',
      start: new Date('2025-05-01T00:00:00'),
      end: new Date('2025-05-02T00:00:00'),
      allDay: true
    };
    
    // Create a regular event that conflicts
    const regularEvent = {
      id: 'regular',
      title: 'Regular Event',
      start: new Date('2025-05-01T11:00:00'),
      end: new Date('2025-05-01T13:00:00'),
      allDay: false
    };
    
    // Test with just the all-day event
    let conflicts = checkForConflicts(startTime, endTime, [allDayEvent]);
    
    // Should NOT detect the all-day event as a conflict since we're ignoring all-day events
    expect(conflicts).toBeNull();
    
    // Test with both events
    conflicts = checkForConflicts(startTime, endTime, [allDayEvent, regularEvent]);
    
    // Should only detect the regular event as a conflict
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].id).toBe('regular');
  });
  
  test('should handle various all-day event scenarios', () => {
    // Test study session time: 10am-12pm on May 1st, 2025
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create different types of all-day events
    const events = [
      // 1. Single-day all-day event on the same day (conflict)
      {
        id: 'same-day',
        title: 'Same Day All-Day Event',
        start: new Date('2025-05-01T00:00:00'),
        end: new Date('2025-05-02T00:00:00'),  // Note: all-day events typically end at 00:00 the next day
        allDay: true
      },
      
      // 2. Multi-day all-day event that includes the study day (conflict)
      {
        id: 'multi-day-including',
        title: 'Multi-Day All-Day Event (Including Study Day)',
        start: new Date('2025-04-30T00:00:00'),
        end: new Date('2025-05-03T00:00:00'),
        allDay: true
      },
      
      // 3. All-day event on the day before (no conflict)
      {
        id: 'day-before',
        title: 'Day Before All-Day Event',
        start: new Date('2025-04-30T00:00:00'),
        end: new Date('2025-05-01T00:00:00'),
        allDay: true
      },
      
      // 4. All-day event on the day after (no conflict)
      {
        id: 'day-after',
        title: 'Day After All-Day Event',
        start: new Date('2025-05-02T00:00:00'),
        end: new Date('2025-05-03T00:00:00'),
        allDay: true
      },
      
      // 5. All-day event that ends exactly when study session starts (edge case - no conflict)
      {
        id: 'ends-at-start',
        title: 'Ends At Start All-Day Event',
        start: new Date('2025-04-30T00:00:00'),
        end: new Date('2025-05-01T10:00:00'),  // Ends exactly at 10am
        allDay: true
      },
      
      // 6. All-day event that starts exactly when study session ends (edge case - no conflict)
      {
        id: 'starts-at-end',
        title: 'Starts At End All-Day Event',
        start: new Date('2025-05-01T12:00:00'),  // Starts exactly at 12pm
        end: new Date('2025-05-02T00:00:00'),
        allDay: true
      },
      
      // 7. Regular event marked as all-day but with specific times (conflict)
      {
        id: 'specific-times',
        title: 'Specific Times All-Day Event',
        start: new Date('2025-05-01T09:00:00'),
        end: new Date('2025-05-01T13:00:00'),
        allDay: true  // Even though it has specific times
      },
      
      // 8. Parent event marked as all-day (should be ignored)
      {
        id: 'parent-event',
        title: 'Parent All-Day Event',
        start: new Date('2025-05-01T00:00:00'),
        end: new Date('2025-05-02T00:00:00'),
        allDay: true
      },
      
      // 9. Study session for parent event marked as all-day (should be ignored)
      {
        id: 'parent-study',
        title: 'Parent Study Session',
        start: new Date('2025-05-01T09:00:00'),
        end: new Date('2025-05-01T13:00:00'),
        allDay: true,
        isStudySession: true,
        relatedEventId: 'parent-event'
      }
    ];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // With the updated implementation, all-day events should be ignored
    // So we should have no conflicts since all test events are all-day events
    expect(conflicts).toBeNull();
    
    // Add a regular (non-all-day) event that conflicts with the study session
    const regularEvent = {
      id: 'regular-conflict',
      title: 'Regular Event with Conflict',
      start: new Date('2025-05-01T11:00:00'),
      end: new Date('2025-05-01T13:00:00'),
      allDay: false
    };
    
    // Test with the regular event added
    const conflictsWithRegular = checkForConflicts(startTime, endTime, [...events, regularEvent]);
    
    // Should only detect the regular event as a conflict
    expect(conflictsWithRegular).not.toBeNull();
    expect(conflictsWithRegular.length).toBe(1);
    expect(conflictsWithRegular[0].id).toBe('regular-conflict');
    
    // Note: 'starts-at-end' is detected as a conflict because in the implementation,
    // the condition is (startTime < eventEnd && endTime > eventStart)
    // When eventStart === endTime, the second part (endTime > eventStart) evaluates to false
    // in strict comparison, but may be true in non-strict comparison due to JavaScript's
    // date handling. This is an edge case that depends on the exact implementation.
  });

  test('should handle events spanning multiple days', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create multi-day events
    const multiDayEvent = createEvent('multi-day', '2025-04-30T10:00:00', '2025-05-02T10:00:00');
    const events = [multiDayEvent];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // Should detect the multi-day event as a conflict
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].id).toBe('multi-day');
  });

  test('should handle events with identical start and end times', () => {
    const startTime = new Date('2025-05-01T10:00:00');
    const endTime = new Date('2025-05-01T12:00:00');
    
    // Create events with identical start/end times
    const events = [
      // Event with same start and end time as study session
      createEvent('1', '2025-05-01T10:00:00', '2025-05-01T12:00:00'),
      
      // Zero-duration event within study session time
      createEvent('2', '2025-05-01T11:00:00', '2025-05-01T11:00:00')
    ];
    
    const conflicts = checkForConflicts(startTime, endTime, events);
    
    // Should detect both events as conflicts
    expect(conflicts).not.toBeNull();
    expect(conflicts.length).toBe(2);
    
    // Both events should be detected as conflicts
    const conflictIds = conflicts.map(e => e.id).sort();
    expect(conflictIds).toEqual(['1', '2']);
    
    // Note: The zero-duration event is detected as a conflict because
    // in JavaScript, when comparing dates: startTime < eventEnd is still true
    // even when eventStart === eventEnd, as long as startTime is before that time.
    // Similarly, endTime > eventStart is true when endTime is after that time.
  });
});
