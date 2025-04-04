import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  useLocation: () => ({ pathname: '/calendar' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...rest }) => (
    <a href={to} data-testid="mock-link" {...rest}>
      {children}
    </a>
  )
}));

// Mock AuthContext
jest.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    isLoggedIn: true,
    logout: () => mockNavigate('/')
  })
}));

import Header from '../Header';

describe('Header Component', () => {
  const mockTitle = 'Kairos Calendar';
  const mockOnAddEvent = jest.fn();

  beforeEach(() => {
    mockOnAddEvent.mockClear();
    mockNavigate.mockClear();
  });

  test('renders the logo or icon if provided', () => {
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
    
    const header = screen.getByTestId('header');
    expect(header).toHaveClass('header');
  });

  test('renders navigation links when not on landing page', () => {
    render(
      <Header 
        title={mockTitle} 
        onAddEvent={mockOnAddEvent} 
      />
    );

    // Check all navigation elements are present
    expect(screen.getByTestId('header-logo')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toBeInTheDocument();
    expect(screen.getByTestId('header-nav-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('header-nav-syllabus')).toBeInTheDocument();
    expect(screen.getByTestId('header-nav-account')).toBeInTheDocument();
    expect(screen.getByTestId('header-nav-logout')).toBeInTheDocument();
  });

  test('logout button works correctly', () => {
    render(
      <Header 
        title={mockTitle} 
        onAddEvent={mockOnAddEvent} 
      />
    );

    const logoutButton = screen.getByTestId('header-nav-logout');
    fireEvent.click(logoutButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
