import api from '../utils/axiosConfig';
import { API_BASE_URL } from '../config/config';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Create axios instance with default config
const apiInstance = api.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 second timeout
});

// Add retry logic
apiInstance.interceptors.response.use(null, async (error) => {
    const { config, response } = error;

    // Don't retry if it's not a network error or if we've already retried
    if (!error.isAxiosError || !config || config.__retryCount >= MAX_RETRIES) {
        return Promise.reject(error);
    }

    // Initialize retry count
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount++;

    // Calculate delay with exponential backoff
    const delay = RETRY_DELAY * Math.pow(2, config.__retryCount - 1);

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry the request
    return apiInstance(config);
});

// Add token to requests if it exists
apiInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Token ${token}`;
    }
    return config;
});

// Error handler helper
export const handleApiError = (error) => {
    if (error.response) {
        // Server responded with error
        const { data, status } = error.response;
        return {
            message: data.detail || 'An error occurred',
            status,
            errors: data,
        };
    } else if (error.request) {
        // Request made but no response
        return {
            message: 'No response from server. Please check if the server is running.',
            status: 0,
            errors: null,
        };
    } else {
        // Request setup error
        return {
            message: error.message || 'An unexpected error occurred',
            status: 0,
            errors: null,
        };
    }
};

// Authentication APIs
export const auth = {
    login: (credentials) => api.post('/token/', credentials),
    register: (userData) => api.post('/barbers/register/', userData),
    logout: () => api.post('/auth/logout/'),
    createBarberProfile: (formData) => {
        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };
        return api.post('/barbers/complete_profile/', formData, config);
    },
    updateUser: (userData) => api.patch('/users/update_me/', userData),
};

// Barber APIs
export const barbers = {
    getAll: (params) => api.get('/barbers/search/', { params }),
    getById: (id) => api.get(`/barbers/${id}/`),
    getPortfolio: (id) => api.get(`/barbers/${id}/portfolio/`),
    getReviews: (id) => api.get(`/barbers/${id}/reviews/`),
    updateProfile: (id, formData) => {
        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };
        return api.patch(`/barbers/${id}/`, formData, config);
    },
    updateAddress: (data) => api.patch('/barbers/user/', data),
    addPortfolioItem: (data) => {
        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };
        return api.post('/portfolio/', data, config);
    },
    createPortfolioGroup: (barberId, formData) => {
        return api.post(`/barbers/${barberId}/portfolio/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Token ${localStorage.getItem('token')}`,
            },
        });
    },
    updatePortfolioItem: (barberId, postId, data) => {
        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };
        return api.patch(`/barbers/${barberId}/portfolio/${postId}/`, data, config);
    },
    deletePortfolioItem: (endpoint) => api.delete(endpoint),
    pauseAccount: (data) => api.post('/barbers/pause_account/', data),
    unpauseAccount: () => api.post('/barbers/unpause_account/'),
    deleteAccount: (data) => api.post('/barbers/delete_account/', data),
};

// Service APIs
export const services = {
    getAll: () => api.get('/services/'),
    getById: (id) => api.get(`/services/${id}/`),
    getBarberServices: (barberId) =>
        api.get('/barber-services/', { params: { barber: barberId } }),
};

// Barber Service APIs
export const barberServices = {
    getAll: () => api.get('/barber-services/'),
    getById: (id) => api.get(`/barber-services/${id}/`),
    updateAll: (data) => api.put('/barber-services/bulk-update/', data),
    deleteAll: () => api.delete('/barber-services/delete-all/'),
};

// Working Hours APIs
export const workingHours = {
    getByBarber: (barberId) =>
        api.get('/working-hours/', { params: { barber: barberId } }),
    update: (id, data) => api.put(`/working-hours/${id}/`, data),
    create: (data) => api.post('/working-hours/', data),
    updateAll: (data) => api.put('/working-hours/bulk-update/', data),
    deleteAll: () => api.delete('/working-hours/delete-all/'),
};

// Appointment APIs
export const appointments = {
    create: (data) => api.post('/appointments/', data),
    getCustomerAppointments: () => api.get('/appointments/customer/'),
    getBarberAppointments: () => api.get('/appointments/upcoming/'),
    getByDateAndBarber: (date, barberId) => 
        api.get('/appointments/', { 
            params: { 
                date: date, 
                barber: barberId 
            } 
        }),
    updateStatus: (id, status) =>
        api.patch(`/appointments/${id}/`, { status }),
};

// Review APIs
export const reviews = {
    create: (data) => api.post('/reviews/', data),
    getByBarber: (barberId) =>
        api.get('/reviews/', { params: { barber: barberId } }),
};

// Add new consolidated profile endpoint
export const getBarberProfile = async (barberId) => {
    try {
        const response = await api.get(`/barbers/${barberId}/profile/`);
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }
}; 