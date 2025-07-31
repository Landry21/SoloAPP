// Environment-based configuration
const config = {
  development: {
    API_BASE_URL: 'http://localhost:8000/api',
    MEDIA_BASE_URL: 'http://localhost:8000',
  },
  production: {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'https://your-domain.com/api',
    MEDIA_BASE_URL: process.env.REACT_APP_MEDIA_BASE_URL || 'https://your-domain.com',
  }
};

const environment = process.env.NODE_ENV || 'development';
const currentConfig = config[environment] || config.development;

export const API_BASE_URL = currentConfig.API_BASE_URL;
export const MEDIA_BASE_URL = currentConfig.MEDIA_BASE_URL;

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function to get full media URL
export const getMediaUrl = (path) => {
  if (!path) return null;
  return path.startsWith('http') ? path : `${MEDIA_BASE_URL}${path}`;
}; 