describe('Navigation Tests', () => {
  it('should navigate to the home page', () => {
    cy.visit('/');
    cy.url().should('include', '/');
    cy.get('body').should('exist');
  });

  it('should navigate through onboarding to calendar page and show the sidebar', () => {
    // First, we need to log in (this is a simplified example)
    cy.visit('/');
    
    // Assuming there's a login form on the landing page
    // You'll need to adjust this based on your actual login implementation
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // After login, we should be redirected to the onboarding page first
    cy.url().should('include', '/onboarding');
    
    // Complete the onboarding process
    // This is a simplified example - you'll need to adjust based on your actual onboarding flow
    // For example, clicking through onboarding steps or filling out forms
    cy.get('button').contains(/continue|next|finish/i).click();
    
    // Navigate to calendar page after onboarding
    cy.visit('/calendar');
    
    // Check that the sidebar exists with the correct elements
    cy.get('[data-testid="header"]').should('exist');
    cy.get('[data-testid="header-logo"]').should('be.visible');
    cy.get('[data-testid="header-title"]').should('contain', 'Kairos');
    
    // Check that the navigation links exist
    cy.get('[data-testid="header-nav-calendar"]').should('exist');
    cy.get('[data-testid="header-nav-account"]').should('exist');
    cy.get('[data-testid="header-nav-syllabus"]').should('exist');
    cy.get('[data-testid="header-nav-study-suggestions"]').should('exist');
  });
  
  it('should parse a syllabus and add events to calendar', () => {
    // Login first
    cy.visit('/');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    
    // Handle onboarding if needed
    cy.url().should('include', '/onboarding');
    cy.get('button').contains(/continue|next|finish/i).click();
    
    // Navigate to syllabus parser page
    cy.visit('/syllabusParser');
    cy.url().should('include', '/syllabusParser');
    
    // Wait for the syllabus parser page to load
    cy.contains('Syllabus Parser').should('be.visible');
    
    // Find the textarea for syllabus input and paste the syllabus
    cy.get('textarea').should('be.visible').clear().type(`page 1 of 5
CAS CS 460: Introduction to Database Systems
Boston University, Spring 2025
Syllabus
Description
This course covers the fundamental concepts of database systems. Topics include
data models (ER, relational, and others); query languages (relational algebra, SQL,
and others); implementation techniques of database management systems (index
structures, concurrency control, recovery, and query processing); management of
semistructured and complex data; distributed and noSQL databases.
Prerequisites
Lectures and Labs
lectures: MWF, 1:25-2:15 pm, Law Auditorium
lab: a weekly session; see your schedule for the time and location
Midterm Exams
You must be able to take the midterm exams, which will be held during lecture on
Monday, March 3, and Wednesday, April 16, in locations to be announced.
Schedule (tentative)
week lecture dates topics, exams, assignments, and special dates
0 1/22, 1/24 Course overview and introduction
Database design and ER diagrams
The relational model
No labs this week.
1 1/27, 1/29, 1/31 The relational model (cont.)
Relational algebra and SQL
2 2/3, 2/5, 2/7 SQL (cont.)
Storage fundamentals
2/3: last day to add a class
Problem Set 1, part I due on 2/4
3 2/10, 2/12, 2/14 Storage and indexing
4 2/18, 2/19, 2/21 Semi-structured data and XML databases
No lecture on 2/17 (Presidents Day)
Lecture on 2/18 (Monday schedule)
Problem Set 1, part II due on 2/18
5 2/24, 2/26, 2/28 Implementing a logical-to-physical mapping
Query processing
Transactions and schedules
2/25: last day to drop without a 'W'
Problem Set 2, part I due on 2/25
6 3/3, 3/5, 3/7 Transactions and schedules (cont.)
Midterm 1 on 3/3
Spring break
7 3/17, 3/19, 3/21 Concurrency control
Problem Set 2, part II due on 3/20 (Thursday)
8 3/24, 3/26, 3/28 Concurrency control (cont.)
9 3/31, 4/2, 4/4 Distributed databases and replication
Map-reduce
4/4: last day to drop with a 'W' or
change to Pass/Fail
Problem Set 3 (all) due on 4/1
10 4/7, 4/9, 4/11 Map-reduce (cont.)
NoSQL
Problem Set 4, part I due on 4/8
11 4/14, 4/16, 4/18 NoSQL (cont.)
Recovery and logging
Midterm 2 on 4/16
12 4/23, 4/25 Recovery and logging (cont.)
No lecture on 4/21 (Patriots Day)
Problem Set 4, part II due on 4/22
13 4/28, 4/30 Two-phase commit; wrap-up and review
Problem Set 5 (all) due on 4/29
5/2-4: Study period
CAS CS 460: Introduction to Database Systems Syllabus, Spring 2025
page 5 of 5
14 Final exam: date and time TBD
Please wait until your instructor informs you
of the date before you make any travel plans.
Make sure that you are available for the
entire exam period – up to and including
Friday evening, May 9!`);
    
    // Wait for the syllabus to be processed
    // This might take some time depending on your application
    cy.contains('Parse Syllabus', { timeout: 5000 }).click();
    
    // Wait for the results to load
    cy.contains('Extracted Information', { timeout: 30000 }).should('be.visible');
    
    // Click "Add to Calendar" button
    cy.contains('Add to Calendar').click();
    
    // Verify we're back to the syllabus parser page
    cy.url().should('include', '/syllabusParser');
    
    // Take a screenshot for verification
    cy.screenshot('syllabus-parser-success');
    
    // Optionally navigate to calendar to verify events were added
    cy.get('[data-testid="header-nav-calendar"]').click();
    cy.url().should('include', '/calendar');
    
    // Verify we can see the calendar with events
    cy.get('[data-testid="calendar-container"]').should('be.visible');
  });
});
