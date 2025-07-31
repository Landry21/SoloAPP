import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireProfessional = false }) => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    isProfessional, 
    isProfileComplete, 
    loading, 
    error, 
    profileData: currentProfileData
  } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireProfessional && !isProfessional) {
    console.log('ProtectedRoute: Not a professional, redirecting to search');
    return <Navigate to="/search" replace />;
  }

  if (isProfessional && !isProfileComplete && location.pathname !== '/complete-barber-profile') {
    console.log('ProtectedRoute: Profile incomplete, redirecting to complete profile');
    console.log('ProtectedRoute: Passing profile data:', currentProfileData);
    return (
      <Navigate 
        to="/complete-barber-profile" 
        state={{ profileData: currentProfileData }} 
        replace 
      />
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">{error}</div>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute; 