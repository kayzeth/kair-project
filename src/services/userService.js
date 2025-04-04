import { jwtDecode } from 'jwt-decode';

/**
 * Retrieves the current logged in user's ID from Kairos authentication
 * @returns {string|null} User ID if logged in, null otherwise
 */
export const getCurrentUserId = () => {
  try {
    // First check if user data is stored directly in localStorage
    const userData = localStorage.getItem('userData');
    console.log('User data:', userData);
    if (userData) {
      const user = JSON.parse(userData);
      if (user && user.id) {
        return user.id;
      }
    }
    
    // If no user data found, try to get it from the JWT token
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    console.log('Auth token:', token);
    if (token) {
      const decoded = jwtDecode(token);
      console.log('Decoded token:', decoded);
      return decoded.userId || decoded.sub || decoded.id || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving Kairos user ID:', error);
    return null;
  }
};

/**
 * Retrieves the current user's data from localStorage or JWT token
 * @returns {Object|null} User data object or null if not logged in
 */
export const getCurrentUser = () => {
  try {
    // First check if user data is stored directly in localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData);
    }
    
    // If no user data in localStorage, try to extract basic info from token
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      const decoded = jwtDecode(token);
      return {
        id: decoded.userId || decoded.sub || decoded.id,
        email: decoded.email,
        name: decoded.name
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving user data:', error);
    return null;
  }
};
