import axios from 'axios';
import { API_BASE_URL } from '../config/config';

// Cache storage
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds in milliseconds

// Create axios instance
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
});

// Request interceptor for caching
axiosInstance.interceptors.request.use(
    async (config) => {
        // Only cache GET requests
        if (config.method === 'get') {
            const cacheKey = `${config.method}:${config.url}${JSON.stringify(config.params || {})}`;
            const cachedResponse = cache.get(cacheKey);

            if (cachedResponse) {
                const { data, timestamp } = cachedResponse;
                // Check if cache is still valid
                if (Date.now() - timestamp < CACHE_DURATION) {
                    // Return cached data in a format axios expects
                    return Promise.reject({
                        config,
                        response: { data, status: 200, statusText: 'OK' },
                        isCache: true
                    });
                } else {
                    // Remove expired cache
                    cache.delete(cacheKey);
                }
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for storing cache
axiosInstance.interceptors.response.use(
    (response) => {
        // Store successful GET requests in cache
        if (response.config.method === 'get') {
            const cacheKey = `${response.config.method}:${response.config.url}${JSON.stringify(response.config.params || {})}`;
            cache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });
        }
        return response;
    },
    (error) => {
        // Handle cached responses
        if (error.isCache) {
            return Promise.resolve(error.response);
        }
        return Promise.reject(error);
    }
);

// Add auth token to requests
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
            console.log('🔐 Axios: Adding auth token to request:', config.url);
        } else {
            console.log('⚠️ Axios: No token found for request:', config.url);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default axiosInstance; 