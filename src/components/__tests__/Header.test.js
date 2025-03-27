import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-router-dom before importing Header
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }) => (
    <a href={to} data-testid="mock-link" {...rest}>
      {children}
    </a>
  )
}));

import Header from '../Header';

describe('Header Component', () => {
  const mockTitle = 'Kairos Calendar';
  const mockOnAddEvent = jest.fn();

  beforeEach(() => {
    mockOnAddEvent.mockClear();
  });

  test('renders the logo or icon if provided', () => {
    // This test depends on the actual implementation
    // If the Header component includes a logo or icon, test for its presence
    render(
      <Header 
        title={mockTitle} 
        onAddEvent={mockOnAddEvent} 
      />
    );
    
    // Check for a logo element using testId
    const logoElement = screen.getByTestId('header-logo');
    expect(logoElement).toBeInTheDocument();
    
    // Check for the header title
    const titleElement = screen.getByTestId('header-title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent('Kairos');
  });

  test('has the correct styling and layout', () => {
    render(
      <Header 
        title={mockTitle} 
        onAddEvent={mockOnAddEvent} 
      />
    );
    
    // Check if the header has the expected class
    const headerElement = screen.getByTestId('header');
    expect(headerElement).toHaveClass('header');
  });

  test('renders all navigation links correctly', () => {
    render(
      <Header 
        title={mockTitle} 
        onAddEvent={mockOnAddEvent} 
      />
    );
    
    // Check if all navigation links are present
    const calendarLink = screen.getByTestId('header-nav-calendar');
    const syllabusLink = screen.getByTestId('header-nav-syllabus');
    const accountLink = screen.getByTestId('header-nav-account');
    
    expect(calendarLink).toBeInTheDocument();
    expect(syllabusLink).toBeInTheDocument();
    expect(accountLink).toBeInTheDocument();
    
    // Check text content of links
    expect(calendarLink).toHaveTextContent('Calendar');
    expect(syllabusLink).toHaveTextContent('Syllabus Parser');
    expect(accountLink).toHaveTextContent('Account');
  });
});
