// PublicBarberProfile Component
// Purpose: Public, read-only view of a barber's profile and portfolio
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { barbers, reviews } from '../services/api';
import { usePortfolio } from '../contexts/PortfolioContext';
import { useAuth } from '../contexts/AuthContext';
import '../styles/BarberProfile.css';
import ReactDOM from 'react-dom';

const barberFetcher = async (barberId) => {
    const response = await barbers.getById(barberId);
    return response.data;
};

const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return imagePath.startsWith('http')
        ? imagePath
        : `http://127.0.0.1:8000${imagePath}`;
};

const ReviewPopup = ({ isOpen, onClose, barberId, barberName, onReviewSubmitted }) => {
    const [comment, setComment] = useState('');
    const [rating, setRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    // Reset form when popup closes
    useEffect(() => {
        if (!isOpen) {
            setComment('');
            setRating(0);
        }
    }, [isOpen]);

    const handleStarClick = (starRating) => {
        // If clicking the same star or a lower star, unselect that specific star
        // If clicking a higher star, select that rating
        if (rating >= starRating) {
            setRating(starRating - 1);
        } else {
            setRating(starRating);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!comment.trim()) {
            alert('Please enter a review');
            return;
        }
        if (rating === 0) {
            alert('Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            await reviews.create(barberId, { rating, comment });
            setComment('');
            setRating(0);
            onReviewSubmitted();
            onClose();
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="bp-review-popup-overlay" onClick={onClose}>
            <div className="bp-review-popup" onClick={(e) => e.stopPropagation()}>
                <div className="bp-review-popup-header">
                    <h3>Review {barberName}</h3>
                    <button className="bp-review-close-button" onClick={onClose}>×</button>
                </div>
                <form className="bp-review-form" onSubmit={handleSubmit}>
                    <div className="bp-rating-input">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className={`bp-star-button ${rating >= star ? 'active' : ''}`}
                                onClick={() => handleStarClick(star)}
                                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="bp-review-textarea"
                        placeholder="Write your review..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows="4"
                        required
                    />
                    <button
                        type="submit"
                        className="bp-submit-review-button"
                        disabled={submitting}
                    >
                        {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </form>
            </div>
        </div>
    );
};

function Toast({ message, visible }) {
    return (
        <div
            style={{
                position: 'fixed',
                left: '50%',
                bottom: '40px',
                transform: 'translateX(-50%)',
                background: 'rgba(60,60,60,0.95)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '24px',
                fontSize: '16px',
                opacity: visible ? 1 : 0,
                pointerEvents: 'none',
                transition: 'opacity 0.3s',
                zIndex: 9999,
            }}
        >
            {message}
        </div>
    );
}

function MenuDropdown({ anchorRef, open, children }) {
    const [coords, setCoords] = React.useState({ top: 0, left: 0 });
    const menuRef = React.useRef(null);
    React.useEffect(() => {
        if (open && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top + window.scrollY - 8, // Menu's top is 8px above the button's top
                left: rect.right + window.scrollX - 180, // align right edge, adjust width as needed
            });
        }
    }, [open, anchorRef]);
    if (!open) return null;
    return ReactDOM.createPortal(
        <div ref={menuRef} className="bp-portfolio-menu-dropdown" style={{ position: 'absolute', top: coords.top, left: coords.left, zIndex: 99999, pointerEvents: 'auto', background: 'white' }}>
            {children}
        </div>,
        document.body
    );
}

const PortfolioCard = ({ post, barberId, onShowToast }) => {
    const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
    const [imageError, setImageError] = React.useState(false);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const images = post.is_group_post ? post.group_images : [{ image: post.image }];
    const hasMultipleImages = post.is_group_post ? post.group_images.length > 1 : false;
    const currentImage = images[currentImageIndex]?.image;
    // Swipe handlers
    const [touchStartX, setTouchStartX] = React.useState(null);
    const [touchEndX, setTouchEndX] = React.useState(null);
    const handleTouchStart = (e) => setTouchStartX(e.targetTouches[0].clientX);
    const handleTouchMove = (e) => setTouchEndX(e.targetTouches[0].clientX);
    const handleTouchEnd = () => {
        if (touchStartX === null || touchEndX === null) return;
        const distance = touchStartX - touchEndX;
        if (Math.abs(distance) > 50) {
            if (distance > 0) {
                setCurrentImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
                setImageError(false);
            } else {
                setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
                setImageError(false);
            }
        }
        setTouchStartX(null);
        setTouchEndX(null);
    };

    const handleMenuToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    const handleShare = () => {
        console.log('Share clicked');
        setIsMenuOpen(false);
        const shareUrl = `${window.location.origin}/public-barber/${barberId}?post=${post.id}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            onShowToast();
            if (navigator.share) {
                navigator.share({
                    title: 'Check out this barber work',
                    text: post.description,
                    url: shareUrl
                }).catch(console.error);
            }
        }).catch((err) => {
            alert('Failed to copy link: ' + (err && err.message ? err.message : 'Unknown error'));
        });
    };

    const handleReport = () => {
        setIsMenuOpen(false);
        // Report functionality - can be implemented with a report modal or API call
        alert('Report functionality coming soon!');
    };

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isMenuOpen &&
                !event.target.closest('.bp-portfolio-menu') &&
                !event.target.closest('.bp-portfolio-menu-dropdown')
            ) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);
    const menuButtonRef = React.useRef(null);
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
                    <div>
                        <p className="bp-portfolio-caption">
                            {post.description}
                        </p>
                        <p className="bp-portfolio-date">
                            {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'long', day: 'numeric'
                            }) : ''}
                        </p>
                    </div>
                    <div className="bp-portfolio-menu">
                        <button
                            ref={menuButtonRef}
                            className="bp-portfolio-menu-button"
                            onClick={handleMenuToggle}
                            aria-label="More options"
                        >
                            ⋮
                        </button>
                        <MenuDropdown anchorRef={menuButtonRef} open={isMenuOpen}>
                            <button className="bp-portfolio-menu-item" onClick={handleShare} type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                                </svg>
                                Share
                            </button>
                            <button className="bp-portfolio-menu-item" onClick={handleReport} type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
                                </svg>
                                Report
                            </button>
                        </MenuDropdown>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PublicBarberProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { portfolioData, loading: portfolioLoading, fetchPortfolio } = usePortfolio();
    const { user } = useAuth();
    const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);
    const [toastVisible, setToastVisible] = useState(false);
    
    // Fetch barber data
    const { data: barberData, error: barberError, mutate: mutateReviews } = useSWR(
        id ? id : null,
        barberFetcher
    );
    
    useEffect(() => {
        if (id) {
            fetchPortfolio(id);
        }
    }, [id, fetchPortfolio]);
    
    if (!barberData || portfolioLoading[id]) {
        return <div className="loading">Loading profile...</div>;
    }
    
    if (barberError) {
        return (
            <div className="error-container">
                <div className="error-message">
                    {barberError?.message || 'An error occurred'}
                </div>
                <button className="back-button" onClick={() => navigate(-1)}>
                    Go Back
                </button>
            </div>
        );
    }
    
    const { properties } = barberData;
    const barberName = properties?.user_details ?
        `${properties.user_details.first_name} ${properties.user_details.last_name}`.trim() :
        'Barber';
    
    const getInitials = (name) => {
        if (!name) return '';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
    };
    
    const formatRating = (rating) => {
        if (rating === null || rating === undefined) return "0.0";
        const numRating = parseFloat(rating);
        return isNaN(numRating) ? "0.0" : numRating.toFixed(1);
    };
    
    const getFormattedAddress = (properties) => {
        if (!properties) return 'Not specified';
        if (properties.geometry && properties.geometry.coordinates) {
            return properties.formatted_address || properties.address || 'Location set but address not specified';
        }
        return properties.formatted_address || properties.address || 'Not specified';
    };
    
    const handleBooking = () => {
        navigate(`/booking/${id}`);
    };
    
    const handleReviewSubmitted = async () => {
        // Refresh reviews data
        await mutateReviews();
    };
    
    const hasPhoneNumber = properties?.phone_number && properties.phone_number.trim() !== '';
    
    // Debug logging
    console.log('PublicBarberProfile Debug:', {
        user: user,
        properties: properties,
        userDetails: properties?.user_details,
        reviews: properties?.reviews,
        reviewsLength: properties?.reviews?.length,
        isReviewPopupOpen: isReviewPopupOpen
    });
    
    return (
        <div className="bp-container">
            {/* Profile header with back button and title */}
            <header className="bp-header">
                <div className="bp-header-left">
                    <button className="bp-back-button" onClick={() => navigate(-1)}>&larr;</button>
                    <h1>Barber's Profile</h1>
                </div>
            </header>
            
            {/* Barber's basic information section */}
            <div className="bp-barber-info">
                <div className="bp-profile-picture">
                    {properties?.profile_image ? (
                        <img
                            src={getImageUrl(properties.profile_image)}
                            alt={`${barberName}'s profile`}
                            onError={(e) => {
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
            
            {/* Action buttons for contacting and booking */}
            <div className="bp-action-buttons">
                <button 
                    className="bp-call-button" 
                    disabled={!hasPhoneNumber}
                    onClick={() => hasPhoneNumber && window.open(`tel:${properties.phone_number}`)}
                >
                    Call Barber
                </button>
                <button className="bp-book-button" onClick={handleBooking}>
                    Book Appointment
                </button>
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
                                    barberId={id}
                                    onShowToast={() => {
                                        setToastVisible(true);
                                        setTimeout(() => setToastVisible(false), 2000);
                                    }}
                                />
                            ))}
                    </div>
                ) : (
                    <div className="bp-no-posts">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                        </svg>
                        <p>No posts yet</p>
                    </div>
                )}
            </section>
            
            {/* Client reviews section */}
            <section className="bp-reviews-section">
                <div className="bp-section-header">
                    <h3>Client Reviews</h3>
                    <button
                        className="bp-add-review-button"
                        onClick={() => setIsReviewPopupOpen(true)}
                    >
                        Add Review
                    </button>
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
                    </div>
                )}
            </section>
            
            <ReviewPopup
                isOpen={isReviewPopupOpen}
                onClose={() => setIsReviewPopupOpen(false)}
                barberId={id}
                barberName={barberName}
                onReviewSubmitted={handleReviewSubmitted}
            />
            <Toast message="Link copied" visible={toastVisible} />
            
            {/* CHANGED: Added standardized footer with proper CSS class for consistency */}
            <footer className="bp-app-footer">
                <p>&copy; 2024 SoloApp</p>
            </footer>
        </div>
    );
};

export default PublicBarberProfile; 