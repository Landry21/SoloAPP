import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Create a navigation context that can be used across components
export const handleSmartNavigation = (navigate, currentPath, to, options = {}) => {
    const authPages = ['/login', '/register', '/reset-password'];
    const shouldReplace = authPages.includes(currentPath);
    
    if (!shouldReplace) {
        sessionStorage.setItem('lastNonAuthPage', currentPath);
    }

    // Handle special cases for barber routes
    if (to === '/barber-dashboard' || to.startsWith('/barber-dashboard/')) {
        const barberId = localStorage.getItem('barberId');
        if (barberId) {
            to = `/barber-dashboard/${barberId}`;
        }
    } else if (to === '/appointment-panel' || to.startsWith('/appointment-panel/')) {
        const barberId = localStorage.getItem('barberId');
        if (barberId) {
            to = `/appointment-panel/${barberId}`;
        }
    }
    
    navigate(to, { 
        ...options,
        replace: shouldReplace,
        state: {
            ...options.state,
            returnTo: sessionStorage.getItem('lastNonAuthPage')
        }
    });
};

const Navigation = ({ activePage }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isBarber, setIsBarber] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Check authentication status on component mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        const barberStatus = localStorage.getItem('isBarber') === 'true';
        
        setIsLoggedIn(!!token);
        setIsBarber(barberStatus);
    }, []);

    // Handle navigation using smart navigation
    const handleNavigation = (path) => {
        handleSmartNavigation(navigate, location.pathname, path);
    };

    // Handle logout with smart navigation
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('isBarber');
        localStorage.removeItem('barberId');
        
        setIsLoggedIn(false);
        setIsBarber(false);
        
        handleSmartNavigation(navigate, location.pathname, '/login', { replace: true });
    };

    return (
        // Main container for navigation and footer
        <div className="nav-footer-container">
            {/* Main navigation bar */}
            <nav className="navigation-bar">
                {/* Home navigation item */}
                <div className={`nav-item ${activePage === 'home' ? 'active' : ''}`} 
                     onClick={() => handleNavigation('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" 
                         fill={activePage === 'home' ? "#007AFF" : "#666"} 
                         width="24" height="24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                    <p>Home</p>
                </div>

                {/* Search navigation item */}
                <div className={`nav-item ${activePage === 'search' ? 'active' : ''}`}
                     onClick={() => handleNavigation('/search')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill={activePage === 'search' ? "#007AFF" : "#666"}
                         width="24" height="24">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                    <p>Search</p>
                </div>

                {/* Appointments navigation item - only show if logged in */}
                {isLoggedIn && (
                    <div className={`nav-item ${activePage === 'appointments' ? 'active' : ''}`}
                         onClick={() => handleNavigation('/appointment')}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                             fill={activePage === 'appointments' ? "#007AFF" : "#666"}
                             width="24" height="24">
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                        </svg>
                        <p>Appointments</p>
                    </div>
                )}

                {/* Barber Dashboard - only show if user is a barber */}
                {isBarber && (
                    <div className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
                         onClick={() => handleNavigation('/barber-dashboard')}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                             fill={activePage === 'dashboard' ? "#007AFF" : "#666"}
                             width="24" height="24">
                            <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                        </svg>
                        <p>Dashboard</p>
                    </div>
                )}

                {/* Login/Logout navigation item */}
                <div className={`nav-item ${activePage === 'login' ? 'active' : ''}`}
                     onClick={isLoggedIn ? handleLogout : () => handleNavigation('/login')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill={activePage === 'login' ? "#007AFF" : "#666"}
                         width="24" height="24">
                        {isLoggedIn ? (
                            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                        ) : (
                            <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/>
                        )}
                    </svg>
                    <p>{isLoggedIn ? 'Logout' : 'Login'}</p>
                </div>
            </nav>

            {/* Footer section */}
            <footer className="app-footer">
                <p>&copy; {new Date().getFullYear()} SoloApp</p>
            </footer>
        </div>
    );
};

export default Navigation; 