import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Landing from '../Landing';

// Mock the AuthForms components before importing them
jest.mock('../AuthForms', () => ({
  LoginForm: jest.fn(() => <div data-testid="login-form">Login Form</div>),
  SignupForm: jest.fn(() => <div data-testid="signup-form">Signup Form</div>)
}));

// Import the mocked components
import { LoginForm, SignupForm } from '../AuthForms';

// Mock for react-router-dom as per project memory
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: '/' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

describe('Landing Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('renders the landing page with logo, title and tagline', () => {
    render(<Landing />);
    
    // Check for logo
    const logoElement = screen.getByTestId('landing-logo');
    expect(logoElement).toBeInTheDocument();
    expect(logoElement).toHaveClass('landing-logo');
    expect(logoElement).toHaveAttribute('alt', 'Kairos Logo');
    
    // Check for title
    const titleElement = screen.getByTestId('landing-title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent('Welcome to Kairos');
    
    // Check for tagline
    const taglineElement = screen.getByTestId('landing-tagline');
    expect(taglineElement).toBeInTheDocument();
    expect(taglineElement).toHaveTextContent('Your intelligent academic calendar assistant');
  });

  test('initially displays login form and login heading', () => {
    // Clear mock call counts before this test
    LoginForm.mockClear();
    SignupForm.mockClear();
    
    render(<Landing />);
    
    // Check for login heading
    const headingElement = screen.getByTestId('auth-heading');
    expect(headingElement).toBeInTheDocument();
    expect(headingElement).toHaveTextContent('Log In');
    
    // Check that LoginForm is called
    expect(LoginForm).toHaveBeenCalled();
    
    // Check that SignupForm is not called
    expect(SignupForm).not.toHaveBeenCalled();
    
    // Check for the signup button which should be present in login mode
    const signupButton = screen.getByTestId('signup-button');
    expect(signupButton).toBeInTheDocument();
    expect(signupButton).toHaveTextContent('Sign up');
  });

  test('displays "Don\'t have an account?" text and sign up button when in login mode', () => {
    render(<Landing />);
    
    // Check for toggle text
    const toggleText = screen.getByTestId('auth-toggle-text');
    expect(toggleText).toBeInTheDocument();
    expect(toggleText).toHaveTextContent(/Don't have an account\?/i);
    
    // Check for sign up button
    const signUpButton = screen.getByTestId('signup-button');
    expect(signUpButton).toBeInTheDocument();
    expect(signUpButton).toHaveTextContent('Sign up');
  });

  test('switches to signup form when "Sign up" button is clicked', () => {
    // Clear mock call counts before this test
    LoginForm.mockClear();
    SignupForm.mockClear();
    
    render(<Landing />);
    
    // Find and click the sign up button
    const signUpButton = screen.getByTestId('signup-button');
    fireEvent.click(signUpButton);
    
    // Check that heading changed
    const headingElement = screen.getByTestId('auth-heading');
    expect(headingElement).toBeInTheDocument();
    expect(headingElement).toHaveTextContent('Sign Up');
    
    // Check that SignupForm is called
    expect(SignupForm).toHaveBeenCalled();
    
    // Check for the login button which should be present in signup mode
    const loginButton = screen.getByTestId('login-button');
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveTextContent('Log in');
  });

  test('displays "Already have an account?" text and login button when in signup mode', () => {
    render(<Landing />);
    
    // Switch to signup mode
    const signUpButton = screen.getByTestId('signup-button');
    fireEvent.click(signUpButton);
    
    // Check for toggle text
    const toggleText = screen.getByTestId('auth-toggle-text');
    expect(toggleText).toBeInTheDocument();
    expect(toggleText).toHaveTextContent(/Already have an account\?/i);
    
    // Check for login button
    const loginButton = screen.getByTestId('login-button');
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveTextContent('Log in');
  });

  test('switches back to login form when "Log in" button is clicked', () => {
    // Clear mock call counts before this test
    LoginForm.mockClear();
    SignupForm.mockClear();
    
    render(<Landing />);
    
    // Verify LoginForm is initially called
    expect(LoginForm).toHaveBeenCalled();
    
    // First switch to signup
    const signUpButton = screen.getByTestId('signup-button');
    fireEvent.click(signUpButton);
    
    // Check that heading changed to Sign Up
    const signupHeading = screen.getByTestId('auth-heading');
    expect(signupHeading).toHaveTextContent('Sign Up');
    
    // Verify SignupForm is called
    expect(SignupForm).toHaveBeenCalled();
    
    // Then switch back to login
    const loginButton = screen.getByTestId('login-button');
    fireEvent.click(loginButton);
    
    // Check that heading changed back to Log In
    const loginHeading = screen.getByTestId('auth-heading');
    expect(loginHeading).toHaveTextContent('Log In');
    
    // We don't check exact call counts since rerenders might cause multiple calls
    // Instead, we verify the components were called and the UI state is correct
  });

  test('has the correct structure and CSS classes', () => {
    render(<Landing />);
    
    // Check for main container
    const landingContainer = screen.getByTestId('landing-container');
    expect(landingContainer).toBeInTheDocument();
    expect(landingContainer).toHaveClass('landing-container');
    
    // Check for content container
    const landingContent = screen.getByTestId('landing-content');
    expect(landingContent).toBeInTheDocument();
    expect(landingContent).toHaveClass('landing-content');
    
    // Check for logo container
    const logoContainer = screen.getByTestId('landing-logo-container');
    expect(logoContainer).toBeInTheDocument();
    expect(logoContainer).toHaveClass('landing-logo-container');
    
    // Check for auth section
    const authSection = screen.getByTestId('auth-section');
    expect(authSection).toBeInTheDocument();
    expect(authSection).toHaveClass('auth-section');
    
    // Check for auth container
    const authContainer = screen.getByTestId('auth-container');
    expect(authContainer).toBeInTheDocument();
    expect(authContainer).toHaveClass('auth-container');
    
    // Check for auth toggle
    const authToggle = screen.getByTestId('auth-toggle');
    expect(authToggle).toBeInTheDocument();
    expect(authToggle).toHaveClass('auth-toggle');
  });
});
