import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('userData');
    
    if (storedToken) {
      setAuthToken(storedToken);
      setIsLoggedIn(true);
    }
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (userData, token) => {
    setIsLoggedIn(true);
    
    if (userData) {
      setUser(userData);
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    if (token) {
      setAuthToken(token);
      localStorage.setItem('authToken', token);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      user, 
      authToken, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
