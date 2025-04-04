import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm, SignupForm } from '../AuthForms';
import * as authService from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

// Mock the react-router-dom module
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('../../__mocks__/react-router-dom')
}));

// Mock the authService module
jest.mock('../../services/authService', () => ({
  login: jest.fn(),
  register: jest.fn()
}));

// Mock the AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

describe('LoginForm', () => {
  const mockLogin = jest.fn();
  const mockNavigate = jest.fn();
  
  beforeEach(() => {
    // Setup mocks
    useAuth.mockReturnValue({ login: mockLogin });
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);
    
    // Reset mock function calls
    jest.clearAllMocks();
  });

  test('renders login form correctly', () => {
    // Render the component
    render(<LoginForm />);
    
    // Assert that form elements are present
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('submits form with correct data and handles successful login', async () => {
    // Mock successful login response
    const mockUser = { id: 'user123', name: 'Test User', email: 'test@example.com' };
    const mockToken = 'test-token-123';
    const mockResponse = { user: mockUser, token: mockToken };
    authService.login.mockResolvedValue(mockResponse);
    
    // Render the component
    render(<LoginForm />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // Assert that the login service was called with correct data
    expect(authService.login).toHaveBeenCalledWith({ 
      email: 'test@example.com', 
      password: 'password123' 
    });
    
    // Wait for the async operations to complete
    await waitFor(() => {
      // Assert that context login was called with correct data
      expect(mockLogin).toHaveBeenCalledWith(mockUser, mockToken);
      
      // Assert that navigation happened
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  test('displays error message on login failure', async () => {
    // Mock login failure
    const errorMessage = 'Invalid credentials';
    authService.login.mockRejectedValue(new Error(errorMessage));
    
    // Render the component
    render(<LoginForm />);
    
    // Fill out and submit the form
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    
    // Assert that navigation did not happen
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('SignupForm', () => {
  const mockLogin = jest.fn();
  const mockNavigate = jest.fn();
  
  beforeEach(() => {
    // Setup mocks
    useAuth.mockReturnValue({ login: mockLogin });
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(mockNavigate);
    
    // Reset mock function calls
    jest.clearAllMocks();
  });

  test('renders signup form correctly', () => {
    // Render the component
    render(<SignupForm />);
    
    // Assert that form elements are present
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  test('submits form with correct data and handles successful registration', async () => {
    // Mock successful registration and login responses
    const mockUser = { id: 'user123', name: 'Test User', email: 'test@example.com' };
    const mockToken = 'test-token-123';
    const mockLoginResponse = { user: mockUser, token: mockToken };
    
    authService.register.mockResolvedValue({ message: 'User created successfully' });
    authService.login.mockResolvedValue(mockLoginResponse);
    
    // Render the component
    render(<SignupForm />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    
    // Assert that the register service was called with correct data
    expect(authService.register).toHaveBeenCalledWith({ 
      name: 'Test User',
      email: 'test@example.com', 
      password: 'password123' 
    });
    
    // Wait for the async operations to complete
    await waitFor(() => {
      // Assert that login was called after registration
      expect(authService.login).toHaveBeenCalledWith({ 
        email: 'test@example.com', 
        password: 'password123' 
      });
      
      // Assert that context login was called with correct data
      expect(mockLogin).toHaveBeenCalledWith(mockUser, mockToken);
      
      // Assert that navigation happened
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  test('displays error message on registration failure', async () => {
    // Mock registration failure
    const errorMessage = 'User already exists';
    authService.register.mockRejectedValue(new Error(errorMessage));
    
    // Render the component
    render(<SignupForm />);
    
    // Fill out and submit the form
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'existing@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    
    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    
    // Assert that login and navigation did not happen
    expect(authService.login).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
