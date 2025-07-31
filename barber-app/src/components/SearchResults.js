// SearchResults Component
// Purpose: Displays search results for nearby barbers
// Features: Shows barber cards with images and booking options
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { barbers } from '../services/api';
import '../styles/SearchResults.css';

function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const SearchResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const [portfolioImages, setPortfolioImages] = useState({});
    const [currentImageIndexes, setCurrentImageIndexes] = useState({});
    const searchParams = new URLSearchParams(location.search);
    const [searchInput, setSearchInput] = useState('');
    const searchTerm = searchParams.get('query') || '';
    const userLat = parseFloat(searchParams.get('lat'));
    const userLng = parseFloat(searchParams.get('lng'));

    console.log('DEBUG: SearchResults component rendered, initial results:', results);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const searchParams = new URLSearchParams(location.search);
                const params = {
                    query: searchParams.get('query'),
                    lat: searchParams.get('lat'),
                    lng: searchParams.get('lng'),
                    radius: searchParams.get('radius'),
                    category: searchParams.get('category'),
                };

                // Debug log
                console.log('Fetching with params:', params);

                const response = await barbers.getAll(params);
                
                // Debug log
                console.log('API Response:', response);

                if (response && response.data) {
                    setResults(response.data.features || []);
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (err) {
                console.error('Error details:', {
                    message: err.message,
                    response: err.response?.data,
                    status: err.response?.status
                });
                
                if (err.response?.status === 404) {
                    setError('No professionals found. Please try different search criteria.');
                } else if (err.response?.status === 500) {
                    setError('Server error. Please try again later.');
                } else if (!err.response) {
                    setError('Network error. Please check your connection and try again.');
                } else {
                    setError('Failed to fetch results. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [location.search]);

    useEffect(() => {
        console.log('DEBUG: useEffect triggered with results:', results);
        if (!results.length) return;
        const fetchPortfolios = async () => {
            const newImages = {};
            await Promise.all(results.map(async (barber) => {
                console.log('DEBUG: Fetching portfolio for barberId:', barber.id);
                try {
                    const response = await barbers.getPortfolio(barber.id);
                    console.log('DEBUG: Portfolio response for barberId:', barber.id, response.data);
                    newImages[barber.id] = response.data.results || [];
                } catch (e) {
                    console.error('DEBUG: Error fetching portfolio for barberId:', barber.id, e);
                    newImages[barber.id] = [];
                }
            }));
            setPortfolioImages(newImages);
            console.log('DEBUG: Updated portfolioImages:', newImages);
        };
        fetchPortfolios();
    }, [results]);

    const handleBooking = (barberId) => {
        navigate(`/booking/${barberId}`);
    };

    const handleViewProfile = (barberId) => {
        navigate(`/public-barber/${barberId}`);
    };

    const handleSearch = () => {
        const params = new URLSearchParams({
            query: searchInput,
            lat: userLat,
            lng: userLng,
            radius: 5, // default radius
            category: searchParams.get('category') || ''
        });
        navigate(`/search-results?${params.toString()}`);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Get the profession name for the header based on search results
    const getProfessionName = () => {
        if (!results || results.length === 0) {
            return 'Professionals';
        }

        // Check if all results have the same category
        const categories = results
            .map(barber => barber.properties?.category?.name)
            .filter(Boolean); // Remove undefined/null values

        if (categories.length === 0) {
            return 'Professionals';
        }

        // If all have the same category, use that
        const uniqueCategories = [...new Set(categories)];
        if (uniqueCategories.length === 1) {
            const professionName = uniqueCategories[0].charAt(0).toUpperCase() + 
                                 uniqueCategories[0].slice(1).toLowerCase();
            return professionName + 's'; // Add 's' for plural
        }

        // If mixed categories, use a generic term
        return 'Professionals';
    };

    if (loading) {
        return (
            <div className="sr-container">
            <div className="search-results-container">
                                    <div className="loading">
                        <div className="loading-spinner"></div>
                        Loading professionals...
                        </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sr-container">
            <div className="search-results-container">
                <div className="error-message">
                    <h3>Error</h3>
                    <p>{error}</p>
                    <button 
                        className="retry-button"
                        onClick={() => window.location.reload()}
                    >
                        Try Again
                    </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!results || results.length === 0) {
        return (
            <div className="sr-container">
            <div className="search-results-container">
                <div className="no-results">
                        <h3>No Results Found{searchTerm ? ` for "${searchTerm}"` : ''}</h3>
                    <p>No professionals found matching your criteria. Please try different search terms.</p>
                    <button 
                        className="back-button"
                        onClick={() => navigate('/search')}
                    >
                        Back to Search
                    </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sr-container">
        <div className="search-results-container">
                <div className="search-bar-wrapper">
                    <input
                        className="results-search-bar"
                        type="text"
                        placeholder="Search for professionals"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <button 
                        className="results-search-bar-btn" 
                        onClick={handleSearch}
                    >
                        <i className="fas fa-search"></i>
                    </button>
                </div>
                <h2>Recommended {getProfessionName()} Near You for "{searchTerm}"</h2>
            <div className="results-grid">
                    {results.map((barber) => {
                        const props = barber.properties || {};
                        const user = props.user_details || {};
                        const barberId = props.id || barber.id;
                        const hasPhoneNumber = props.phone_number && props.phone_number.trim() !== '';
                        // DEBUG: Log the full barber and props objects
                        console.log('DEBUG barber:', barber);
                        console.log('DEBUG props:', props);
                        // DEBUG: Check for portfolio images/posts array
                        console.log('DEBUG portfolio_images:', props.portfolio_images);
                        console.log('DEBUG portfolio_posts:', props.portfolio_posts);
                        // CHANGED: Use barber.geometry.coordinates for distance
                        const coords = barber.geometry && Array.isArray(barber.geometry.coordinates) ? barber.geometry.coordinates : null;
                        return (
                            <div key={barberId} className="barber-card">
                                <div
                                    className="barber-card-header"
                                    onClick={() => handleViewProfile(barberId)}
                                    tabIndex={0}
                                    role="button"
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="barber-profile-pic">
                                        {props.profile_image ? (
                                <img 
                                                src={props.profile_image} 
                                                alt={`${user.first_name || 'Barber'} ${user.last_name || ''}`} 
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/placeholder-profile.png';
                                    }}
                                />
                            ) : (
                                            <div className="profile-placeholder">
                                                {user.first_name?.[0] || ''}{user.last_name?.[0] || ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="barber-card-info">
                                        <div className="barber-card-title">{user.first_name || 'Barber'} {user.last_name || ''}</div>
                                        {props.years_of_experience && (
                                            <div className="barber-card-summary">{props.years_of_experience} years of experience</div>
                                        )}
                                        <div className="barber-card-summary">
                                            {(() => {
                                                console.log('Distance debug:', { userLat, userLng, coords });
                                                if (userLat != null && userLng != null && coords && coords.length === 2) {
                                                    const distanceKm = haversineDistance(userLat, userLng, coords[1], coords[0]);
                                                    const distanceMi = distanceKm * 0.621371; // CHANGED: convert km to miles
                                                    return `${distanceMi.toFixed(2)} mi away`;
                                                }
                                                return 'Distance not available';
                                            })()}
                                        </div>
                                        {props.price_range_min && props.price_range_max && (
                                            <div className="barber-card-summary">Price Range: ${props.price_range_min} - ${props.price_range_max}</div>
                                        )}
                                        {props.average_rating !== undefined && (
                                            <div className="barber-card-summary">Average Rating: {props.average_rating} ★</div>
                                        )}
                                    </div>
                                </div>
                                <div className="barber-card-latest">
                                    <span className="latest-haircut-label">Latest Work</span>
                                    <div className="latest-haircut-img-grid">
                                        {(() => {
                                            // Gather and sort posts (single/group), newest first
                                            const posts = (portfolioImages[barberId] || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                            let displayPosts = [];
                                            for (let post of posts) {
                                                if (displayPosts.length === 3) break;
                                                if (post.is_group_post && post.group_images && post.group_images.length > 0) {
                                                    displayPosts.push({
                                                        type: 'group',
                                                        image: post.group_images[0].image,
                                                        count: post.group_images.length,
                                                        post
                                                    });
                                                } else if (!post.is_group_post && post.image) {
                                                    displayPosts.push({
                                                        type: 'single',
                                                        image: post.image,
                                                        count: 1,
                                                        post
                                                    });
                                                }
                                            }
                                            if (displayPosts.length === 0) {
                                                return <div className="latest-haircut-empty">No recent activity</div>;
                                            }
                                            // Track current post index per barber
                                            const currentPostIdx = currentImageIndexes[barberId] || 0;
                                            const setPostIndex = idx => setCurrentImageIndexes(prev => ({ ...prev, [barberId]: idx }));
                                            const handlePrev = e => {
                                                e.stopPropagation();
                                                setPostIndex(currentPostIdx > 0 ? currentPostIdx - 1 : displayPosts.length - 1);
                                            };
                                            const handleNext = e => {
                                                e.stopPropagation();
                                                setPostIndex(currentPostIdx < displayPosts.length - 1 ? currentPostIdx + 1 : 0);
                                            };
                                            // Touch/swipe support
                                            let touchStartX = null;
                                            let touchEndX = null;
                                            const onTouchStart = e => { touchStartX = e.targetTouches[0].clientX; };
                                            const onTouchMove = e => { touchEndX = e.targetTouches[0].clientX; };
                                            const onTouchEnd = () => {
                                                if (touchStartX === null || touchEndX === null) return;
                                                const distance = touchStartX - touchEndX;
                                                if (Math.abs(distance) > 50) {
                                                    if (distance > 0) handleNext({ stopPropagation: () => {} });
                                                    else handlePrev({ stopPropagation: () => {} });
                                                }
                                                touchStartX = null;
                                                touchEndX = null;
                                            };
                                            const item = displayPosts[currentPostIdx];
                                            return (
                                                <div className="latest-haircut-instagram-wrapper">
                                                    <div
                                                        className="latest-haircut-photo-wrapper"
                                                        onTouchStart={onTouchStart}
                                                        onTouchMove={onTouchMove}
                                                        onTouchEnd={onTouchEnd}
                                                    >
                                                        {displayPosts.length > 1 && (
                                                            <button
                                                                className="latest-haircut-arrow left"
                                                                onClick={handlePrev}
                                                                aria-label="Previous post"
                                                                disabled={displayPosts.length <= 1}
                                                            >&#8249;</button>
                                                        )}
                                                        <img
                                                            src={item.image}
                                                            alt={item.type === 'group' ? `Group post image 1 of ${item.count}` : 'Post image'}
                                                            loading="lazy"
                                                        />
                                                        {displayPosts.length > 1 && (
                                                            <button
                                                                className="latest-haircut-arrow right"
                                                                onClick={handleNext}
                                                                aria-label="Next post"
                                                                disabled={displayPosts.length <= 1}
                                                            >&#8250;</button>
                            )}
                        </div>
                                                    {displayPosts.length > 1 && (
                                                        <div className="latest-haircut-dots">
                                                            {displayPosts.map((_, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    className={`latest-haircut-dot${idx === currentPostIdx ? ' active' : ''}`}
                                                                    onClick={e => { e.stopPropagation(); setPostIndex(idx); }}
                                                                    aria-label={`Go to post ${idx + 1}`}
                                                                />
                                                            ))}
                                                        </div>
                                )}
                            </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {/* Show the caption for the current post only, in place of the old testimonial/hashtag */}
                                {(() => {
                                    const posts = (portfolioImages[barberId] || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                    let displayPosts = [];
                                    for (let post of posts) {
                                        if (displayPosts.length === 3) break;
                                        if (post.is_group_post && post.group_images && post.group_images.length > 0) {
                                            displayPosts.push({ post });
                                        } else if (!post.is_group_post && post.image) {
                                            displayPosts.push({ post });
                                        }
                                    }
                                    if (displayPosts.length === 0) return null;
                                    const currentPostIdx = currentImageIndexes[barberId] || 0;
                                    const currentPost = displayPosts[currentPostIdx]?.post;
                                    return (
                                        <>
                                            <div className="barber-card-testimonial">
                                                {currentPost?.description || ''}
                                            </div>
                                            {currentPost?.created_at && (
                                                <div className="barber-card-hashtag">
                                                    {new Date(currentPost.created_at).toLocaleDateString('en-US', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                <div className="barber-card-actions">
                                    <button className="call-barber-btn" disabled={!hasPhoneNumber} onClick={() => hasPhoneNumber && window.open(`tel:${props.phone_number}`)}>
                                        Call Professional
                                </button>
                                    <button className="book-appointment-btn" onClick={() => handleBooking(barberId)}>
                                        Book Here
                                </button>
                            </div>
                        </div>
                        );
                    })}
                    </div>
            </div>
            
            {/* CHANGED: Added standardized footer with proper CSS class for consistency */}
            <footer className="sr-app-footer">
                <p>&copy; 2024 SoloApp</p>
            </footer>
        </div>
    );
};

export default SearchResults;