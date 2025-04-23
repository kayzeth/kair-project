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

// Mock FontAwesome icons
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <div data-testid="mock-icon" />
}));

import Header from '../Header';

describe('Header Component', () => {
  const mockActiveTab = 'calendar';
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    mockOnTabChange.mockClear();
    mockNavigate.mockClear();
  });

  test('renders the logo and title', () => {
    render(
      <Header 
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
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
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
      />
    );
    
    const header = screen.getByTestId('header');
    expect(header).toHaveClass('sidebar');
    expect(header.querySelector('.sidebar-content')).toBeInTheDocument();
    expect(header.querySelector('.logo-container')).toBeInTheDocument();
  });

  test('renders navigation links when not on landing page', () => {
    render(
      <Header 
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
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

  test('handles tab changes correctly', () => {
    render(
      <Header 
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
      />
    );

    // Click the account tab
    const accountTab = screen.getByTestId('header-nav-account');
    fireEvent.click(accountTab);
    expect(mockOnTabChange).toHaveBeenCalledWith('account');
  });

  test('logout button works correctly', () => {
    render(
      <Header 
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
      />
    );

    const logoutButton = screen.getByTestId('header-nav-logout');
    fireEvent.click(logoutButton);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('does not render navigation on onboarding page', () => {
    // Mock location to be onboarding page
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/onboarding' });

    render(
      <Header 
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
      />
    );

    // Logo should still be visible
    expect(screen.getByTestId('header-logo')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toBeInTheDocument();

    // Navigation should not be visible
    expect(screen.queryByTestId('header-nav-calendar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-nav-syllabus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-nav-account')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-nav-logout')).not.toBeInTheDocument();
  });

  test('does not render anything on landing page', () => {
    // Mock location to be landing page
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ pathname: '/' });

    render(
      <Header 
        activeTab={mockActiveTab}
        onTabChange={mockOnTabChange}
      />
    );

    // Nothing should be rendered
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
  });
});
