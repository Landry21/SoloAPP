import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/SearchScreen.css';
import UserTypeSelection from './UserTypeSelection';
import RollingText from './RollingText';
import { PROFESSIONAL_CATEGORIES } from '../config/professionalCategories';

// Fix for default marker icon
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

// Component to handle map center updates
function MapUpdater({ center, zoom, shouldRecenter }) {
    const map = useMap();
    
    useEffect(() => {
        if (shouldRecenter && center && map) {
            // Check if map is ready and has the required methods
            if (!map || !map.setView || !map.invalidateSize || !map.project) {
                console.warn('Map not ready for operations');
                return;
            }

            const viewportWidth = window.innerWidth;
            let adjustedZoom;
            if (viewportWidth <= 480) {
                adjustedZoom = 14;
            } else if (viewportWidth <= 768) {
                adjustedZoom = 14.5;
            } else {
                adjustedZoom = 15;
            }
            
            try {
            map.setView(center, adjustedZoom, {
                animate: true,
                duration: 0.5,
                pan: {
                    animate: true,
                    duration: 0.5
                }
            });
                
                // Delay the invalidateSize and panBy operations to ensure map is ready
            setTimeout(() => {
                    try {
                        // Check if map is still valid
                        if (!map || !map.invalidateSize || !map.project || !map.getSize) {
                            console.warn('Map no longer valid for operations');
                            return;
                        }
                        
                map.invalidateSize();
                        
                const mapSize = map.getSize();
                        if (!mapSize || !center) {
                            console.warn('Map size or center not available');
                    return;
                }
                        
                const centerPixel = map.project(center, map.getZoom());
                        if (!centerPixel) {
                            console.warn('Could not project center point');
                            return;
                        }
                        
                const containerCenter = L.point(mapSize.x / 2, mapSize.y / 2);
                const offset = containerCenter.subtract(centerPixel);
                        
                if (Math.abs(offset.x) < mapSize.x && Math.abs(offset.y) < mapSize.y) {
                    map.panBy([offset.x, offset.y], { animate: true, duration: 0.5 });
                } else {
                    console.warn('Offset too large, skipping panBy');
                        }
                    } catch (error) {
                        console.warn('Error in map operations:', error);
                }
            }, 500);
            } catch (error) {
                console.warn('Error setting map view:', error);
            }
        }
    }, [shouldRecenter, center, zoom, map]);
    
    return null;
}

// SearchScreen component - Main search interface component
// Purpose: Provides users with a comprehensive interface to search for and find professionals
// Features: Search bar, map display, and navigation bar
// Usage: Primary search page of the application
const SearchScreen = () => {
    const navigate = useNavigate();
    const [userLocation, setUserLocation] = useState(null);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [placeholderText, setPlaceholderText] = useState("Search by location or professional name");
    const [mapZoom, setMapZoom] = useState(12);
    const [searchRadius, setSearchRadius] = useState(5);
    const [selectedServices, setSelectedServices] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showUserTypeSelection, setShowUserTypeSelection] = useState(false);
    const [shouldRecenter, setShouldRecenter] = useState(false);
    const [currentProfessionalIndex, setCurrentProfessionalIndex] = useState(0);
    const [isMapReady, setIsMapReady] = useState(false);

    // Professional types for rolling text
    const professionalTypes = ['Barber', 'Hair Stylist', 'Nail Technician', 'Makeup Artist', 'Tattoo Artist'];

    // Default map center (NYC)
    const defaultCenter = [40.7128, -74.0060];
    const defaultZoom = 12;

    const clearError = () => {
        setError(null);
    };

    // Set map as ready after component mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMapReady(true);
        }, 100);
        
        return () => clearTimeout(timer);
    }, []);


    const getUserLocation = useCallback(() => {
        setIsLocating(true);
        console.log('Getting user location...');
        
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    console.log('Raw coordinates:', { latitude, longitude });
                    clearError(); // Only clear error on success
                    
                    try {
                        // Reverse geocode to get address with timeout
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
                        
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                            { signal: controller.signal }
                        );
                        clearTimeout(timeoutId);
                        
                        const data = await response.json();
                        console.log('Reverse geocoding response:', data);
                        
                        // Extract location name with better fallback logic
                        let locationName = 'your area';
                        
                        if (data.address) {
                            // Try different address components in order of preference
                            locationName = data.address.city || 
                                   data.address.town || 
                                   data.address.village || 
                                   data.address.suburb ||
                                         data.address.county ||
                                         data.address.state ||
                                         data.address.country ||
                                   'your area';
                        }
                        
                        // If we still have 'your area', try to extract from display_name
                        if (locationName === 'your area' && data.display_name) {
                            const parts = data.display_name.split(', ');
                            // Look for a meaningful location part (not postal codes, etc.)
                            for (let part of parts) {
                                if (part && !part.match(/^\d+$/) && part.length > 2 && part.length < 50) {
                                    locationName = part;
                                    break;
                                }
                            }
                        }
                        
                        console.log('Detected location:', locationName);

                        setUserLocation({
                            lat: latitude,
                            lng: longitude,
                            address: data.display_name,
                            city: locationName
                        });
                        console.log('Set user location:', { lat: latitude, lng: longitude, address: data.display_name });
                        setPlaceholderText(`${professionalTypes[currentProfessionalIndex]} in ${locationName}`);
                    } catch (error) {
                        console.error('Reverse geocoding error:', error);
                        // Try to get a basic location name from coordinates
                        let fallbackLocation = 'your area';
                        
                        try {
                            // Use a simpler reverse geocoding service as fallback
                            const fallbackController = new AbortController();
                            const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 3000); // 3 second timeout
                            
                            const fallbackResponse = await fetch(
                                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
                                { signal: fallbackController.signal }
                            );
                            clearTimeout(fallbackTimeoutId);
                            
                            const fallbackData = await fallbackResponse.json();
                            
                            if (fallbackData.locality) {
                                fallbackLocation = fallbackData.locality;
                            } else if (fallbackData.city) {
                                fallbackLocation = fallbackData.city;
                            } else if (fallbackData.countryName) {
                                fallbackLocation = fallbackData.countryName;
                            }
                        } catch (fallbackError) {
                            console.error('Fallback geocoding also failed:', fallbackError);
                        }
                        
                        // Still set location even if reverse geocoding fails
                        setUserLocation({
                            lat: latitude,
                            lng: longitude,
                            address: 'Current Location',
                            city: fallbackLocation
                        });
                        console.log('Set user location (without address):', { lat: latitude, lng: longitude });
                        setPlaceholderText(`${professionalTypes[currentProfessionalIndex]} in ${fallbackLocation}`);
                    }
                    setIsLocating(false);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    let errorMessage = 'Could not get your location. ';
                    
                    // More specific error messages based on error code
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Please enable location access in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            break;
                        default:
                            errorMessage += 'Please search manually.';
                    }
                    
                    setError(errorMessage);
                    setIsLocating(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000, // Increased timeout to 10 seconds
                    maximumAge: 0
                }
            );
        } else {
            console.error('Geolocation not supported');
            setError('Geolocation is not supported by your browser. Please search manually.');
            setIsLocating(false);
        }
    }, []);  // Empty dependency array since we don't use any external values

    // Get user location on component mount
    useEffect(() => {
        getUserLocation();
    }, [getUserLocation]);

    // Add this useEffect after userLocation is set
    useEffect(() => {
        if (userLocation) {
            setShouldRecenter(true);
        }
    }, [userLocation]);

    // Update professional type index and placeholder text
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentProfessionalIndex((prevIndex) => (prevIndex + 1) % professionalTypes.length);
        }, 2500);

        return () => clearInterval(interval);
    }, [professionalTypes.length]);

    // Update placeholder text when professional type changes
    useEffect(() => {
        if (userLocation) {
            const city = userLocation.city || 'your area';
            setPlaceholderText(`Try "fade in ${city}" or "curls near me"`);
        } else {
            setPlaceholderText(`Try "barbers in New York" or "hair stylists near me"`);
        }
    }, [currentProfessionalIndex, userLocation]);

    const handleSwitchUserType = () => {
        setShowUserTypeSelection(true);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        
        setIsSearching(true);
        try {
            // Parse the search query to extract search term and location
            const { searchTerm, location } = parseSearchQuery(searchQuery);
            
            console.log('Search query parsing:', {
                original: searchQuery,
                searchTerm,
                location
            });
            
            let searchLat = userLocation?.lat;
            let searchLng = userLocation?.lng;
            let searchLocation = userLocation?.city;
            
            // If location was found in the query, geocode it
            if (location) {
                const geocodedLocation = await geocodeLocation(location);
                if (geocodedLocation) {
                    searchLat = geocodedLocation.lat;
                    searchLng = geocodedLocation.lng;
                    searchLocation = geocodedLocation.city;
                    console.log('Geocoded location:', geocodedLocation);
                }
            }
            
            const params = new URLSearchParams({
                query: searchTerm,
                lat: searchLat,
                lng: searchLng,
                radius: searchRadius,
                category: selectedCategory?.id || ''
            });
            
            console.log('Search parameters:', params.toString());
            navigate(`/search-results?${params.toString()}`);
        } catch (error) {
            console.error('Search error:', error);
            setError('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    // Parse natural language search query
    const parseSearchQuery = (query) => {
        const lowerQuery = query.toLowerCase();
        let searchTerm = '';
        let location = '';
        
        // Common location indicators
        const locationIndicators = ['in', 'at', 'near', 'around', 'by'];
        
        // Find location indicator
        let locationIndex = -1;
        for (const indicator of locationIndicators) {
            const index = lowerQuery.indexOf(` ${indicator} `);
            if (index !== -1) {
                locationIndex = index;
                break;
            }
        }
        
        if (locationIndex !== -1) {
            // Extract search term (before location indicator)
            searchTerm = query.substring(0, locationIndex).trim();
            
            // Extract location (after location indicator)
            location = query.substring(locationIndex + 3).trim();
        } else {
            // No location indicator found, treat entire query as search term
            searchTerm = query.trim();
        }
        
        // Clean up search term (remove common words that might be confused with location indicators)
        const commonWords = ['barber', 'barbers', 'hair', 'stylist', 'stylists', 'professional', 'professionals'];
        const searchWords = searchTerm.split(' ');
        const filteredWords = searchWords.filter(word => 
            !commonWords.includes(word.toLowerCase()) || searchWords.length === 1
        );
        searchTerm = filteredWords.join(' ');
        
        return { searchTerm, location };
    };

    // Geocode a location string
    const geocodeLocation = async (locationString) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationString)}&limit=1`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
                const location = data[0];
                return {
                    lat: parseFloat(location.lat),
                    lng: parseFloat(location.lon),
                    city: location.name || location.display_name.split(',')[0],
                    address: location.display_name
                };
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
        return null;
    };

    const handleProfessionalClick = (professionalId) => {
        navigate(`/barber-profile/${professionalId}`);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleLocationClick = () => {
        if (userLocation) {
            const viewportWidth = window.innerWidth;
            let zoomLevel;
            if (viewportWidth <= 480) {
                zoomLevel = 14;
            } else if (viewportWidth <= 768) {
                zoomLevel = 14.5;
            } else {
                zoomLevel = 15;
            }
            setUserLocation({
                lat: userLocation.lat,
                lng: userLocation.lng,
                address: userLocation.address,
                timestamp: Date.now()
            });
            setMapZoom(zoomLevel);
            setShouldRecenter(true); // Only recenter on explicit user request
        } else {
            getUserLocation();
        }
    };

    // After recentering, reset shouldRecenter to false so it doesn't recenter on unrelated state changes
    useEffect(() => {
        if (shouldRecenter) {
            setShouldRecenter(false);
        }
    }, [shouldRecenter]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showUserTypeSelection) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }

        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [showUserTypeSelection]);

    return (
        // Main container for the search screen
        // Contains all search-related components and features
        <div className="search-screen">
            {/* Header section containing the main title and subtitle */}
            <header className="search-header">
                <div className="header-left">
                    <h1 className="search-title">
                        Find the Best {professionalTypes[currentProfessionalIndex]}
                    </h1>
                </div>
                <div className="header-right">
                    <button 
                        onClick={handleSwitchUserType} 
                        className="switch-user-button"
                    >
                        Switch User Type
                    </button>
                </div>
            </header>

            {/* Search input section */}
            {/* Contains search input field and search button with icon */}
            <div className="search-bar">
                {/* Text input for user queries */}
                <input
                    type="text"
                    placeholder={isLocating ? "Getting your location..." : placeholderText}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (error && e.target.value.trim()) {
                            clearError(); // Clear error when user starts typing
                        }
                    }}
                    onKeyPress={handleKeyPress}
                    aria-label="Search professionals"
                    disabled={isSearching || isLocating}
                />
                {/* Search button with SVG icon */}
                <button
                    className="search-button"
                    onClick={handleSearch}
                    aria-label="Search"
                    disabled={isSearching || isLocating}
                >
                    <i className={`fas ${isSearching || isLocating ? 'fa-spinner fa-spin' : 'fa-search'}`}></i>
                </button>
            </div>

            {error && (
                <div className="search-error">
                    {error}
                    <button 
                        className="error-close-button" 
                        onClick={clearError}
                        aria-label="Close error message"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Category filter section */}
            <div className="category-filter">
                <h3>Filter by Professional Type</h3>
                <select 
                    className="professional-type-dropdown"
                    value={selectedCategory?.id || ''}
                    onChange={(e) => {
                        const categoryId = e.target.value;
                        const category = categoryId ? Object.values(PROFESSIONAL_CATEGORIES).find(cat => cat.id === parseInt(categoryId)) : null;
                        setSelectedCategory(category);
                        // Remove focus to make blue highlighting go away
                        e.target.blur();
                    }}
                >
                    <option value="">All Professionals</option>
                    {Object.values(PROFESSIONAL_CATEGORIES).map(category => (
                        <option key={category.id} value={category.id}>
                            {category.name}s
                        </option>
                    ))}
                </select>
            </div>

            {/* Map container section */}
            {/* Will be used to display interactive map with professional locations */}
            <div className="map-container">
                <button
                    className="map-location-button"
                    onClick={handleLocationClick}
                    aria-label="Get current location"
                    disabled={isLocating}
                >
                    <i className={`fas ${isLocating ? 'fa-spinner fa-spin' : 'fa-location-dot'}`}></i>
                </button>
                {/* Only render MapContainer when the container is ready */}
                {isMapReady ? (
                <MapContainer
                    center={defaultCenter}
                    zoom={defaultZoom}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                    attributionControl={true}
                    maxZoom={20}
                    minZoom={3}
                        whenReady={() => {
                            console.log('Map is ready');
                        }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapUpdater 
                        center={userLocation ? [userLocation.lat, userLocation.lng] : null}
                        zoom={mapZoom}
                        shouldRecenter={shouldRecenter}
                    />
                </MapContainer>
                ) : (
                    <div style={{ 
                        height: '100%', 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: '#f5f5f5',
                        color: '#666'
                    }}>
                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                        Loading map...
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="ss-app-footer">
                <p>&copy; 2024 SoloApp</p>
            </footer>

            {/* Add UserTypeSelection component */}
            {showUserTypeSelection && (
                <UserTypeSelection 
                    onSelect={() => setShowUserTypeSelection(false)} 
                />
            )}
        </div>
    );
};

// Export the SearchScreen component for use in other parts of the application
export default SearchScreen;