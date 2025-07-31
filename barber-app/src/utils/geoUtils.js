/**
 * Utility functions for handling GeoJSON and location operations
 */

// Extract profile data from GeoJSON structure
export const extractProfileData = (geoJsonProfile) => {
    if (!geoJsonProfile) return null;

    const { id, properties = {}, geometry = {}, services = [] } = geoJsonProfile;
    return {
        id,
        profile_image: properties.profile_image || null,
        years_of_experience: properties.years_of_experience || 0,
        bio: properties.bio || '',
        services: services.length > 0 ? services : (properties.services || []),
        working_hours: properties.working_hours || {},
        coordinates: geometry.coordinates || null,
        address: properties.formatted_address || '',
        // Add any other profile fields here
    };
};

// Check if profile is complete
export const isProfileComplete = (geoJsonProfile) => {
    if (!geoJsonProfile) return false;

    const { properties = {}, geometry = {}, services = [] } = geoJsonProfile;
    
    // Check services in both possible locations and formats
    const hasServicesInProperties = Array.isArray(properties.services) && properties.services.length > 0;
    const hasServicesDirectly = Array.isArray(services) && services.length > 0;
    
    // Check working hours in both array and object format
    const hasWorkingHoursArray = Array.isArray(properties.working_hours) && 
                                properties.working_hours.length > 0 &&
                                properties.working_hours.some(hours => hours.start_time && hours.end_time);
                                
    const hasWorkingHoursObject = properties.working_hours && 
                                 typeof properties.working_hours === 'object' &&
                                 Object.keys(properties.working_hours).some(day => {
                                     const hours = properties.working_hours[day];
                                     return hours && 
                                            ((hours.start && hours.end) || 
                                             (hours.start_time && hours.end_time));
                                 });

    // Check address in both possible locations
    const hasAddress = !!properties.address || !!properties.formatted_address;
    
    const checks = {
        hasProfilePhoto: !!properties.profile_image,
        hasExperience: properties.years_of_experience > 0,
        hasLocation: geometry.type === 'Point' && 
                    Array.isArray(geometry.coordinates) && 
                    geometry.coordinates.length === 2,
        hasServices: hasServicesInProperties || hasServicesDirectly,
        hasWorkingHours: hasWorkingHoursArray || hasWorkingHoursObject,
        hasAddress: hasAddress
    };

    // Log the detailed check results
    console.log('Profile completion checks:', {
        profile: properties,
        geometry,
        services,
        checks,
        isComplete: Object.values(checks).every(Boolean)
    });

    return checks;
};

// Calculate distance between two points in kilometers
export const calculateDistance = (coords1, coords2) => {
    if (!coords1 || !coords2) return null;

    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// Format distance for display
export const formatDistance = (distance) => {
    if (distance === null) return 'Distance unknown';
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
};

// Create GeoJSON point from coordinates
export const createGeoJsonPoint = (longitude, latitude, properties = {}) => ({
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
    },
    properties
});

// Get human-readable location info
export const getLocationInfo = (geoJsonProfile) => {
    if (!geoJsonProfile?.properties?.formatted_address) {
        return 'Location not set';
    }
    return geoJsonProfile.properties.formatted_address;
};

// Check if coordinates are valid
export const isValidCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
    const [longitude, latitude] = coordinates;
    return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}; 