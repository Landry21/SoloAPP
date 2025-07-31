// BarberProfile Component
// Purpose: Displays individual barber's profile and portfolio
// Features: Shows barber's information, work samples, and booking options
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosConfig';
import { barbers, handleApiError, reviews } from '../services/api';
import '../styles/BarberProfile.css';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import useSWR from 'swr';
import ReactDOM from 'react-dom';

function MenuDropdown({ anchorRef, open, children }) {
    const [coords, setCoords] = React.useState({ top: 0, left: 0 });
    React.useEffect(() => {
        if (open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8, // 8px below the button
                left: rect.right + window.scrollX - 180, // align right edge, adjust width as needed
            });
        }
    }, [open, anchorRef]);
    if (!open) return null;
    return ReactDOM.createPortal(
        <div className="bp-portfolio-menu-dropdown" style={{ position: 'absolute', top: coords.top, left: coords.left, zIndex: 5000 }}>
            {children}
        </div>,
        document.body
    );
}

// SWR fetcher for barber data
const barberFetcher = async (barberId) => {
    const response = await barbers.getById(barberId);
    return response.data;
};

// SWR fetcher for reviews
const reviewsFetcher = async (url) => {
    const barberId = url.split('/').pop();
    const response = await reviews.getByBarber(barberId);
    return response.data;
};

const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return imagePath.startsWith('http')
        ? imagePath
        : `http://127.0.0.1:8000${imagePath}`;
};

const PortfolioCard = ({ post, navigate, onDelete }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);
    const menuButtonRef = useRef(null);
    const buttonRef = useRef(null);
    const { id: barberId } = useParams(); // Get barber ID from URL params

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuButtonRef.current && !menuButtonRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            try {
                console.log('Attempting to delete post:', post);
                console.log('Post ID:', post.id);
                console.log('Barber ID:', barberId);
                await onDelete(post.id);
                console.log('Post deleted successfully');
            } catch (error) {
                console.error('Error deleting post:', error);
                console.error('Error response:', error.response);
                console.error('Error data:', error.response?.data);
                alert(`Failed to delete post: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
            }
        }
        setIsMenuOpen(false);
    };

    const handleEdit = () => {
        console.log('Edit clicked for post:', post);
        console.log('Barber ID from params:', barberId);
        navigate(`/post-form/${barberId}`, {
            state: { editMode: true, postData: post }
        });
    };

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
        <div className="bp-portfolio-item">
            <div className="bp-portfolio-image-container">
                {imageError ? (
                    <div className="bp-portfolio-placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                        </svg>
                        <p>Image not available</p>
                    </div>
                ) : (
                    <div
                    className="bp-portfolio-image"
                        style={{ backgroundImage: `url(${getImageUrl(currentImage)})` }}
                        role="img"
                        aria-label={`Portfolio item ${currentImageIndex + 1}`}
                        onTouchStart={hasMultipleImages ? handleTouchStart : undefined}
                        onTouchMove={hasMultipleImages ? handleTouchMove : undefined}
                        onTouchEnd={hasMultipleImages ? handleTouchEnd : undefined}
                        onError={() => setImageError(true)}
                />
                )}
                {hasMultipleImages && (
                    <>
                        <button
                            className="bp-portfolio-nav-button prev"
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
                                setImageError(false);
                            }}
                            aria-label="Previous image"
                        >
                            ‹
                        </button>
                        <button
                            className="bp-portfolio-nav-button next"
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
                                setImageError(false);
                            }}
                            aria-label="Next image"
                        >
                            ›
                        </button>
                        <div className="bp-portfolio-indicators">
                            {images.map((_, index) => (
                                <button
                                    key={index}
                                    className={`bp-portfolio-dot ${index === currentImageIndex ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setCurrentImageIndex(index);
                                        setImageError(false);
                                    }}
                                    aria-label={`Go to image ${index + 1}`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div className="bp-portfolio-details">
                <div className="bp-portfolio-header">
                    <p className="bp-portfolio-caption">
                        {post.description}
                    </p>
                    <div className="bp-portfolio-menu">
                        <button
                            ref={menuButtonRef}
                            className="bp-portfolio-menu-button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label="More options"
                        >
                            ⋮
                        </button>
                        <MenuDropdown anchorRef={menuButtonRef} open={isMenuOpen}>
                            <button className="bp-portfolio-menu-item" onClick={handleEdit}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                    </svg>
                                    Edit
                                </button>
                            <button className="bp-portfolio-menu-item delete" onClick={handleDelete}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                    </svg>
                                    Delete
                                </button>
                        </MenuDropdown>
                    </div>
                </div>
                <p className="bp-portfolio-date">
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

const ReviewPopup = ({ isOpen, onClose, barberId, onReviewSubmitted }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            alert('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axiosInstance.post(
                '/reviews/',
                {
                    barber: parseInt(barberId),
                    rating: rating,
                    comment: comment
                },
                {
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 201) {
                onReviewSubmitted();
                onClose();
                setRating(0);
                setComment('');
            }
        } catch (error) {
            console.error('Error submitting review:', error.response?.data || error.message);
            alert(error.response?.data?.detail || 'Failed to submit review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="bp-review-popup-overlay" onClick={onClose}>
            <div className="bp-review-popup" onClick={e => e.stopPropagation()}>
                <div className="bp-review-popup-header">
                    <h3>Write a Review</h3>
                    <button className="bp-review-close-button" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit} className="bp-review-form">
                    <div className="bp-rating-input">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className={`bp-star-button ${star <= rating ? 'active' : ''}`}
                                onClick={() => setRating(star)}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="bp-review-textarea"
                        placeholder="Share your experience..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        className="bp-submit-review-button"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const BarberProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const menuRef = useRef(null);
    const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [error, setError] = useState(null);
    const [barber, setBarber] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [isCurrentUser, setIsCurrentUser] = useState(false);

    const { user, logout, mutateProfile } = useAuth();
    const { portfolioData, loading: portfolioLoading, fetchPortfolio, mutatePortfolio, deletePortfolioItem } = usePortfolio();

    // Move all hooks to the top level
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        // Only add the listener if the menu is open
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isMenuOpen]); // Add isMenuOpen as dependency

    // Use SWR for barber data
    const { data: barberData, error: barberError, mutate: mutateBarber } = useSWR(
        id ? id : null,  // Just use the ID as the key
        barberFetcher,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 5000,
            keepPreviousData: true,
            onSuccess: (data) => {
                if (user) {
                    const isCurrentUser = user.id === data.properties.user_details.id;
                    setIsCurrentUser(isCurrentUser);
                }
            }
        }
    );

    // Use SWR for reviews
    const { data: reviews, error: reviewsError, mutate: mutateReviews } = useSWR(
        id ? `/reviews/${id}` : null,
        reviewsFetcher,
        {
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 5000,
            keepPreviousData: true
        }
    );

    // Initialize portfolio data
    useEffect(() => {
        if (id) {
            fetchPortfolio(id);
        }
    }, [id, fetchPortfolio]);

    // Handle menu toggle
    const handleMenuToggle = () => {
        setIsMenuOpen(prev => !prev);
    };

    // All other handlers remain the same
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                mutateBarber(),
                mutateReviews(),
                mutatePortfolio(),
                fetchPortfolio(id)
            ]);
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Touch event handlers for pull-to-refresh
    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientY);
    };

    const handleTouchMove = (e) => {
        if (touchStart) {
            setTouchEnd(e.targetTouches[0].clientY);
        }
    };

    const handleTouchEnd = async () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchEnd - touchStart;
        const isTopOfPage = window.scrollY === 0;

        if (distance > 100 && isTopOfPage) {
            await handleRefresh();
        }

        setTouchStart(null);
        setTouchEnd(null);
    };

    // Early return for loading state
    console.log('Debug loading state:', { 
        barberData: barberData, 
        portfolioLoading: portfolioLoading,
        isBarberDataNull: !barberData,
        portfolioLoadingKeys: portfolioLoading ? Object.keys(portfolioLoading) : [],
        portfolioLoadingValues: portfolioLoading ? Object.values(portfolioLoading) : [],
        specificBarberLoading: portfolioLoading ? portfolioLoading[id] : false
    });
    const isLoading = !barberData || portfolioLoading[id];
    if (isLoading) {
        return <div className="loading">Loading profile...</div>;
    }

    // Early return for error state
    if (barberError || reviewsError) {
        return (
            <div className="error-container">
                <div className="error-message">
                    {barberError?.message || reviewsError?.message || 'An error occurred'}
                </div>
                <button className="back-button" onClick={() => navigate(-1)}>
                    Go Back
                </button>
            </div>
        );
    }

    const { properties } = barberData;

    // Add proper name handling
    const barberName = properties?.user_details ? 
        `${properties.user_details.first_name} ${properties.user_details.last_name}`.trim() : 
        'Barber';

    // Get the profession name for the header
    const getProfessionName = () => {
        if (properties?.category?.name) {
            // Capitalize the first letter and add 's Profile'
            const professionName = properties.category.name.charAt(0).toUpperCase() + 
                                 properties.category.name.slice(1).toLowerCase();
            return `${professionName}'s Profile`;
        }
        // Fallback to generic name if no category is set
        return "Professional's Profile";
    };

    const handleLogout = async () => {
        try {
            logout();
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const getInitials = (name) => {
        if (!name) return '';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
    };

    const handleReviewSubmitted = async () => {
        // Refresh reviews data
        await mutateReviews();
    };

    const handlePortfolioDelete = async (postId) => {
        try {
            console.log('handlePortfolioDelete called with postId:', postId);
            // Use the portfolio context to delete the item
            await deletePortfolioItem(id, postId);
            console.log('Portfolio item deleted successfully');
        } catch (error) {
            console.error('Error in handlePortfolioDelete:', error);
            throw error; // Re-throw to be handled by the calling function
        }
    };

    const handleBooking = () => {
        navigate(`/booking-calendar/${id}`);
    };

    const formatRating = (rating) => {
        if (rating === null || rating === undefined) return "0.0";
        const numRating = parseFloat(rating);
        return isNaN(numRating) ? "0.0" : numRating.toFixed(1);
    };

    // Add helper function to get formatted address
    const getFormattedAddress = (properties) => {
        if (!properties) return 'Not specified';

        // Check for GeoJSON structure
        if (properties.geometry && properties.geometry.coordinates) {
            return properties.formatted_address || properties.address || 'Location set but address not specified';
        }

        // Direct property access
        return properties.formatted_address || properties.address || 'Not specified';
    };

    const handleEditProfile = () => {
        console.log('=== BarberProfile Debug ===');
        console.log('Current barber data:', barberData);
        console.log('Profile properties:', barberData?.properties);

        navigate('/complete-barber-profile', {
            state: {
                isEditing: true,
                profileData: barberData // Pass the complete profile data
            }
        });
    };

    console.log('Profile portfolio items:', portfolioData[id]);

    return (
        <div 
            className="bp-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {refreshing && (
                <div className="bp-refresh-indicator">
                    <div className="bp-refresh-spinner"></div>
                    <span>Refreshing...</span>
                </div>
            )}
            
            {/* Profile header with back button and title */}
            <header className="bp-header">
                <div className="bp-header-left">
                    <h1>{getProfessionName()}</h1>
                </div>
                <div ref={menuRef} style={{ position: 'relative' }}>
                    <button
                        className="bp-menu-button"
                        onClick={handleMenuToggle}
                    >
                        ⋮
                    </button>
                    {isMenuOpen && (
                        <div className="bp-menu-dropdown active">

                            <div
                                className="bp-menu-item"
                                onClick={() => {
                                    navigate('/settings');
                                    setIsMenuOpen(false);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.39-.29-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.23-.08-.49 0-.61.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.39.29.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.23.08.49 0 .61-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                                </svg>
                                Settings
                            </div>
                            <div
                                className="bp-menu-item"
                                onClick={() => {
                                    handleLogout();
                                    setIsMenuOpen(false);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                                </svg>
                                Logout
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Professional's basic information section */}
            <div className="bp-barber-info">
                <div className="bp-profile-picture">
                    {properties?.profile_image ? (
                        <img
                            src={getImageUrl(properties.profile_image)}
                            alt={`${barberName}'s profile`}
                            onError={(e) => {
                                console.error('Failed to load image:', e.target.src);
                                e.target.onerror = null;
                                const fallback = e.target.parentElement.querySelector('.fallback-initials');
                                if (fallback) fallback.style.display = 'flex';
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="fallback-initials">
                            {getInitials(barberName)}
                        </div>
                    )}
                </div>
                <div className="bp-text-container">
                    <h2 className="bp-name">
                        {barberName}
                    </h2>
                    <div className="bp-bio-info">
                        <p className="bp-bio-text">
                            {properties?.years_of_experience} years of experience
                        </p>
                        <p className="bp-bio-text">
                            Location: {getFormattedAddress(properties)}
                        </p>
                        <p className="bp-bio-text">
                            Specializing in: {properties?.services?.map(service => service.name).join(', ')}
                        </p>
                        <p className="bp-bio-text">
                            Price Range: ${properties?.price_range_min} - ${properties?.price_range_max}
                        </p>
                        <p className="bp-bio-text">
                            Average Rating: {formatRating(properties?.average_rating)} ⭐
                        </p>
                    </div>
                </div>
            </div>

            {/* Portfolio section */}
            <section className="bp-portfolio-section">
                <h3>Portfolio</h3>
                {portfolioData[id]?.length > 0 ? (
                    <div className="bp-portfolio-grid">
                        {[...portfolioData[id]]
                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                            .map((item, index) => (
                            <PortfolioCard
                                key={index}
                                    post={item}
                                navigate={navigate}
                                onDelete={handlePortfolioDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        className="bp-no-posts"
                        onClick={() => navigate(`/post-form/${id}`)}
                        style={{ cursor: 'pointer' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                        </svg>
                        <p>No posts yet</p>
                        <p className="bp-no-posts-subtitle">Click here to add your first portfolio post</p>
                    </div>
                )}
            </section>

            {/* Client reviews section */}
            <section className="bp-reviews-section">
                <div className="bp-section-header">
                    <h3>Client Reviews</h3>
                </div>
                {properties?.reviews?.length > 0 ? (
                    <div className="bp-review-cards">
                        {properties.reviews.map((review, index) => (
                            <div key={index} className="bp-review-card">
                                <div className="bp-reviewer-info">
                                    <div className="bp-reviewer-avatar"></div>
                                    <span className="bp-reviewer-name">
                                        {review.reviewer_name || 'Anonymous'}
                                    </span>
                                    <div className="rating">
                                        {'⭐'.repeat(review.rating)}
                                    </div>
                                </div>
                                <p className="review-text">{review.comment}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bp-no-reviews">
                        <p>No reviews yet</p>
                        {user?.id !== barber?.properties?.user_details?.id && (
                            <button
                                className="bp-add-review-button"
                                onClick={() => setIsReviewPopupOpen(true)}
                            >
                                Add First Review
                            </button>
                        )}
                    </div>
                )}
            </section>

            {user?.id !== barber?.properties?.user_details?.id && (
                <ReviewPopup
                    isOpen={isReviewPopupOpen}
                    onClose={() => setIsReviewPopupOpen(false)}
                    barberId={id}
                    onReviewSubmitted={handleReviewSubmitted}
                />
            )}

            {/* Navigation bar */}
            <nav className="bp-navigation-bar">
                <div className="bp-nav-item" onClick={() => navigate('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#666" width="24" height="24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                    <p>Home</p>
                </div>
                <div className="bp-nav-item" onClick={() => navigate(`/post-form/${id}`)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    <p>Post</p>
                </div>
                <div className="bp-nav-item" onClick={() => navigate(`/barber-dashboard/${id}`)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#666" width="24" height="24">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                    </svg>
                    <p>Dashboard</p>
                </div>
            </nav>

            {/* Footer */}
            <footer className="bp-app-footer">
                <p>&copy; 2024 SoloApp</p>
            </footer>
        </div>
    );
};

export default BarberProfile;