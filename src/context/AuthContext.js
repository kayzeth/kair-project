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
    
    if (storedToken && storedUser) {
      setAuthToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsLoggedIn(true);
      console.log('Auth initialized:', { storedToken, storedUser });
    }
  }, []);

  const login = (userData, token) => {
    setIsLoggedIn(true);
    setUser(userData);
    setAuthToken(token);
    
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    if (token) {
      localStorage.setItem('authToken', token);
    }

    console.log('Login:', { userData, token });
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    console.log('Logout');
  };

  const value = {
    isLoggedIn,
    user,
    authToken,
    login,
    logout
  };

  console.log('Auth context value:', value);

  return (
    <AuthContext.Provider value={value}>
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
