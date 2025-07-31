// BarberDashboard Component
// Purpose: Provides barbers with an overview of their business metrics
// Features: Appointments overview, portfolio showcase, and service statistics
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { barbers, appointments, reviews, handleApiError } from '../services/api';
import '../styles/BarberDashboard.css';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { extractProfileData, formatDistance, getLocationInfo } from '../utils/geoUtils';
import useSWR from 'swr';
import { parse, format } from 'date-fns';

// Add getImageUrl helper from BarberProfile.js
const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return imagePath.startsWith('http')
        ? imagePath
        : `http://127.0.0.1:8000${imagePath}`;
};

// Appointments fetcher for SWR
const appointmentsFetcher = async () => {
    const response = await appointments.getBarberAppointments();
    return response.data;
};

const PortfolioCard = ({ post }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageError, setImageError] = useState(false);
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);

    // Handle both single and group posts
    const images = post.is_group_post ? post.group_images : [{ image: post.image }];
    const hasMultipleImages = post.is_group_post ? post.group_images.length > 1 : false;
    const currentImage = images[currentImageIndex]?.image;

    // Swipe handlers
    const handleTouchStart = (e) => {
        setTouchStartX(e.targetTouches[0].clientX);
    };
    const handleTouchMove = (e) => {
        setTouchEndX(e.targetTouches[0].clientX);
    };
    const handleTouchEnd = () => {
        if (touchStartX === null || touchEndX === null) return;
        const distance = touchStartX - touchEndX;
        if (Math.abs(distance) > 50) {
            if (distance > 0) {
                // Swipe left (next image)
                setCurrentImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
                setImageError(false);
            } else {
                // Swipe right (prev image)
                setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
                setImageError(false);
            }
        }
        setTouchStartX(null);
        setTouchEndX(null);
    };

    return (
        <div className="bd-showcase-item">
            <div className="bd-showcase-image-container">
                {imageError ? (
                    <div className="bd-showcase-placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                        </svg>
                        <p>Image not available</p>
                    </div>
                ) : (
                    <div
                        className="bd-showcase-image"
                        style={{ backgroundImage: `url(${getImageUrl(currentImage)})` }}
                        role="img"
                        aria-label={`Portfolio item ${currentImageIndex + 1}`}
                        onTouchStart={hasMultipleImages ? handleTouchStart : undefined}
                        onTouchMove={hasMultipleImages ? handleTouchMove : undefined}
                        onTouchEnd={hasMultipleImages ? handleTouchEnd : undefined}
                    />
                )}
                {hasMultipleImages && (
                    <div className="bd-showcase-indicators">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                className={`bd-showcase-dot ${idx === currentImageIndex ? 'active' : ''}`}
                                onClick={e => {
                                    e.preventDefault();
                                    setCurrentImageIndex(idx);
                                    setImageError(false);
                                }}
                                aria-label={`Go to image ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="bd-showcase-content">
                <h3>{post.description || 'Untitled'}</h3>
                <p className="bd-post-date">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>
            </div>
        </div>
    );
};

const BarberDashboard = () => {
    // Hooks must be called at the top level
    const navigate = useNavigate();
    const { id } = useParams();
    const [currentImageIndexes, setCurrentImageIndexes] = useState({});
    const [averageRating, setAverageRating] = useState(0);
    const [error, setError] = useState(null);
    const [isOwnDashboard, setIsOwnDashboard] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    // Track image error state for each portfolio item
    const [imageErrors, setImageErrors] = useState({});

    // Context hooks
    const { profileData, user, logout, mutateProfile } = useAuth();
    const { portfolioData, loading: portfolioLoading, fetchPortfolio } = usePortfolio();

    // Refs
    const initializationRef = useRef(false);
    const refreshIntervalRef = useRef(null);

    // Transform profile data into a simpler format
    const transformedProfileData = useMemo(() => {
        if (!profileData) return null;
        
        return {
            id: profileData.id,
            name: profileData.properties?.user_details?.first_name 
                ? `${profileData.properties.user_details.first_name} ${profileData.properties.user_details.last_name || ''}`
                : 'Barber',
            image: profileData.properties?.profile_image,
            location: profileData.properties?.address,
            experience: profileData.properties?.years_of_experience,
            services: profileData.properties?.services
        };
    }, [profileData]);

    // Memoize the dashboard owner check
    const isOwn = useMemo(() => {
        const result = transformedProfileData && String(transformedProfileData.id) === String(id);
        console.log('🔍 Dashboard ownership check:', {
            transformedProfileDataId: transformedProfileData?.id,
            currentId: id,
            isOwn: result
        });
        return result;
    }, [transformedProfileData?.id, id]);

    // Appointments SWR with synchronized refresh
    const { data: appointmentsList, error: appointmentsError, mutate: mutateAppointments } = useSWR(
        isInitialized && isOwn && localStorage.getItem('token') ? '/appointments/upcoming/' : null,
        appointmentsFetcher,
        {
            refreshInterval: 300000, // 5 minutes
            revalidateOnFocus: true,
            onError: (err) => {
                console.error('Error fetching appointments:', err);
                // Provide more specific error messages
                let errorMessage = 'Failed to load appointments';
                if (err.response?.status === 401) {
                    errorMessage = 'Your session has expired. Please log in again.';
                } else if (err.response?.status === 403) {
                    const errorDetail = err.response?.data?.error || '';
                    if (errorDetail.includes('must be a barber')) {
                        errorMessage = 'You must be a barber to view appointments.';
                    } else {
                        errorMessage = 'You don\'t have permission to view appointments.';
                    }
                } else if (err.response?.status === 404) {
                    errorMessage = 'Appointments not found.';
                } else if (err.response?.status >= 500) {
                    errorMessage = 'Server error. Please try again later.';
                } else if (!err.response) {
                    errorMessage = 'Unable to connect to the server. Please check your internet connection.';
                }
                setError(errorMessage);
            },
            onSuccess: (data) => {
                console.log('✅ Appointments loaded successfully:', data);
            }
        }
    );

    // Debug appointments data
    useEffect(() => {
        console.log('🔍 Appointments Debug:', {
            isInitialized,
            isOwn,
            appointmentsList,
            appointmentsError,
            hasToken: !!localStorage.getItem('token'),
            token: localStorage.getItem('token') ? 'present' : 'missing'
        });
    }, [isInitialized, isOwn, appointmentsList, appointmentsError]);

    // Synchronized data refresh with debounce
    const refreshAllData = useCallback(async () => {
        if (!isInitialized || !isOwn) return;

        try {
            console.log('Refreshing all dashboard data');
            await Promise.all([
                mutateProfile(),
                fetchPortfolio(id),
                mutateAppointments()
            ]);
        } catch (err) {
            console.error('Error refreshing dashboard data:', err);
            setError(err.message || 'Failed to refresh dashboard data');
        }
    }, [mutateProfile, fetchPortfolio, mutateAppointments, id, isInitialized, isOwn]);

    // Cleanup effect when user changes
    useEffect(() => {
        // Clear any stale data when user changes
        if (transformedProfileData) {
            console.log('🔍 User changed, clearing stale data...');
            setError(null);
            setIsInitialized(false);
            initializationRef.current = false;
        }
    }, [transformedProfileData?.id]);

    // Initialize dashboard once
    useEffect(() => {
        const initializeDashboard = async () => {
            if (!transformedProfileData || initializationRef.current) return;

            try {
                setIsLoading(true);
                setError(null); // Clear any previous errors
                setIsOwnDashboard(isOwn);

                if (isOwn) {
                    try {
                    await fetchPortfolio(id);
                        setIsInitialized(true);
                    } catch (err) {
                        console.error('Error fetching portfolio:', err);
                        setError(err.message || 'Failed to load portfolio');
                        return;
                    }
                }

                initializationRef.current = true;
                setError(null);
            } catch (err) {
                console.error('Error initializing dashboard:', err);
                setError(err.message || 'Failed to initialize dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        // Reset initialization flag when user changes
        if (!transformedProfileData) {
            initializationRef.current = false;
        }

        initializeDashboard();
    }, [transformedProfileData, id, isOwn, fetchPortfolio]);

    // Handle window focus for synchronized refresh
    useEffect(() => {
        const handleFocus = () => {
            if (isOwnDashboard) {
                console.log('Window focus - refreshing all data');
                refreshAllData();
            }
        };

        const handleAppointmentCancelled = () => {
            if (isOwnDashboard) {
                console.log('Appointment cancelled - refreshing appointments');
                mutateAppointments();
            }
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('appointmentCancelled', handleAppointmentCancelled);
        
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('appointmentCancelled', handleAppointmentCancelled);
        };
    }, [isOwnDashboard, refreshAllData, mutateAppointments]);

    // Get the current barber's portfolio data
    const currentPortfolio = useMemo(() => {
        return portfolioData[id] || [];
    }, [portfolioData, id]);

    // Navigation handlers
    const navigateToProfile = useCallback(() => {
        navigate(`/barber-profile/${id}`);
    }, [navigate, id]);

    const handleLogout = useCallback(() => {
        logout();
        navigate('/login', { replace: true });
    }, [logout, navigate]);

    // Image navigation handlers
    const handlePrevImage = useCallback((itemIndex) => {
        setCurrentImageIndexes(prev => ({
            ...prev,
            [itemIndex]: prev[itemIndex] > 0 ? prev[itemIndex] - 1 : 0
        }));
    }, []);

    const handleNextImage = useCallback((itemIndex, maxLength) => {
        setCurrentImageIndexes(prev => ({
            ...prev,
            [itemIndex]: prev[itemIndex] < maxLength - 1 ? prev[itemIndex] + 1 : prev[itemIndex]
        }));
    }, []);

    // Always fetch portfolio for the current id
    useEffect(() => {
        if (!id) return;
        setIsLoading(true);
        fetchPortfolio(id)
            .catch(err => {
                console.error('Error fetching portfolio:', err);
                setError(err.message || 'Failed to load portfolio');
            })
            .finally(() => setIsLoading(false));
    }, [id, fetchPortfolio]);

    // Fetch reviews and calculate average rating
    useEffect(() => {
        const fetchReviewsAndCalculateRating = async () => {
            if (!id) return;
            
            try {
                const response = await reviews.getByBarber(id);
                const reviewsList = response.data.results || response.data || [];
                
                if (reviewsList.length > 0) {
                    const totalRating = reviewsList.reduce((sum, review) => sum + (review.rating || 0), 0);
                    const average = totalRating / reviewsList.length;
                    setAverageRating(average);
                } else {
                    setAverageRating(0);
                }
            } catch (error) {
                console.error('Error fetching reviews:', error);
                setAverageRating(0);
            }
        };

        fetchReviewsAndCalculateRating();
    }, [id]);

    // Render loading state
    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    // Render error state
    if (error) {
        // Convert technical errors to user-friendly messages
        let userFriendlyError = error;
        
        if (error.includes('Request failed with status code 400')) {
            userFriendlyError = 'Unable to load your appointments. Please try refreshing the page.';
        } else if (error.includes('Request failed with status code 401')) {
            userFriendlyError = 'Your session has expired. Please log in again.';
        } else if (error.includes('Request failed with status code 403')) {
            userFriendlyError = 'You don\'t have permission to view this dashboard.';
        } else if (error.includes('Request failed with status code 404')) {
            userFriendlyError = 'Dashboard not found. Please check the URL.';
        } else if (error.includes('Request failed with status code 500')) {
            userFriendlyError = 'We\'re experiencing technical difficulties. Please try again later.';
        } else if (error.includes('Network Error') || error.includes('Failed to fetch')) {
            userFriendlyError = 'Unable to connect to the server. Please check your internet connection.';
        }
        
        return (
            <div className="error-container">
                <h3>Error Loading Dashboard</h3>
                <p>{userFriendlyError}</p>
                <button 
                    className="retry-button"
                    onClick={() => {
                        setError(null);
                        window.location.reload();
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    // Render no profile data state
    if (!transformedProfileData) {
        return (
            <div className="error-container">
                <h3>Profile Not Found</h3>
                <p>Unable to load profile data. Please try again later.</p>
                <button 
                    className="retry-button"
                    onClick={() => navigate(0)}
                >
                    Retry
                </button>
            </div>
        );
    }

    // Render not initialized state
    if (!isInitialized && isOwn) {
        return <div className="loading">Initializing dashboard...</div>;
    }

    console.log('Dashboard portfolio items:', currentPortfolio.slice(0, 3));

    // Main dashboard render
    return (
        <>
        <div className="barber-dashboard">
            <header className="bd-header">
                    <h1>Welcome to your dashboard, {transformedProfileData.name}</h1>
            </header>

            <section className="bd-appointments">
                <div className="bd-section-header">
                    <h3>Appointments</h3>
                    <button className="bd-check-day-btn" onClick={() => navigate(`/appointment-panel/${id}`)}>Check your Day →</button>
                </div>

                <div className="bd-appointment-list">
                        {appointmentsList ? (
                            appointmentsList.length > 0 ? (
                        appointmentsList.map((appointment, index) => (
                            <div key={index} className="bd-appointment-item">
                                <div className="bd-appointment-details">
                                    <h4>{formatServiceName(appointment.service)}</h4>
                                    <p><strong>Client:</strong> {appointment.customer}</p>
                                    <p><strong>When:</strong> {format(parse(appointment.date, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')} at {formatTime(appointment.start_time)}</p>
                                </div>
                            </div>
                        ))
                            ) : (
                                <div className="bd-no-appointments">
                                    <p>No appointments scheduled yet.</p>
                                </div>
                            )
                    ) : (
                        <div className="bd-no-appointments">
                            <p>No appointments scheduled yet.</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="bd-showcase">
                <div className="bd-section-header">
                    <h3>Your Work Showcase</h3>
                        <button className="bd-view-portfolio-btn" onClick={navigateToProfile}>
                            View Portfolio →
                        </button>
                </div>

                <div className="bd-showcase-grid">
                        {portfolioLoading[id] ? (
                        <p>Loading portfolio...</p>
                        ) : (
                            [...currentPortfolio]
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                .slice(0, 3)
                                .map((item, index) => (
                                    <PortfolioCard key={index} post={item} />
                                ))
                    )}
                </div>
            </section>

            <section className="bd-statistics">
                <div className="bd-section-header">
                    <h3>Service Statistics</h3>
                    <button className="bd-view-more-btn">View More →</button>
                </div>

                <div className="bd-stats-grid">
                    <div className="bd-stat-card">
                        <h4>Total Clients</h4>
                        <p className="bd-stat-number">
                            {(() => {
                                console.log('AppointmentsList:', appointmentsList);
                                if (!appointmentsList || !Array.isArray(appointmentsList)) {
                                    console.log('No appointments data available');
                                    return 0;
                                }
                                
                                // Create a map to track unique clients
                                const uniqueClients = new Map();
                                
                                appointmentsList.forEach(apt => {
                                    const customerName = apt.customer || '';
                                    const phoneNumber = apt.contact_number || '';
                                    
                                    console.log('Processing appointment:', { customerName, phoneNumber });
                                    
                                    // Also track by phone number alone and name alone
                                    if (phoneNumber) {
                                        uniqueClients.set(phoneNumber, true);
                                    }
                                    if (customerName) {
                                        uniqueClients.set(customerName, true);
                                    }
                                });
                                
                                console.log('Unique clients found:', uniqueClients.size);
                                console.log('Unique clients:', Array.from(uniqueClients.keys()));
                                
                                return uniqueClients.size;
                            })()}
                        </p>
                    </div>
                    <div className="bd-stat-card">
                        <h4>Average Rating</h4>
                        <p className="bd-stat-number">{averageRating.toFixed(1)}</p>
                    </div>
                </div>
            </section>

                {/* Footer with proper spacing */}
                <footer className="footer">
                    <p>&copy; 2024 SoloApp</p>
                </footer>
            </div>
            {/* Navigation bar moved outside main content for fixed positioning */}
            <div className="bd-navigation">
                <div className="bd-nav-item" onClick={() => navigate('/search')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                    <span>Search</span>
                </div>
                <div className="bd-nav-item" onClick={navigateToProfile}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    <span>Profile</span>
                </div>
                <div className="bd-nav-item" onClick={() => navigate(`/appointment-panel/${id}`)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
                    </svg>
                    <span>Appointments</span>
                </div>
            </div>
        </>
    );
};

export default BarberDashboard;
// Helper function to format time from HH:MM:SS to readable format
const formatTime = (timeString) => {
    if (!timeString) return "";
    // Convert "15:40:00" to "3:40 PM"
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to format service name
const formatServiceName = (serviceName) => {
    if (!serviceName) return "Unknown Service";
    // Capitalize first letter
    const capitalized = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
    return `Service: ${serviceName}`;
};
