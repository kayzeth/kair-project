import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoginForm, SignupForm } from '../AuthForms';
import * as authService from '../../services/authService';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

// Mock AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock authService
jest.mock('../../services/authService', () => ({
  login: jest.fn(),
  register: jest.fn(),
}));

describe('LoginForm', () => {
  const mockNavigate = jest.fn();
  const mockLogin = jest.fn();
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    useNavigate.mockReturnValue(mockNavigate);
    useAuth.mockReturnValue({ login: mockLogin });
    
    // Mock localStorage
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn()
    };
    global.localStorage = mockLocalStorage;
  });

  it('navigates to /onboarding for first-time users', async () => {
    // Mock successful login response
    const mockUser = { id: '123', email: 'test@example.com' };
    authService.login.mockResolvedValue({ user: mockUser, token: 'token123' });
    
    // Mock localStorage to indicate onboarding is not complete
    localStorage.getItem.mockReturnValue(null);

    render(<LoginForm />);

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(mockUser, 'token123');
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('navigates to /calendar for returning users who completed onboarding', async () => {
    // Mock successful login response
    const mockUser = { id: '123', email: 'test@example.com' };
    authService.login.mockResolvedValue({ user: mockUser, token: 'token123' });
    
    // Mock localStorage to indicate onboarding is complete
    localStorage.getItem.mockReturnValue('true');

    render(<LoginForm />);

    // Fill in the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(mockUser, 'token123');
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  it('displays error message on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    authService.login.mockRejectedValue(new Error(errorMessage));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});

describe('SignupForm', () => {
  const mockNavigate = jest.fn();
  const mockLogin = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    useNavigate.mockReturnValue(mockNavigate);
    useAuth.mockReturnValue({ login: mockLogin });
  });

  it('registers user and navigates to /onboarding', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    authService.register.mockResolvedValue({ success: true });
    authService.login.mockResolvedValue({ user: mockUser, token: 'token123' });

    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockLogin).toHaveBeenCalledWith(mockUser, 'token123');
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('displays error message on registration failure', async () => {
    const errorMessage = 'Email already exists';
    authService.register.mockRejectedValue(new Error(errorMessage));

    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
