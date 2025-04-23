import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, isInitialized } = useAuth();

  // Show loading spinner while auth state is initializing
  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  // Only redirect if we're sure user isn't authenticated
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
