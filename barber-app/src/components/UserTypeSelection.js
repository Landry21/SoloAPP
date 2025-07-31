import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RollingText from './RollingText';
import '../styles/UserTypeSelection.css';

const UserTypeSelection = ({ onSelect = () => {} }) => {
    const navigate = useNavigate();
    const modalRef = useRef(null);
    const [currentProfessionalIndex, setCurrentProfessionalIndex] = useState(0);
    
    // Professional types for rolling text
    const professionalTypes = ['Barber', 'Hair Stylist', 'Nail Technician', 'Makeup Artist', 'Tattoo Artist'];

    const handleUserTypeSelection = (type) => {
        localStorage.setItem('userType', type);
        if (typeof onSelect === 'function') {
            onSelect(); // Close the modal only if onSelect is a function
        }
        if (type === 'customer') {
            navigate('/search');
        } else {
            navigate('/login');
        }
    };

    // Update professional type index
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentProfessionalIndex((prevIndex) => (prevIndex + 1) % professionalTypes.length);
        }, 2500);

        return () => clearInterval(interval);
    }, [professionalTypes.length]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                if (typeof onSelect === 'function') {
                    onSelect(); // Close the modal when clicking outside only if onSelect is a function
                }
            }
        };

        // Add event listener
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onSelect]);

    return (
        <div className="user-type-overlay">
            <div className="user-type-modal" ref={modalRef}>
                <h2>Welcome to SoloApp</h2>
                <p>Please select how you want to use the platform:</p>
                
                <div className="user-type-buttons">
                    <button 
                        className="user-type-btn customer-btn"
                        onClick={() => handleUserTypeSelection('customer')}
                    >
                        <div className="btn-icon">🔍</div>
                        <div className="btn-content">
                            <h3>I'm looking for a {professionalTypes[currentProfessionalIndex]}</h3>
                            <p>Search and book appointments with professionals</p>
                        </div>
                    </button>

                    <button 
                        className="user-type-btn barber-btn"
                        onClick={() => handleUserTypeSelection('barber')}
                    >
                        <div className="btn-icon">✂️</div>
                        <div className="btn-content">
                            <h3>I'm a {professionalTypes[currentProfessionalIndex]}</h3>
                            <p>Manage your professional profile and appointments</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserTypeSelection; 