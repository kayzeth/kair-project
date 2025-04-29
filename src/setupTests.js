// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Set up a minimal browser-like environment for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock for matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock for Safari detection
// First delete the existing property if it exists
if (Object.getOwnPropertyDescriptor(window.navigator, 'userAgent')) {
  delete Object.getOwnPropertyDescriptor(window.navigator, 'userAgent').value;
}

// Then define a new configurable property
Object.defineProperty(window.navigator, 'userAgent', {
  value: '',
  writable: true,
  configurable: true
});

// Suppress console errors during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    args[0]?.includes('Warning:') ||
    args[0]?.includes('React does not recognize the') ||
    args[0]?.includes('Invalid DOM property')
  ) {
    return;
  }
  originalConsoleError(...args);
};