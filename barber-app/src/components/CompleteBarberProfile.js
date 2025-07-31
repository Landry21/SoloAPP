import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { barbers, handleApiError, auth } from '../services/api';
import '../styles/CreateBarberProfile.css';

// ServiceItem Component - Moved outside main component
const ServiceItem = ({ service, onRemove, onChange, showRemove }) => {
  if (!service) return null;
  
  return (
    <div className="service-item">
      <div className="service-inputs">
        <div className="service-name-field">
          <input
            type="text"
            value={service.name || ''}
            onChange={(e) => onChange(service.id, 'name', e.target.value)}
            placeholder="Service name (e.g., Haircut, Beard Trim)"
            required
          />
        </div>
        <div className="service-price-field">
          <span className="currency">$</span>
          <input
            type="number"
            value={service.price_adjustment || ''}
            onChange={(e) => onChange(service.id, 'price_adjustment', e.target.value)}
            placeholder="Price"
            min="0"
            required
          />
        </div>
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(service.id)}
            className="remove-service-btn"
            aria-label="Remove service"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="remove-icon">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

const CompleteBarberProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profileData, fetchProfileData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Debug logging for auth state
  useEffect(() => {
    console.log('=== CompleteBarberProfile Auth State ===');
    console.log('User from auth context:', user);
    console.log('Token from localStorage:', localStorage.getItem('token'));
    console.log('User data from localStorage:', localStorage.getItem('user'));
  }, [user]);
  
  // Initialize availability with default values
  const defaultAvailability = {
    monday: { start: '09:00', end: '17:00', isSelected: false },
    tuesday: { start: '09:00', end: '17:00', isSelected: false },
    wednesday: { start: '09:00', end: '17:00', isSelected: false },
    thursday: { start: '09:00', end: '17:00', isSelected: false },
    friday: { start: '09:00', end: '17:00', isSelected: false },
    saturday: { start: '09:00', end: '17:00', isSelected: false },
    sunday: { start: '09:00', end: '17:00', isSelected: false }
  };

  // Check for token on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setError('Please log in to complete your profile');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
      return;
    }
  }, [navigate]);

  // Check if we're in edit mode
  useEffect(() => {
    console.log('=== CompleteBarberProfile Debug ===');
    console.log('Location state:', location.state);
    console.log('Profile data from navigation:', location.state?.profileData);
    
    if (location.state?.isEditing && location.state?.profileData) {
        setIsEditing(true);
        console.log('Edit mode activated with profile data:', location.state.profileData);
        
        // Initialize form data with the passed profile data
        setFormData({
            profilePhoto: null,
            yearsOfExperience: location.state.profileData?.properties?.years_of_experience || '',
            location: location.state.profileData?.properties?.formatted_address || '',
            latitude: location.state.profileData?.geometry?.coordinates?.[1] || null,
            longitude: location.state.profileData?.geometry?.coordinates?.[0] || null,
            services: location.state.profileData?.properties?.services || [],
            availability: location.state.profileData?.properties?.working_hours || defaultAvailability
        });
    }
  }, [location.state]);

  // Form state initialization
  const [formData, setFormData] = useState({
    profilePhoto: null,
    yearsOfExperience: '',
    location: '',
    latitude: null,
    longitude: null,
    services: [],
    availability: defaultAvailability
  });

  // Add logging for form data initialization
  useEffect(() => {
    console.log('Form data initialized:', {
        isEditing,
        formData,
        existingProfile: profileData,
        profileProperties: profileData?.properties
    });
  }, [formData, isEditing, profileData]);

  // Debug logging for services
  useEffect(() => {
    console.log('Services state:', formData.services);
  }, [formData.services]);

  // Debug logging for availability
  useEffect(() => {
    console.log('Availability state:', formData.availability);
  }, [formData.availability]);

  // Initialize services with one empty service
  useEffect(() => {
    console.log('Initializing services...');
    if (!Array.isArray(formData.services) || formData.services.length === 0) {
      console.log('Adding initial service');
      setFormData(prev => ({
        ...prev,
        services: [{
          id: '1',
          name: '',
          price_adjustment: ''
        }]
      }));
    }
  }, []);

  // Calculate price range from services
  const calculatePriceRange = (services) => {
    if (!services?.length || !services[0]?.price_adjustment) return { min: 0, max: 0 };
    const prices = services
      .map(service => parseFloat(service.price_adjustment))
      .filter(price => !isNaN(price) && price > 0);
    if (!prices.length) return { min: 0, max: 0 };
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  };

  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });

  // Update price range when services change
  useEffect(() => {
    setPriceRange(calculatePriceRange(formData.services));
  }, [formData.services]);

  // Add debounce function
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Update the searchLocation function
  const searchLocation = async (query) => {
    if (!query.trim()) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Fetching locations for query:', query);
      // Add headers to prevent CORS issues
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'BarberApp/1.0'
          }
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received location data:', data);
      setLocationSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setLocationSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced version of searchLocation
  const debouncedSearchLocation = debounce(searchLocation, 300);

  // Update the formatAddress function with debug log
  const formatAddress = (suggestion) => {
    console.log('Formatting address for suggestion:', suggestion);
    const address = {
      street: suggestion.address?.road || suggestion.address?.street || '',
      houseNumber: suggestion.address?.house_number || '',
      city: suggestion.address?.city || suggestion.address?.town || suggestion.address?.village || '',
      state: suggestion.address?.state || '',
      postcode: suggestion.address?.postcode || ''
    };

    const streetAddress = [address.houseNumber, address.street].filter(Boolean).join(' ');
    const formattedAddress = [streetAddress, address.city, address.state, address.postcode]
      .filter(Boolean)
      .join(', ');

    console.log('Formatted address:', formattedAddress);
    return formattedAddress;
  };

  // Update the handleLocationSelect function
  const handleLocationSelect = (location) => {
    const formattedAddress = formatAddress(location);
    setFormData(prev => ({
      ...prev,
      location: formattedAddress,
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon)
    }));
    setShowSuggestions(false);
  };

  // Modify the handleChange function for location
  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      if (name === 'profilePhoto') {
        const file = files[0];
        setFormData(prev => ({ ...prev, [name]: file }));
        
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result);
          };
          reader.readAsDataURL(file);
        } else {
          setImagePreview(null);
        }
      }
    } else if (name.startsWith('availability.')) {
      const parts = name.split('.');
      const day = parts[1];
      const field = parts[2];
      setFormData(prev => ({
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            [field]: value
          }
        }
      }));
    } else if (name === 'location') {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (value.length >= 3) { // Only search if there are at least 3 characters
        console.log('Triggering location search for:', value);
        debouncedSearchLocation(value);
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle day selection for availability
  const handleDaySelect = (day) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          isSelected: !prev.availability[day].isSelected
        }
      }
    }));
  };

  // Handle service changes
  const handleServiceChange = (serviceId, field, value) => {
    setFormData(prev => ({
      ...prev,
      services: Array.isArray(prev.services) 
        ? prev.services.map(service =>
            service.id === serviceId
              ? { 
                  ...service, 
                  [field]: field === 'price_adjustment' 
                    ? value === '' ? '' : parseFloat(value) || ''
                    : value 
                }
              : service
          )
        : []
    }));
  };

  // Add new service
  const addService = () => {
    setFormData(prev => ({
      ...prev,
      services: Array.isArray(prev.services) 
        ? [...prev.services, {
            id: String(Date.now()),
            name: '',
            price_adjustment: ''
          }]
        : [{
            id: String(Date.now()),
            name: '',
            price_adjustment: ''
          }]
    }));
  };

  // Remove service
  const removeService = (serviceId) => {
    setFormData(prev => {
      const currentServices = Array.isArray(prev.services) ? prev.services : [];
      if (currentServices.length <= 1) return prev;
      
      return {
        ...prev,
        services: currentServices.filter(service => service.id !== serviceId)
      };
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // CHANGED: Validate location fields before submission
    if (!formData.location || formData.latitude === null || formData.longitude === null) {
      setError('Please select a valid business address from the suggestions so latitude and longitude are set.');
      setIsLoading(false);
      return;
    }

    try {
      // Debug logging before submission
      console.log('=== Form Submission Debug ===');
      console.log('Current user:', user);
      console.log('Auth token:', localStorage.getItem('token'));
      console.log('Stored user data:', localStorage.getItem('user'));

      // Validate required fields
      if (!formData.yearsOfExperience) {
        setError('Years of experience is required');
        setIsLoading(false);
        return;
      }

      if (!user?.user_id) {
        console.error('User ID missing. Auth state:', {
          user,
          token: localStorage.getItem('token'),
          storedUser: localStorage.getItem('user')
        });
        setError('User ID is missing. Please log in again.');
        setIsLoading(false);
        navigate('/login', { replace: true });
        return;
      }

      // Prepare the data in the format expected by the backend
      const formDataToSend = new FormData();
      formDataToSend.append('years_of_experience', formData.yearsOfExperience);
      formDataToSend.append('latitude', formData.latitude);
      formDataToSend.append('longitude', formData.longitude);
      formDataToSend.append('address', formData.location);
      
      // Add services
      formDataToSend.append('services', JSON.stringify(formData.services));

      // Add working hours
      const workingHoursArray = Object.entries(formData.availability).map(([day, hours]) => ({
        day: day,
        start_time: hours.start,
        end_time: hours.end,
        is_working: hours.isSelected
      }));
      formDataToSend.append('working_hours', JSON.stringify(workingHoursArray));

      // Add profile photo if it exists
      if (formData.profilePhoto) {
        formDataToSend.append('profile_image', formData.profilePhoto);
      }

      console.log('Submitting profile data:', Object.fromEntries(formDataToSend));
      
      // POST to the correct endpoint
      const response = await auth.createBarberProfile(formDataToSend);
      if (response.status === 200 || response.status === 201) {
        const professionalId = response.data.id || response.data.professional_id;
        localStorage.setItem('professionalId', professionalId);
          setSuccess('Profile completed successfully!');
        // Navigate to dashboard using professionalId
        navigate(`/barber-dashboard/${professionalId}`);
      }

      // Log FormData before submission
      for (let pair of formDataToSend.entries()) {
        console.log(pair[0]+ ': ' + pair[1]);
      }
    } catch (err) {
      console.error('Profile submission error:', err);
      const { message } = handleApiError(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Render availability section
  const renderAvailability = () => {
    if (!formData.availability) return null;
    
    return Object.entries(formData.availability).map(([day, hours]) => (
      <div key={`availability-${day}`} className="day-row">
        <div className="day-label">
          <span className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
        </div>
        <div className="hours-config">
          <label className="closed-toggle">
            <input
              type="checkbox"
              checked={!hours.isSelected}
              onChange={() => handleDaySelect(day)}
            />
            <span className="toggle-label">Closed</span>
          </label>
          {hours.isSelected && (
            <div className="hours-input-group">
              <div className="time-input">
                <input
                  type="time"
                  name={`availability.${day}.start`}
                  value={hours?.start || '09:00'}
                  onChange={handleChange}
                  required={hours.isSelected}
                />
              </div>
              <span className="time-separator">to</span>
              <div className="time-input">
                <input
                  type="time"
                  name={`availability.${day}.end`}
                  value={hours?.end || '17:00'}
                  onChange={handleChange}
                  required={hours.isSelected}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    ));
  };

  // Simplified services section with debug
  const renderServices = () => {
    console.log('Rendering services section with:', formData.services);
    
    if (!Array.isArray(formData.services)) {
      console.error('Services is not an array:', formData.services);
      return null;
    }
    
    return (
      <div className="services-section">
        <h3 className="section-header">Your Services</h3>
        {formData.services.map((service, index) => (
          <ServiceItem
            key={service.id || index}
            service={service}
            onRemove={removeService}
            onChange={handleServiceChange}
            showRemove={formData.services.length > 1}
          />
        ))}
        <button
          type="button"
          onClick={addService}
          className="add-service-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="add-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Another Service
        </button>
      </div>
    );
  };

  // Render error message
  const renderError = () => {
    if (!error) return null;
    const errorString = typeof error === 'string' ? error :
                       typeof error === 'object' ? JSON.stringify(error) :
                       String(error);
    return <div className="error-message">{errorString}</div>;
  };

  // Render success message
  const renderSuccess = () => {
    if (!success) return null;
    const successString = typeof success === 'string' ? success : String(success);
    return <div className="success-message">{successString}</div>;
  };

  return (
    <div className="create-profile-container">
      <div className="create-profile-card">
        <h2>Complete Your Profile</h2>
        
        {renderError()}
        {renderSuccess()}
        
        <form onSubmit={handleSubmit}>
          <div className="profile-photo-container">
            <div className={`profile-photo-upload-wrapper ${imagePreview ? 'has-preview' : ''}`}>
              <input
                type="file"
                name="profilePhoto"
                onChange={handleChange}
                accept="image/*"
                className="profile-photo-upload"
              />
              <div className="profile-photo-upload-content">
                <svg xmlns="http://www.w3.org/2000/svg" className="profile-photo-upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="profile-photo-upload-text">Add Photo</span>
              </div>
              {imagePreview && (
                <div className="profile-preview">
                  <img src={imagePreview} alt="Profile preview" />
                </div>
              )}
            </div>
          </div>

          <div className="experience-price-container">
            <div className="experience-field">
              <h3 className="section-header">Years of Experience</h3>
              <input
                type="number"
                name="yearsOfExperience"
                value={formData.yearsOfExperience}
                onChange={handleChange}
                placeholder="0"
                min="0"
                required
              />
            </div>
            
            <div className="price-range-field">
              <h3 className="section-header">Price Range</h3>
              <div className="price-range-inputs">
                <div className="price-input-group">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    value={priceRange.min || ''}
                    readOnly
                    placeholder="Min"
                  />
                </div>
                <span className="price-separator">-</span>
                <div className="price-input-group">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    value={priceRange.max || ''}
                    readOnly
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="location-field">
            <h3 className="section-header">Business Address</h3>
            <div className="location-input-container" style={{ position: 'relative' }}>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter your full business address (e.g., 123 Main St, New York, NY 10001)"
                required
                autoComplete="off"
              />
              {isSearching && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  padding: '10px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '0 0 8px 8px',
                  textAlign: 'center'
                }}>
                  Searching...
                </div>
              )}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="location-suggestions" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '0 0 8px 8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {locationSuggestions.map((suggestion, index) => {
                    const formattedAddress = formatAddress(suggestion);
                    return formattedAddress ? (
                      <div
                        key={index}
                        onClick={() => handleLocationSelect(suggestion)}
                        style={{
                          padding: '10px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          fontSize: '14px'
                        }}
                        onMouseEnter={e => e.target.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={e => e.target.style.backgroundColor = 'white'}
                      >
                        {formattedAddress}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <p className="field-hint">Please provide your complete business address where clients can find you</p>
          </div>

          {renderServices()}

          <h3 className="section-header">Availability</h3>
          <div className="availability-section">
            {renderAvailability()}
          </div>

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Completing Profile...' : 'Complete Profile'}
          </button>
        </form>
      </div>
      <footer className="footer">
        <p>&copy; 2024 SoloApp</p>
      </footer>
    </div>
  );
};

export default CompleteBarberProfile; 