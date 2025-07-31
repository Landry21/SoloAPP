import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { auth, barbers } from '../services/api';

const AuthContext = createContext(null);

// Helper function to check profile completion
const checkProfileCompletion = (profileData) => {
    console.log('=== Profile Completion Check ===');
    console.log('Raw profile data:', profileData);

    if (!profileData || !profileData.properties) {
        console.log('❌ Missing profile data or properties object');
        return false;
    }
    
    const { properties, geometry } = profileData;
    console.log('Properties object:', properties);
    console.log('Geometry object:', geometry);

    const requiredFields = {
        profile_image: !!properties.profile_image, // Optional
        years_of_experience: !!properties.years_of_experience,
        working_hours: !!properties.working_hours,
        services: !!properties.services,
        geometry: !!(geometry && geometry.coordinates)
    };

    console.log('Required fields status:');
    Object.entries(requiredFields).forEach(([field, exists]) => {
        console.log(`${exists ? '✅' : '❌'} ${field}: ${exists}`);
    });

    const isComplete = !!(
        properties.years_of_experience &&
        properties.working_hours &&
        properties.services &&
        geometry?.coordinates  // Check geometry at root level
    );

    console.log('Final completion status:', isComplete);
    return isComplete;
};

// SWR fetcher function
const fetcher = async (url) => {
    try {
        const barberId = url.split('/').pop();
        const response = await barbers.getById(barberId);
        return response.data;
    } catch (error) {
        console.error('Fetcher error:', error);
        throw error;
    }
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initialProfileData, setInitialProfileData] = useState(null);
    const [error, setError] = useState(null);
    const initialized = useRef(false);

    // SWR configuration for subsequent profile updates
    const { data: profileData, error: profileError, mutate: mutateProfile } = useSWR(
        () => user?.professionalId ? `/barbers/${user.professionalId}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 30000,
            keepPreviousData: true,
            fallbackData: initialProfileData,
            onError: (error) => {
                console.error('Error fetching profile:', error);
                setError(error.message);
            }
        }
    );

    // Initialize auth state
    useEffect(() => {
        if (initialized.current) return;
        
        const initializeAuth = async () => {
            try {
                console.log('Initializing auth state...');
                const token = localStorage.getItem('token');
                const userData = localStorage.getItem('user');

                if (token && userData) {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);

                    if (parsedUser.professionalId) {
                        try {
                            const response = await barbers.getById(parsedUser.professionalId);
                            setInitialProfileData(response.data);
                        } catch (error) {
                            console.error('Error fetching initial profile:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                setError(error.message);
            } finally {
                setLoading(false);
                initialized.current = true;
            }
        };

        initializeAuth();
    }, []);

    const login = async (credentials) => {
        try {
            console.log('AuthContext: Attempting login...');
            
            // Clear any stale state before attempting login
            setError(null);
            setUser(null);
            setInitialProfileData(null);
            
            // Clear any stale tokens that might interfere
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
                console.log('AuthContext: Clearing stale token before new login attempt');
                localStorage.removeItem('token');
            }
            
            const response = await auth.login(credentials);
            console.log('AuthContext: Login response received:', response);

            if (!response || !response.data) {
                throw new Error('Invalid login response');
            }

            const { token, ...userData } = response.data;
            console.log('AuthContext: Extracted user data:', userData);

            localStorage.setItem('token', token);

            if (userData.is_professional) {
                console.log('AuthContext: Processing professional login...');
                
                const professionalId = userData.professional_id;
                if (!professionalId) {
                    throw new Error('No professional ID found in response');
                }
                
                console.log('AuthContext: Found professional ID:', professionalId);
                
                userData.professionalId = professionalId;
                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('professionalId', professionalId);
                setUser(userData);

                try {
                // Fetch fresh profile data immediately
                    console.log('AuthContext: Fetching profile data...');
                    const profileResponse = await barbers.getById(professionalId);
                const freshProfileData = profileResponse.data;
                    console.log('AuthContext: Profile data fetched successfully:', freshProfileData);
                
                // Check if account is paused and automatically unpause if needed
                if (freshProfileData.properties?.is_paused) {
                    console.log('AuthContext: Account is paused, automatically unpausing...');
                    try {
                        await barbers.unpauseAccount();
                        console.log('AuthContext: Account automatically unpaused');
                        
                        // Refresh profile data after unpausing
                        const updatedProfileResponse = await barbers.getById(professionalId);
                        const updatedProfileData = updatedProfileResponse.data;
                        setInitialProfileData(updatedProfileData);
                        await mutateProfile(updatedProfileData, false);
                        
                        // Use updated profile data for completion check
                        const isComplete = checkProfileCompletion(updatedProfileData);
                        return {
                            success: true,
                            isProfessional: true,
                            isProfileComplete: isComplete,
                            professionalId: professionalId,
                            professionalCategory: userData.professional_category,
                            message: 'Account reactivated.'
                        };
                    } catch (unpauseError) {
                        console.warn('AuthContext: Failed to automatically unpause account:', unpauseError);
                        // Continue with paused account
                    }
                }
                
                // Set initial profile data
                setInitialProfileData(freshProfileData);
                
                    // Update SWR cache - don't let this fail the login
                    try {
                        console.log('AuthContext: Updating SWR cache...');
                await mutateProfile(freshProfileData, false);
                        console.log('AuthContext: SWR cache updated successfully');
                    } catch (mutateError) {
                        console.warn('AuthContext: SWR cache update failed, but continuing:', mutateError);
                        // Don't throw error, just log it
                    }
                
                // Check profile completion with fresh data
                const isComplete = checkProfileCompletion(freshProfileData);
                
                console.log('AuthContext: Profile completion status:', isComplete);
                
                // Ensure user state is properly set before returning
                setUser(userData);
                
                return {
                    success: true,
                        isProfessional: true,
                    isProfileComplete: isComplete,
                        professionalId: professionalId,
                        professionalCategory: userData.professional_category
                    };
                } catch (profileError) {
                    console.error('AuthContext: Profile fetch failed:', profileError);
                    // Even if profile fetch fails, login should still succeed
                    return {
                        success: true,
                        isProfessional: true,
                        isProfileComplete: false, // Assume incomplete if we can't fetch
                        professionalId: professionalId,
                        professionalCategory: userData.professional_category
                };
                }
            } else {
                console.log('AuthContext: Processing customer login...');
                localStorage.setItem('user', JSON.stringify(userData));
                setUser(userData);

                return {
                    success: true,
                    isProfessional: false,
                    isProfileComplete: true,
                    professionalId: null,
                    professionalCategory: null
                };
            }
        } catch (error) {
            console.error('AuthContext: Login error:', error);
            
            // Clear any stale state on login failure
            setError(error.message);
            setUser(null);
            setInitialProfileData(null);
            
            // Clear SWR cache to prevent stale data from interfering
            try {
                await mutateProfile(null, false);
            } catch (mutateError) {
                console.warn('AuthContext: Failed to clear SWR cache on login error:', mutateError);
            }
            
            // Pass through the original error with all its details
            return {
                success: false,
                error: error.response?.data?.detail || error.message || 'Login failed',
                originalError: error // Pass the full error object for detailed handling
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('professionalId');
        setUser(null);
        setInitialProfileData(null);
        setError(null);
        // Clear SWR cache
        mutateProfile(null, false);
    };

    // Use initial profile data if SWR data isn't available yet
    const currentProfileData = profileData || initialProfileData;
    
    // Calculate profile completion status
    const isProfileComplete = useMemo(() => {
        return checkProfileCompletion(currentProfileData);
    }, [currentProfileData]);

    // Memoize context value
    const value = useMemo(() => ({
        user,
        profileData: currentProfileData,
        loading: loading || (!currentProfileData && !profileError && !!user?.professionalId),
        error,
        login,
        logout,
        isAuthenticated: !!user,
        isProfessional: user?.is_professional || false,
        isProfileComplete,
        mutateProfile
    }), [user, currentProfileData, loading, error, isProfileComplete, profileError]);

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}; 