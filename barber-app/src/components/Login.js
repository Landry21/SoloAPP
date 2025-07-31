import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/login.css';
import { getBarberProfile } from '../services/api';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('=== LOGIN FLOW START ===');
      console.log('1. Attempting login with credentials:', { username: identifier });
      
      const loginResponse = await login({
        username: identifier,
        password: password
      });

      console.log('2. Login Response:', loginResponse);

      if (!loginResponse || typeof loginResponse !== 'object') {
        throw new Error('Invalid login response format');
      }

      if (!loginResponse.success) {
        // Use the original error if available, otherwise use the error message
        const errorToHandle = loginResponse.originalError || new Error(loginResponse.error);
        throw errorToHandle;
      }

      // If login is successful, let AuthContext handle the profile data
      // and just navigate based on the response
      if (loginResponse.isProfessional) {
        // Use setTimeout to ensure React has time to update the state
        setTimeout(() => {
          if (loginResponse.isProfileComplete) {
            // Profile is complete, go to dashboard
            navigate(`/barber-dashboard/${loginResponse.professionalId}`, { replace: true });
          } else {
            // Profile incomplete, go to complete profile
            navigate('/complete-barber-profile', { replace: true });
          }
        }, 200);
      } else {
        // Customer login, go to search
        setTimeout(() => {
          navigate('/search', { replace: true });
        }, 200);
      }

    } catch (error) {
      console.error('Login Error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      setError(getUserFriendlyError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get user-friendly error message
  const getUserFriendlyError = (error) => {
    // Log technical error for debugging
    console.error('Login Error Details:', error);

    // Check if it's a network error
    if (!error.response) {
      if (error.message.includes('Network Error')) {
        return "Unable to connect to the server. Please check your internet connection and try again.";
      }
      if (error.message.includes('timeout')) {
        return "The request is taking too long. Please check your connection and try again.";
      }
      return "Unable to reach the server. Please try again in a moment.";
    }

    // Handle different error status codes
    switch (error.response?.status) {
      case 400:
        // Check the actual error message from the backend
        const errorDetail = error.response?.data?.error || error.response?.data?.detail || '';
        
        if (errorDetail.includes('password')) {
          return "Please enter your password.";
        }
        if (errorDetail.includes('username')) {
          return "Please enter your email or username.";
        }
        if (errorDetail.includes('Both email/username and password are required')) {
          return "Please enter both your email/username and password.";
        }
        return "Please check your email and password, then try again.";
        
      case 401:
        // Check if it's a password error from the new backend
        const errorMessage = error.response?.data?.error || '';
        if (errorMessage.includes('Incorrect password')) {
          return "Incorrect password. Please check your password and try again.";
        }
        return "Incorrect email or password. Please check your credentials and try again.";
        
      case 403:
        return "Your account has been suspended. Please contact support for assistance.";
        
      case 404:
        // Check if it's an account not found error from the new backend
        const notFoundError = error.response?.data?.error || '';
        if (notFoundError.includes('Account not found')) {
          return "Account not found. Please check your email/username or create a new account.";
        }
        return "Account not found. Please check your email or create a new account.";
        
      case 429:
        return "Too many login attempts. Please wait a few minutes before trying again.";
        
      case 500:
        return "We're experiencing technical difficulties. Please try again in a few minutes.";
        
      case 502:
      case 503:
      case 504:
        return "Our servers are temporarily unavailable. Please try again later.";
        
      default:
        // Try to extract a meaningful message from the response
        const defaultErrorMessage = error.response?.data?.detail || 
                           error.response?.data?.message || 
                           error.response?.data?.error ||
                           error.message;
        
        if (defaultErrorMessage && defaultErrorMessage !== 'Request failed') {
          return defaultErrorMessage;
        }
        
        return "Something went wrong. Please try again.";
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Welcome to SoloApp</h2>
       
        {error && (
          <div className="error-message">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="error-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="login-form-group">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or Username"
              required
            />
          </div>
          
          <div className="login-form-group password-input-group">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          
          <button type="submit" className="sign-in-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          
          <button type="button" className="forgot-password-button">
            Forgot Password?
          </button>
          
          <div className="register-link">
                            <p>Don't have an account? <Link to="/register">Create a Profile</Link></p>
          </div>
        </form>
      </div>
      <footer className="footer">
        <p>&copy; 2024 SoloApp</p>
      </footer>
    </div>
  );
};

export default Login; 