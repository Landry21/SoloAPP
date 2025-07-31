import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { barbers, handleApiError } from '../services/api';
import '../styles/CreateBarberProfile.css';

const CreateBarberProfile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    email: '',
    password: '',
    confirmPassword: '',
    profilePhoto: null,
    yearsOfExperience: '',
    priceRangeMin: '',
    priceRangeMax: '',
    selectedMonth: '',
    selectedDays: [],
    availability: {
      monday: { start: '', end: '', isSelected: false },
      tuesday: { start: '', end: '', isSelected: false },
      wednesday: { start: '', end: '', isSelected: false },
      thursday: { start: '', end: '', isSelected: false },
      friday: { start: '', end: '', isSelected: false },
      saturday: { start: '', end: '', isSelected: false },
      sunday: { start: '', end: '', isSelected: false }
    },
    portfolioPhotos: []
  });
  
  // Preview states
  const [imagePreview, setImagePreview] = useState(null);
  const [workImagePreviews, setWorkImagePreviews] = useState([]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target;
    
    if (type === 'file') {
      if (name === 'profilePhoto') {
        // Handle single profile image
        const file = files[0];
        setFormData({ ...formData, [name]: file });
        
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result);
          };
          reader.readAsDataURL(file);
        } else {
          setImagePreview(null);
        }
      } else if (name === 'portfolioPhotos') {
        // Handle multiple work images
        const fileArray = Array.from(files);
        setFormData({ ...formData, portfolioPhotos: [...formData.portfolioPhotos, ...fileArray] });
        
        // Create previews for work images
        fileArray.forEach(file => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setWorkImagePreviews(prev => [...prev, reader.result]);
          };
          reader.readAsDataURL(file);
        });
      }
    } else if (name.startsWith('working_hours')) {
      // Handle working hours changes
      const [day, field] = name.split('_').slice(2); // working_hours_monday_start -> [monday, start]
      setFormData({
        ...formData,
        working_hours: {
          ...formData.working_hours,
          [day]: {
            ...formData.working_hours[day],
            [field]: type === 'checkbox' ? checked : value
          }
        }
      });
    } else if (name === 'selectedMonth') {
      setFormData({ ...formData, selectedMonth: value });
    } else if (name === 'selectedDays') {
      if (checked) {
        setFormData({ ...formData, selectedDays: [...formData.selectedDays, value] });
      } else {
        setFormData({ ...formData, selectedDays: formData.selectedDays.filter((d) => d !== value) });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleDaySelect = (day) => {
    const updatedAvailability = {
      ...formData.availability,
      [day.toLowerCase()]: {
        ...formData.availability[day.toLowerCase()],
        isSelected: !formData.availability[day.toLowerCase()].isSelected
      }
    };
    setFormData({ ...formData, availability: updatedAvailability });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await barbers.createBarberProfile(formData);
      console.log('Profile created:', response.data);
      setSuccess('Profile created successfully!');
      
      // Store the barber ID
      localStorage.setItem('barberId', response.data.id);
      localStorage.setItem('isBarber', 'true');
      localStorage.setItem('userType', 'barber');

      // Navigate to complete profile
      setTimeout(() => {
        navigate('/complete-barber-profile');
      }, 1500);
    } catch (error) {
      const { message } = handleApiError(error);
      console.error('Error creating profile:', error);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="create-profile-container">
      <div className="create-profile-card">
        <h2>Sign Up</h2>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="name-fields-container">
            <div className="barber-form-group">
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First Name"
                required
              />
            </div>
            
            <div className="barber-form-group">
              <input
                type="text"
                name="surname"
                value={formData.surname}
                onChange={handleChange}
                placeholder="Surname"
                required
              />
            </div>
          </div>

          <div className="auth-fields-container">
            <div className="barber-form-group">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email"
                required
              />
            </div>

            <div className="barber-form-group">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                required
              />
            </div>

            <div className="barber-form-group">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                required
              />
            </div>

            <div className="barber-form-group">
              <input
                type="file"
                name="profilePhoto"
                onChange={handleChange}
                className="profile-photo-upload"
                placeholder="Profile Photo"
              />
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
                    name="priceRangeMin"
                    value={formData.priceRangeMin}
                    onChange={handleChange}
                    placeholder="Min"
                    min="0"
                    required
                  />
                </div>
                <span className="price-separator">-</span>
                <div className="price-input-group">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    name="priceRangeMax"
                    value={formData.priceRangeMax}
                    onChange={handleChange}
                    placeholder="Max"
                    min="0"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <h3 className="section-header">Portfolio Photos</h3>
          <div className="barber-form-group">
            <div className="portfolio-upload-container">
              <input
                type="file"
                id="portfolio-upload"
                name="portfolioPhotos"
                onChange={handleChange}
                className="portfolio-input"
                multiple
                accept="image/*"
              />
              <div className="portfolio-upload-content">
                <svg xmlns="http://www.w3.org/2000/svg" className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="upload-text">
                  <p className="upload-primary-text">
                    <span className="browse-text">Select Photos</span>
                  </p>
                  <p className="upload-secondary-text">JPEG, PNG up to 10MB</p>
                  {formData.portfolioPhotos.length > 0 && (
                    <p className="files-selected-text">{formData.portfolioPhotos.length} files selected</p>
                  )}
                </div>
              </div>
            </div>
            {workImagePreviews.length > 0 && (
              <div className="portfolio-previews">
                {workImagePreviews.map((preview, index) => (
                  <div key={index} className="portfolio-preview-item">
                    <img src={preview} alt={`Portfolio ${index + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        
          <h3 className="section-header">Availability</h3>
          <div className="availability-section">
            {Object.entries(formData.availability).map(([day, hours]) => (
              <div key={day} className="day-row">
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
                          value={hours.start}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <span className="time-separator">to</span>
                      <div className="time-input">
                        <input
                          type="time"
                          name={`availability.${day}.end`}
                          value={hours.end}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Creating Profile...' : 'Create Account'}
          </button>

          <p className="terms-text">
            By creating an account, you agree to our Terms & Conditions.
          </p>
        </form>
      </div>
      <footer className="footer">
        <p>&copy; 2024 SoloApp</p>
      </footer>
    </div>
  );
};

export default CreateBarberProfile; 