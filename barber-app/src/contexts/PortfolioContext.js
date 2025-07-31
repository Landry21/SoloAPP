import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { barbers, handleApiError } from '../services/api';
import { useAuth } from './AuthContext';

const PortfolioContext = createContext();

export const PortfolioProvider = ({ children }) => {
    const [portfolioData, setPortfolioData] = useState({});
    const [loading, setLoading] = useState({});
    const [error, setError] = useState(null);
    const [lastFetchTime, setLastFetchTime] = useState({});
    const { user } = useAuth();

    // Use ref for tracking fetches
    const fetchTracker = useRef({});

    // Memoized fetch function with stable dependencies
    const fetchPortfolio = useCallback(async (barberId) => {
        if (!barberId) {
            console.error('PortfolioContext - No barber ID provided');
            return null;
        }

        console.log('🔍 Portfolio Fetch - Starting fetch for barberId:', barberId);
        console.log('Current portfolio state:', JSON.stringify(portfolioData[barberId], null, 2));
        console.log('Current loading state:', loading);

        if (loading[barberId]) {
            console.log('🔄 Portfolio Fetch - Already loading for barberId:', barberId);
            return portfolioData[barberId];
        }

        const now = Date.now();
        const lastFetch = lastFetchTime[barberId] || 0;
        const cacheDuration = 0; // Temporarily disable cache for testing

        if (portfolioData[barberId] && (now - lastFetch) < cacheDuration) {
            console.log('📦 Portfolio Fetch - Using cached data for barberId:', barberId);
            console.log('Cached data structure:', JSON.stringify(portfolioData[barberId], null, 2));
            return portfolioData[barberId];
        }

        setLoading(prev => ({ ...prev, [barberId]: true }));

        try {
            console.log('🚀 Portfolio Fetch - Making API call for barberId:', barberId);
            const response = await barbers.getPortfolio(barberId);
            console.log('✅ Portfolio Fetch - API Response:', response.data);

            // Transform the response data to handle both single and group photos
            const transformedData = response.data.results.map(item => {
                if (item.is_group_post) {
                    return {
                        id: item.id,
                        description: item.description,
                        created_at: item.created_at,
                        is_group_post: true,
                        group_images: item.group_images,
                        images: item.images,
                        barberId
                    };
                } else {
                    return {
                        id: item.id,
                        description: item.description,
                        created_at: item.created_at,
                        is_group_post: false,
                        image: item.image,
                        barberId
                    };
                }
            });

            // Store the transformed data
            setPortfolioData(prev => ({
                ...prev,
                [barberId]: transformedData
            }));
            
            setLastFetchTime(prev => ({
                ...prev,
                [barberId]: Date.now()
            }));

            return transformedData;
        } catch (err) {
            console.error('❌ Portfolio Fetch - Error:', err);
            const handledError = handleApiError(err);
            setError(handledError);
            throw handledError;
        } finally {
            setLoading(prev => ({ ...prev, [barberId]: false }));
        }
    }, []);

    // Single effect for initial data fetch
    useEffect(() => {
        const initializePortfolio = async () => {
            if (user?.barberId) {
            console.log('PortfolioContext - Initial fetch for barber:', user.barberId);
                await fetchPortfolio(user.barberId);
        }
        };

        initializePortfolio();
    }, [user?.barberId]); // Only depend on barberId changes

    const updatePortfolio = useCallback((barberId, newData) => {
        setPortfolioData(prev => ({
            ...prev,
            [barberId]: newData
        }));
    }, []);

    const addPortfolioItem = useCallback(async (barberId, formData) => {
        if (!barberId || !formData) {
            throw new Error('Barber ID and form data are required');
        }

        try {
            const response = await barbers.addPortfolioItem(formData);
            const updatedPortfolio = await fetchPortfolio(barberId);
            return { response, updatedPortfolio };
        } catch (err) {
            const handledError = handleApiError(err);
            setError(handledError);
            throw handledError;
        }
    }, [fetchPortfolio]);

    const createPortfolioGroup = useCallback(async (barberId, formData) => {
        if (!barberId || !formData) {
            throw new Error('Barber ID and form data are required');
        }

        try {
            const response = await barbers.createPortfolioGroup(barberId, formData);
            const updatedPortfolio = await fetchPortfolio(barberId);
            return { response, updatedPortfolio };
        } catch (err) {
            const handledError = handleApiError(err);
            setError(handledError);
            throw handledError;
        }
    }, [fetchPortfolio]);

    const updatePortfolioItem = useCallback(async (barberId, postId, formData) => {
        if (!barberId || !postId || !formData) {
            throw new Error('Barber ID, post ID, and form data are required');
        }

        try {
            const response = await barbers.updatePortfolioItem(barberId, postId, formData);
            const updatedPortfolio = await fetchPortfolio(barberId);
            return { response, updatedPortfolio };
        } catch (err) {
            const handledError = handleApiError(err);
            setError(handledError);
            throw handledError;
        }
    }, [fetchPortfolio]);

    const deletePortfolioItem = useCallback(async (barberId, postId, isGroup = false) => {
        if (!barberId || !postId) {
            throw new Error('Barber ID and post ID are required');
        }

        try {
            // Use the nested barber endpoint for both single and group posts
            const endpoint = `/barbers/${barberId}/portfolio/${postId}/`;
            console.log('Deleting portfolio item with endpoint:', endpoint);

            await barbers.deletePortfolioItem(endpoint);
            const updatedPortfolio = await fetchPortfolio(barberId);
            return updatedPortfolio;
        } catch (err) {
            console.error('Error deleting portfolio item:', err);
            const handledError = handleApiError(err);
            setError(handledError);
            throw handledError;
        }
    }, [fetchPortfolio]);

    const value = {
        portfolioData,
        loading,
        error,
        fetchPortfolio,
        updatePortfolio,
        addPortfolioItem,
        createPortfolioGroup,
        updatePortfolioItem,
        deletePortfolioItem
    };

    return (
        <PortfolioContext.Provider value={value}>
            {children}
        </PortfolioContext.Provider>
    );
};

export const usePortfolio = () => {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error('usePortfolio must be used within a PortfolioProvider');
    }
    return context;
}; 