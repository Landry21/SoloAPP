import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axiosInstance from '../utils/axiosConfig';
import { barbers, auth, workingHours, barberServices, handleApiError } from '../services/api';
import '../styles/SettingsParameters.css';
import '../styles/CreateBarberProfile.css';

// ServiceItem Component for the modal
const ServiceItem = ({ service, onRemove, onChange, showRemove }) => {
  if (!service) return null;
  
  return (
    <div className="modal-service-item">
      <div className="modal-service-inputs">
        <div className="modal-service-name-field">
          <input
            type="text"
            value={service.name || ''}
            onChange={(e) => onChange(service.id, 'name', e.target.value)}
            placeholder="Service name (e.g., Haircut, Beard Trim)"
            required
          />
        </div>
        <div className="modal-service-price-field">
          <span className="currency">$</span>
          <input
            type="number"
            value={service.price_adjustment || service.price || ''}
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
            className="modal-remove-service-btn"
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

// WorkingHoursItem Component for the modal
const WorkingHoursItem = ({ day, hours, onChange }) => {
  if (!hours) return null;

  return (
    <div className="day-row">
      <div className="day-label">
        <span className="day-name">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
        <label className="closed-toggle">
          <input
            type="checkbox"
            checked={!hours.isSelected}
            onChange={() => onChange(day, 'isSelected', !hours.isSelected)}
          />
          <span className="toggle-label">Closed</span>
        </label>
      </div>
      {hours.isSelected && (
        <div className="hours-config">
          <div className="hours-input-group">
            <div className="time-input">
              <input
                type="time"
                value={hours?.start || '09:00'}
                onChange={(e) => onChange(day, 'start', e.target.value)}
                required={hours.isSelected}
              />
            </div>
            <span className="time-separator">to</span>
            <div className="time-input">
              <input
                type="time"
                value={hours?.end || '17:00'}
                onChange={(e) => onChange(day, 'end', e.target.value)}
                required={hours.isSelected}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom Duration Picker Component - iPhone Style Rolling Wheel
const DurationPicker = ({ value, onChange, min = 1, max = 90 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(1);
  const [centerValue, setCenterValue] = useState(1);
  const [centerIndex, setCenterIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const wheelRef = useRef(null);
  const isScrollingRef = useRef(false);

  const createCircularOptions = () => {
    const options = [];
    for (let i = min; i <= max; i++) {
      options.push(i);
    }
    return options;
  };

  const circularOptions = createCircularOptions();
  const itemHeight = 40;

  const getDayLabel = (days) => {
    if (days === 7) return "7 (one week)";
    if (days === 14) return "14 (two weeks)";
    if (days === 21) return "21 (three weeks)";
    if (days === 28) return "28 (four weeks)";
    if (days === 30) return "30 (one month)";
    if (days === 60) return "60 (two months)";
    if (days === 90) return "90 (three months)";
    return `${days}`;
  };

  const handleSelect = (newValue) => {
    setSelectedValue(newValue);
    onChange(newValue);
    setIsOpen(false);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Update selected value when prop changes
  useEffect(() => {
    const initialValue = value || 1;
    setSelectedValue(initialValue);
    setCenterValue(initialValue);
  }, [value]);

  // Position the wheel to show the selected value in the center (mobile only)
  useEffect(() => {
    const isMobile = window.innerWidth <= 768; // Only auto-center on mobile devices
    
    if (isOpen && wheelRef.current && !isScrolling && !isScrollingRef.current && isMobile) {
      const valueToShow = selectedValue;
      const selectedIndex = circularOptions.findIndex(option => option === valueToShow);
      
      if (selectedIndex !== -1) {
        const containerHeight = wheelRef.current.clientHeight;
        const centerPosition = containerHeight / 2;
        const targetScroll = (selectedIndex * itemHeight) - centerPosition + (itemHeight / 2);
        
        setTimeout(() => {
          if (wheelRef.current && !isScrollingRef.current) {
            wheelRef.current.scrollTop = targetScroll;
            setCenterValue(valueToShow);
            setCenterIndex(selectedIndex);
          }
        }, 50);
      }
    }
  }, [isOpen, circularOptions, isScrolling]);

  // Add wheel event listener
  useEffect(() => {
    const wheelElement = wheelRef.current;
    if (wheelElement && isOpen) {
      const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!wheelRef.current) return;
        
        setIsScrolling(true);
        isScrollingRef.current = true;
        
        const delta = e.deltaY;
        const currentScroll = wheelRef.current.scrollTop;
        const scrollMultiplier = 3;
        const newScroll = currentScroll - (delta * scrollMultiplier);
        
        wheelRef.current.scrollTop = newScroll;
        
        const containerHeight = wheelRef.current.clientHeight;
        const centerPosition = containerHeight / 2;
        const centerY = newScroll + centerPosition;
        const itemIndex = Math.floor(centerY / itemHeight);
        const boundedIndex = Math.max(0, Math.min(itemIndex, circularOptions.length - 1));
        const centerValue = circularOptions[boundedIndex];
        
        if (centerValue !== undefined) {
          setSelectedValue(centerValue);
          setCenterValue(centerValue);
          setCenterIndex(boundedIndex);
          onChange(centerValue);
        }
        
        setTimeout(() => {
          setIsScrolling(false);
          isScrollingRef.current = false;
        }, 200);
      };

      wheelElement.addEventListener('wheel', handleWheel, { passive: false });
      
      return () => {
        wheelElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [isOpen, circularOptions, itemHeight, onChange]);

  // Close duration picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.duration-picker')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="duration-picker">
      <div 
        className={`duration-picker-display ${isOpen ? 'expanded' : ''}`}
        onClick={handleToggle}
      >
        {!isOpen ? (
          <span className="duration-value">
            {getDayLabel(selectedValue)}
          </span>
        ) : (
          <div className="duration-wheel">
            <div className="wheel-selection-indicator"></div>
            <div 
              ref={wheelRef}
              className="wheel-scroll-container"
              tabIndex={0}
            >
              <div className="wheel-spacer-top"></div>
              {circularOptions.map((option, index) => (
                <div
                  key={`${option}-${index}`}
                  className={`wheel-option ${index === centerIndex ? 'selected' : ''}`}
                  style={{ 
                    height: itemHeight,
                    lineHeight: `${itemHeight}px`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option);
                  }}
                >
                  {getDayLabel(option)}
                </div>
              ))}
              <div className="wheel-spacer-bottom"></div>
            </div>
          </div>
        )}
        <span className="duration-arrow">▼</span>
      </div>
    </div>
  );
};

const SettingsParameters = () => {
  const navigate = useNavigate();
  const { user, logout, profileData } = useAuth();
  const [activeSection, setActiveSection] = useState('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Account settings state
  const [accountSettings, setAccountSettings] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [originalAccountData, setOriginalAccountData] = useState({
    email: '',
    password: ''
  });
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [modalServices, setModalServices] = useState([]);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [modalAvailability, setModalAvailability] = useState({});
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseDuration, setPauseDuration] = useState(0); // Always start with 0
  const [pauseReason, setPauseReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Business settings state
  const [businessSettings, setBusinessSettings] = useState({
    address: '',
    services: [],
    workingHours: []
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: true,
    appointmentReminders: true,
    newBookingAlerts: true,
    reviewNotifications: true
  });

  // Load user data on component mount
  useEffect(() => {
    if (profileData) {
      const userDetails = profileData.properties?.user_details || {};
      const properties = profileData.properties || {};
      
      const email = userDetails.email || '';
      setAccountSettings({
        email: email,
        password: '••••••••', // Masked password display
        confirmPassword: ''
      });
      setOriginalAccountData({
        email: email,
        password: '••••••••'
      });

      setBusinessSettings({
        address: properties.address || '',
        services: properties.services || [],
        workingHours: properties.working_hours || []
      });
      
      setIsDataLoaded(true);
    }
  }, [profileData]);

  const handleAccountSave = async () => {
    setLoading(true);
    setMessage('');
    
    // Validate password match
    if (accountSettings.password && accountSettings.password !== accountSettings.confirmPassword) {
      setMessage('Passwords do not match. Please make sure both password fields are identical.');
      setLoading(false);
      return;
    }
    
    // Validate password length if password is being changed
    if (accountSettings.password && accountSettings.password.length < 6) {
      setMessage('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }
    
    try {
      // Determine what fields have changed
      const updateData = {};
      let hasChanges = false;
      
      // Check if email changed
      if (accountSettings.email !== originalAccountData.email) {
        updateData.email = accountSettings.email;
        hasChanges = true;
      }
      
      // Check if password changed (and is not the masked value)
      if (accountSettings.password && accountSettings.password !== '••••••••') {
        updateData.password = accountSettings.password;
        hasChanges = true;
      }
      
      if (!hasChanges) {
        setMessage('No changes detected. Nothing to update.');
        setLoading(false);
        return;
      }
      
      // Send only changed fields to backend
      const response = await auth.updateUser(updateData);
      
      if (response.status === 200) {
        // Check if password was changed
        const passwordChanged = accountSettings.password && accountSettings.password !== '••••••••';
        
        if (passwordChanged) {
          // Password was changed - log out user and redirect to login
          setMessage('Password updated successfully! You will be logged out for security reasons.');
          
          // Wait a moment for user to see the message, then logout
          setTimeout(async () => {
            try {
              await logout();
              navigate('/login', { replace: true });
            } catch (error) {
              console.error('Logout error:', error);
              navigate('/login', { replace: true });
            }
          }, 2000); // 2 second delay
        } else {
          // Only email was changed - stay logged in
          setMessage('Account settings updated successfully!');
          
          // Update original data with new values
          setOriginalAccountData({
            email: accountSettings.email,
            password: originalAccountData.password
          });
          
          // Reset password fields
          setAccountSettings(prev => ({
            ...prev,
            password: '••••••••',
            confirmPassword: ''
          }));
          
          setIsEditingAccount(false);
        }
      }
    } catch (error) {
      const errorData = handleApiError(error);
      setMessage(errorData.message || 'Failed to update account settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessSave = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      // Update address in backend
      await barbers.updateAddress({ address: businessSettings.address });
      setMessage('Address updated successfully!');
      setIsEditingAddress(false);
    } catch (error) {
      console.error('Error updating address:', error);
      setMessage('Failed to update address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressEdit = () => {
    setIsEditingAddress(true);
  };

  const handleAddressCancel = () => {
    setIsEditingAddress(false);
    // Reset address to original value if needed
    setBusinessSettings(prev => ({
      ...prev,
      address: businessSettings.address // Keep current value or reset to original
    }));
  };

  const handleNotificationSave = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      // Update notification settings logic here
      setMessage('Notification settings updated successfully!');
    } catch (error) {
      setMessage('Failed to update notification settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteReason('');
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteReason) {
      setMessage('Please provide a reason for deleting your account.');
      return;
    }

    setLoading(true);
    try {
      const response = await barbers.deleteAccount({ reason: deleteReason });
      setMessage('Account deleted successfully!');
      closeDeleteModal();
      handleLogout(); // Log out user after successful deletion
    } catch (error) {
      const errorData = handleApiError(error);
      setMessage(errorData.message || 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openPauseModal = () => {
    setShowPauseModal(true);
  };

  const closePauseModal = () => {
    setShowPauseModal(false);
    setPauseDuration(7);
    setPauseReason('');
  };

  const handlePauseAccount = async () => {
    if (pauseDuration < 1) {
      setMessage('Please select a duration of at least 1 day.');
      return;
    }

    setLoading(true);
    try {
      const response = await barbers.pauseAccount({
        duration: pauseDuration,
        reason: pauseReason
      });
      
      setMessage(`Account paused successfully until ${new Date(response.data.pause_end_date).toLocaleDateString()}. or next time you log in.`);
      closePauseModal();
      
      // Optionally log out the user after pausing
      setTimeout(() => {
        handleLogout();
      }, 2000);
      
    } catch (error) {
      setMessage('Failed to pause account. Please try again.');
      console.error('Error pausing account:', error);
    } finally {
      setLoading(false);
    }
  };

  // Services Modal Functions
  const openServicesModal = () => {
    setModalServices([...businessSettings.services]);
    setShowServicesModal(true);
  };

  const closeServicesModal = () => {
    setShowServicesModal(false);
    setModalServices([]);
  };

  const handleModalOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (showServicesModal) {
        closeServicesModal();
      }
      if (showWorkingHoursModal) {
        closeWorkingHoursModal();
      }
    }
  };

  const handleServiceChange = (serviceId, field, value) => {
    setModalServices(prev => 
      prev.map(service => 
        service.id === serviceId 
          ? { ...service, [field]: value }
          : service
      )
    );
  };

  const addService = () => {
    const newService = {
      id: `temp_${Date.now()}`,
      name: '',
      price_adjustment: ''
    };
    setModalServices(prev => [...prev, newService]);
  };

  const removeService = (serviceId) => {
    setModalServices(prev => prev.filter(service => service.id !== serviceId));
  };

  const saveServices = async () => {
    setLoading(true);
    try {
      // Filter out empty services
      const validServices = modalServices.filter(service => 
        service.name && service.name.trim() && service.price_adjustment
      );
      
      // Convert to backend format - we need to create Service objects first
      // For now, we'll use a simplified approach where we just store the service name and price
      const servicesData = validServices.map(service => ({
        service_name: service.name,
        price_adjustment: service.price_adjustment
      }));
      
      // Save to backend
      await barberServices.updateAll({ services: servicesData });
      
      // Update business settings with new services
      setBusinessSettings(prev => ({
        ...prev,
        services: validServices
      }));
      
      closeServicesModal();
      setMessage('Services updated successfully!');
    } catch (error) {
      console.error('Error updating services:', error);
      setMessage('Failed to update services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Working Hours Modal Functions
  const openWorkingHoursModal = () => {
    
    // Convert working hours to availability format
    const defaultAvailability = {
      monday: { start: '09:00', end: '17:00', isSelected: false },
      tuesday: { start: '09:00', end: '17:00', isSelected: false },
      wednesday: { start: '09:00', end: '17:00', isSelected: false },
      thursday: { start: '09:00', end: '17:00', isSelected: false },
      friday: { start: '09:00', end: '17:00', isSelected: false },
      saturday: { start: '09:00', end: '17:00', isSelected: false },
      sunday: { start: '09:00', end: '17:00', isSelected: false }
    };
    
    // If we have existing working hours, convert them to availability format
    if (businessSettings.workingHours && businessSettings.workingHours.length > 0) {
      businessSettings.workingHours.forEach(hour => {
        const day = hour.day_name || hour.day;
        if (day && defaultAvailability[day.toLowerCase()]) {
          defaultAvailability[day.toLowerCase()] = {
            start: hour.start_time || '09:00',
            end: hour.end_time || '17:00',
            isSelected: hour.is_selected !== false
          };
        }
      });
    }
    
    setModalAvailability(defaultAvailability);
    setShowWorkingHoursModal(true);
  };

  const closeWorkingHoursModal = () => {
    setShowWorkingHoursModal(false);
    setModalAvailability({});
  };

  const handleWorkingHourChange = (day, field, value) => {
    setModalAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const saveWorkingHours = async () => {
    setLoading(true);
    try {
      // Convert availability back to working hours format
      const workingHoursData = Object.entries(modalAvailability)
        .filter(([day, hours]) => hours.isSelected)
        .map(([day, hours]) => ({
          day: day,
          day_name: day.charAt(0).toUpperCase() + day.slice(1),
          start_time: hours.start,
          end_time: hours.end,
          is_selected: true
        }));
      
      // Save to backend
      await workingHours.updateAll({ working_hours: workingHoursData });
      
      // Update business settings with new working hours
      setBusinessSettings(prev => ({
        ...prev,
        workingHours: workingHoursData
      }));
      
      closeWorkingHoursModal();
      setMessage('Working hours updated successfully!');
    } catch (error) {
      console.error('Error updating working hours:', error);
      setMessage('Failed to update working hours. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser');
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      setIsLocationLoading(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setUserLocation(location);
          setIsLocationLoading(false);
          resolve(location);
        },
        (error) => {
          console.log('Geolocation error:', error.message);
          setIsLocationLoading(false);
          // Don't resolve with null immediately, let user manually enable
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Manual location enable function
  const enableLocationSuggestions = () => {
    getUserLocation().then((location) => {
      if (location) {
        // Refresh suggestions if there's already a query
        if (businessSettings.address && businessSettings.address.length >= 3) {
          fetchAddressSuggestions(businessSettings.address);
        }
      }
    });
  };

  // Get location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // Address autocomplete function with location bias
  const fetchAddressSuggestions = async (query) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsLoadingAddress(true);
    try {
      // Include user location if available for location-based suggestions
      const requestData = { query };
      if (userLocation) {
        requestData.lat = userLocation.lat;
        requestData.lon = userLocation.lon;
      }

      const response = await axiosInstance.post('/barbers/address_suggestions/', requestData);
      const data = response.data;
      
      const suggestions = data.map(item => ({
        id: item.place_id,
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));
      
      setAddressSuggestions(suggestions);
      setShowAddressSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // Handle address input change with debouncing
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setBusinessSettings({...businessSettings, address: value});
    setSelectedSuggestionIndex(-1);
    
    // Debounce the API call
    clearTimeout(window.addressTimeout);
    window.addressTimeout = setTimeout(() => {
      fetchAddressSuggestions(value);
    }, 300);
  };

  // Handle keyboard navigation
  const handleAddressKeyDown = (e) => {
    if (!showAddressSuggestions || addressSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < addressSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : addressSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < addressSuggestions.length) {
          handleAddressSuggestionSelect(addressSuggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowAddressSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle address suggestion selection
  const handleAddressSuggestionSelect = (suggestion) => {
    setBusinessSettings({...businessSettings, address: suggestion.display_name});
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  // Close address suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.address-input-container')) {
        setShowAddressSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const renderAccountSettings = () => (
    <div className="settings-section">
      <div className="section-header">
        <h3>Account Information</h3>
        {!isEditingAccount && (
          <button 
            className="edit-button"
            onClick={() => setIsEditingAccount(true)}
          >
            Edit
          </button>
        )}
      </div>
      
      {!isEditingAccount ? (
        // Read-only view
        <div className="read-only-info">
          <div className="info-item">
            <label>Email</label>
            <div className="info-value">{accountSettings.email}</div>
          </div>
          <div className="info-item">
            <label>Password</label>
            <div className="info-value">{accountSettings.password}</div>
          </div>
            </div>
      ) : (
        // Edit form
        <div className="settings-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={accountSettings.email}
              onChange={(e) => setAccountSettings({...accountSettings, email: e.target.value})}
              placeholder="Enter your email"
            />
            </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={accountSettings.password}
              onChange={(e) => setAccountSettings({...accountSettings, password: e.target.value})}
              placeholder="Enter new password"
            />
              </div>
          <div className="form-group">
            <label>Re-enter Password</label>
            <input
              type="password"
              value={accountSettings.confirmPassword}
              onChange={(e) => setAccountSettings({...accountSettings, confirmPassword: e.target.value})}
              placeholder="Re-enter new password"
              className={accountSettings.password && accountSettings.confirmPassword && accountSettings.password !== accountSettings.confirmPassword ? 'error-input' : ''}
            />
            {accountSettings.password && accountSettings.confirmPassword && accountSettings.password !== accountSettings.confirmPassword && (
              <div className="validation-error">Passwords do not match</div>
            )}
          </div>
          <div className="form-actions">
            <button 
              className="cancel-button"
              onClick={() => {
                setIsEditingAccount(false);
                // Reset to original values
                setAccountSettings({
                  email: originalAccountData.email,
                  password: '••••••••',
                  confirmPassword: ''
                });
              }}
            >
              Cancel
            </button>
            <button 
              className="save-button" 
              onClick={handleAccountSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

    </div>
  );

  const renderBusinessSettings = () => (
    <div className="settings-section">
      <h3>Business Information</h3>
      <div className="settings-form">
        <div className="form-group">
          <label>Business Address</label>
          <div className="address-input-container">
            <input
              type="text"
              value={businessSettings.address}
              onChange={handleAddressChange}
              onFocus={() => fetchAddressSuggestions(businessSettings.address)}
              onKeyDown={handleAddressKeyDown}
              placeholder="Enter your business address"
              readOnly={!isEditingAddress}
              style={{ 
                backgroundColor: isEditingAddress ? 'white' : '#f8f9fa',
                cursor: isEditingAddress ? 'text' : 'default'
              }}
            />
            {showAddressSuggestions && (
              <div className="address-suggestions-dropdown">
                {isLoadingAddress ? (
                  <div className="suggestion-item">Loading...</div>
                ) : addressSuggestions.length > 0 ? (
                  addressSuggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.id}
                      className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                      onClick={() => handleAddressSuggestionSelect(suggestion)}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      onMouseLeave={() => setSelectedSuggestionIndex(-1)}
                    >
                      {suggestion.display_name}
                    </div>
                  ))
                ) : (
                  <div className="suggestion-item">No suggestions found</div>
                )}
              </div>
            )}
          </div>
          {!isEditingAddress ? (
            <button 
              className="secondary-button"
              onClick={handleAddressEdit}
              style={{ marginTop: '10px' }}
            >
              Change Address
            </button>
          ) : (
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
              <button 
                className="save-button"
                onClick={handleBusinessSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button 
                className="cancel-button"
                onClick={handleAddressCancel}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label>Services Provided</label>
          <div className="services-list">
            {businessSettings.services && businessSettings.services.length > 0 ? (
              businessSettings.services.map((service, index) => (
                <div key={index} className="service-item">
                  <span className="service-name">{service.name || service.service_name}</span>
                  <span className="service-price">${service.price || service.base_price || service.price_adjustment || '0'}</span>
                </div>
              ))
            ) : (
              <div className="no-services">No services configured</div>
            )}
          </div>
          <button 
            className="secondary-button"
            onClick={openServicesModal}
            style={{ marginTop: '10px' }}
          >
            Manage Services
          </button>
        </div>
        
        <div className="form-group">
          <label>Working Hours</label>
          <div className="working-hours-list">
            {businessSettings.workingHours && businessSettings.workingHours.length > 0 ? (
              businessSettings.workingHours.map((hour, index) => (
                <div key={index} className="working-hour-item">
                  <span className="day">{hour.day_name || hour.day}</span>
                  <span className="time">
                    {hour.is_selected ? 
                      `${hour.start_time} - ${hour.end_time}` : 
                      'Closed'
                    }
                  </span>
                </div>
              ))
            ) : (
              <div className="no-hours">No working hours configured</div>
            )}
          </div>
          <button 
            className="secondary-button"
            onClick={openWorkingHoursModal}
            style={{ marginTop: '10px' }}
          >
            Manage Working Hours
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="settings-section">
      <h3>Notification Preferences</h3>
      <div className="settings-form">
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.emailNotifications}
              onChange={(e) => setNotificationSettings({...notificationSettings, emailNotifications: e.target.checked})}
            />
            <span>Email Notifications</span>
          </label>
        </div>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.smsNotifications}
              onChange={(e) => setNotificationSettings({...notificationSettings, smsNotifications: e.target.checked})}
            />
            <span>SMS Notifications</span>
          </label>
        </div>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.appointmentReminders}
              onChange={(e) => setNotificationSettings({...notificationSettings, appointmentReminders: e.target.checked})}
            />
            <span>Appointment Reminders</span>
          </label>
        </div>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.newBookingAlerts}
              onChange={(e) => setNotificationSettings({...notificationSettings, newBookingAlerts: e.target.checked})}
            />
            <span>New Booking Alerts</span>
          </label>
        </div>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notificationSettings.reviewNotifications}
              onChange={(e) => setNotificationSettings({...notificationSettings, reviewNotifications: e.target.checked})}
            />
            <span>Review Notifications</span>
          </label>
        </div>
        <button 
          className="save-button" 
          onClick={handleNotificationSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderAccountManagement = () => (
    <div className="settings-section">
      <h3>Account Management</h3>
      <div className="settings-form">
        <div className="action-buttons">
          <button 
            className="pause-account-button"
            onClick={openPauseModal}
          >
            Pause Account
          </button>
          <button 
            className="danger-button"
            onClick={handleDeleteAccount}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="settings-container">
      <header className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Settings</h1>
      </header>

      {message && (
        <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {!isDataLoaded ? (
        <div className="loading-container">
          <div className="loading-spinner">Loading settings...</div>
        </div>
      ) : (
        <div className="settings-content">
          <nav className="settings-nav">
            <button 
              className={`nav-item ${activeSection === 'account' ? 'active' : ''}`}
              onClick={() => setActiveSection('account')}
            >
              Account
            </button>
            <button 
              className={`nav-item ${activeSection === 'business' ? 'active' : ''}`}
              onClick={() => setActiveSection('business')}
            >
              Business
            </button>
            <button 
              className={`nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveSection('notifications')}
            >
              Notifications
            </button>
            <button 
              className={`nav-item ${activeSection === 'management' ? 'active' : ''}`}
              onClick={() => setActiveSection('management')}
            >
              Account Management
            </button>
          </nav>

          <main className="settings-main">
            {activeSection === 'account' && renderAccountSettings()}
            {activeSection === 'business' && renderBusinessSettings()}
            {activeSection === 'notifications' && renderNotificationSettings()}
            {activeSection === 'management' && renderAccountManagement()}
          </main>
        </div>
      )}

      <footer className="settings-footer">
        <p>&copy; 2024 SoloApp</p>
      </footer>

      {/* Services Modal */}
      {showServicesModal && (
        <div className="modal-overlay" onClick={handleModalOverlayClick}>
          <div className="services-modal">
            <div className="modal-header">
              <h3>Manage Services</h3>
              <button className="modal-close-btn" onClick={closeServicesModal}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="modal-services-section">
                {modalServices.map((service, index) => (
                  <ServiceItem
                    key={service.id || index}
                    service={service}
                    onRemove={removeService}
                    onChange={handleServiceChange}
                    showRemove={modalServices.length > 1}
                  />
                ))}
                <button
                  type="button"
                  onClick={addService}
                  className="modal-add-service-btn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="add-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Another Service
                </button>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="save-button" onClick={saveServices} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Working Hours Modal */}
      {showWorkingHoursModal && (
        <div className="modal-overlay" onClick={handleModalOverlayClick}>
          <div className="services-modal">
            <div className="modal-header">
              <h3>Working Hours</h3>
              <button className="modal-close-btn" onClick={closeWorkingHoursModal}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="availability-section">
                {Object.entries(modalAvailability).map(([day, hours]) => (
                  <WorkingHoursItem
                    key={day}
                    day={day}
                    hours={hours}
                    onChange={handleWorkingHourChange}
                  />
                ))}
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="save-button" onClick={saveWorkingHours} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Account Modal */}
      {showPauseModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            closePauseModal();
          }
        }}>
          <div className="services-modal pause-modal">
            <div className="modal-header">
              <h3>Pause Account</h3>
              <button className="modal-close-btn" onClick={closePauseModal}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Duration (in days) *</label>
                <DurationPicker
                  value={pauseDuration}
                  onChange={setPauseDuration}
                />
              </div>
              <div className="form-group">
                <label>Reason for Pausing</label>
                <textarea
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g., Taking a break, maintenance, etc."
                  rows="4"
                  cols="30"
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="save-button" onClick={handlePauseAccount} disabled={loading}>
                {loading ? 'Pausing...' : 'Pause Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeDeleteModal();
          }
        }}>
          <div className="services-modal delete-modal">
            <div className="modal-header">
              <h3>Delete Account</h3>
              <button className="modal-close-btn" onClick={closeDeleteModal}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <p>Are you sure you want to delete your account? This action cannot be undone. We are sad to see you go.</p>
              <div className="form-group">
                <label>What could we do better? *</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g., Better features, improved service, pricing, etc."
                  rows="4"
                  cols="30"
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="danger-button" 
                onClick={handleConfirmDeleteAccount}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsParameters; 