import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoadingSpinner from '../LoadingSpinner';

// Mock for react-router-dom as per project memory
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: '/' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

describe('LoadingSpinner Component', () => {
  test('renders correctly', () => {
    render(<LoadingSpinner />);
    
    // Check that the loading spinner container is rendered
    const spinnerContainer = screen.getByTestId('loading-spinner');
    expect(spinnerContainer).toBeInTheDocument();
    expect(spinnerContainer).toHaveClass('loading-spinner');
    
    // Check that the spinner element is rendered
    const spinnerElement = spinnerContainer.querySelector('.spinner');
    expect(spinnerElement).toBeInTheDocument();
  });

  test('has the correct structure', () => {
    const { container } = render(<LoadingSpinner />);
    
    // Check the DOM structure
    expect(container.firstChild).toHaveClass('loading-spinner');
    expect(container.firstChild.firstChild).toHaveClass('spinner');
  });

  test('matches snapshot', () => {
    const { asFragment } = render(<LoadingSpinner />);
    expect(asFragment()).toMatchSnapshot();
  });
});
