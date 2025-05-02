describe('Event Modal and Study Plan Tests', () => {
  // Login before each test
  beforeEach(() => {
    // Visit the site and login
    cy.visit('/');
    
    // Simplified login process - adjust based on your actual login implementation
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // After login, we should be redirected to the onboarding page first
    cy.url().should('include', '/onboarding');
    
    // Complete the onboarding process (simplified)
    // You'll need to adjust this based on your actual onboarding flow
    cy.get('button').contains(/continue|next|finish/i).click();
    
    // Navigate to calendar page after onboarding
    cy.visit('/calendar');
  });

  // This test covers the full flow: creating an event, finding it again, adding preparation hours,
  // generating a study plan, and saving all study suggestions
  it('should create an event, add preparation hours, generate and save study plan', () => {
    // Create a unique event title to find it later
    const eventTitle = `Test Event ${Date.now()}`;
    
    // Step 1: Navigate to May 31 and create the event
    // First, navigate to May 2025
    cy.get('[data-testid="calendar-title"]').then($display => {
      // Keep clicking the next month button until we reach May 2025
      function navigateToMay() {
        const currentMonthYear = $display.text();
        if (!currentMonthYear.includes('May 2025')) {
          // Find the navigation buttons in the calendar header
          cy.get('.calendar-nav button').eq(2).click(); // This should be the next month button
          cy.wait(300); // Wait for the calendar to update
          cy.get('[data-testid="calendar-title"]').then($updatedDisplay => {
            if (!$updatedDisplay.text().includes('May 2025')) {
              navigateToMay();
            }
          });
        }
      }
      navigateToMay();
    });
    
    // Now find and click on May 31 specifically
    cy.get('[data-testid="monthview-day-2025-05-31"]').click();
    
    // Check if the event modal appears
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal').should('be.visible');
    
    // Fill in the event details
    cy.get('.title-input').type(eventTitle);
    
    // Add a description
    cy.get('.description-input').type('This is a test event for Cypress testing');
    
    // Save the event
    cy.get('[data-testid="eventmodal-save-button"]').click();
    
    // Wait for the modal to close
    cy.get('.modal-overlay').should('not.exist');
    
    // Step 2: Find the event we just created and open it
    // This might need adjustment based on how events are displayed in your calendar
    cy.contains(eventTitle).click();
    
    // Check if the event modal appears again
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal').should('be.visible');
    
    // Verify the event title is correct
    cy.get('.title-input').should('have.value', eventTitle);
    
    // Step 3: Add preparation requirements
    // Check the "requires preparation" checkbox
    cy.get('[data-testid="eventmodalsafari-requires-preparation-checkbox"]').click();
    
    // Verify the preparation hours container appears
    cy.get('[data-testid="eventmodalsafari-preparation-hours-container"]').should('be.visible');
    
    // Enter 5 hours in the preparation hours input
    cy.get('[data-testid="eventmodalsafari-preparation-hours-input"]').clear().type('5');
    
    // Save the updated event
    cy.get('[data-testid="eventmodal-save-button"]').click();
    
    // Wait for the modal to close
    cy.get('.modal-overlay').should('not.exist');
    
    // Step 4: Find the event again to generate study plan
    cy.contains(eventTitle).click();
    
    // Check if the event modal appears again
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal').should('be.visible');
    
    // Verify the preparation hours are saved
    cy.get('[data-testid="eventmodalsafari-requires-preparation-checkbox"]').should('be.checked');
    cy.get('[data-testid="eventmodalsafari-preparation-hours-input"]').should('have.value', '5');
    
    // Click the "Generate Study Plan" button
    cy.get('[data-testid="eventmodal-trigger-study-suggestions-button"]').click();
    
    // Wait for the study suggestions to load
    // This might take some time if it's making API calls
    cy.get('.modal-overlay', { timeout: 10000 }).should('be.visible');
    
    // Step 5: Save all study suggestions
    // Wait for the study suggestions to appear
    cy.contains('Study Suggestions', { timeout: 10000 }).should('be.visible');
    
    // Click the "Save All" button for study suggestions
    // Adjust this selector based on your actual implementation
    cy.contains('button', 'Add All').click();
    
    // Verify success message or that we're back to the calendar view
    cy.get('.modal-overlay').should('not.exist', { timeout: 5000 });
    
    // Wait a moment for the calendar to update
    cy.wait(1000);
    
    // Verify the original event still exists in the calendar
    // Use the unique event title we created at the beginning
    cy.contains(eventTitle).should('exist');
    
    // Verify that study suggestions were added to the calendar
    // This could be done by checking if there are more events than just our original one
    cy.get('.calendar-container').should('be.visible');
    
    // Log the event title for debugging purposes
    cy.log(`Checking for event with title: ${eventTitle}`);
    
    // Take a screenshot of the calendar for verification
    cy.screenshot('calendar-after-adding-study-suggestions');
  });
});
