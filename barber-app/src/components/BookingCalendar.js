// BookingCalendar Component
// Purpose: Handles appointment scheduling interface
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../styles/BookingCalendar.css';
import { barbers, appointments } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO, addMinutes, isBefore, parse } from 'date-fns';

const BookingCalendar = () => {
    const navigate = useNavigate();
    const { barberId } = useParams();
    const location = useLocation();
    const { user } = useAuth();
    const [selectedTime, setSelectedTime] = useState(null);
    const [barber, setBarber] = useState(null);
    const [loadingBarber, setLoadingBarber] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [calendarView, setCalendarView] = useState(true); // true = calendar, false = time slots
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedService, setSelectedService] = useState('');
    const [bookingComments, setBookingComments] = useState('');
    const [notificationPhone, setNotificationPhone] = useState('');
    const [contactInfo, setContactInfo] = useState({
        name: '',
        email: '',
        phone: ''
    });
    const [bookingName, setBookingName] = useState('');
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [existingAppointments, setExistingAppointments] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);

    useEffect(() => {
        if (!barberId) {
            navigate('/search');
        }
    }, [barberId, navigate]);

    useEffect(() => {
        if (location.state && location.state.barber) {
            setBarber(location.state.barber);
        } else {
            // Fetch barber info by ID for direct access
            setLoadingBarber(true);
            barbers.getById(barberId)
                .then(res => {
                    const data = res.data;
                    setBarber({
                        name: data.properties?.user_details?.first_name + ' ' + data.properties?.user_details?.last_name,
                        profileImage: data.properties?.profile_image,
                        expertise: data.properties?.services?.map(s => s.name).join(', '),
                        price: `$${data.properties?.price_range_min} - $${data.properties?.price_range_max}`,
                        services: data.properties?.services || [],
                        working_hours: data.properties?.working_hours || []
                    });
                })
                .catch(() => navigate('/search'))
                .finally(() => setLoadingBarber(false));
        }
    }, [location, navigate, barberId]);

    useEffect(() => {
        if (barber && barber.working_hours) {
            console.log('Barber working_hours:', barber.working_hours);
        }
    }, [barber]);

    // Fetch appointments when a date is selected
    useEffect(() => {
        if (selectedDate) {
            fetchExistingAppointments(selectedDate);
        }
    }, [selectedDate, barberId]);

    // Helper to get working hours for a given date
    const getWorkingHoursForDate = (date) => {
        if (!barber || !barber.working_hours) return null;
        const dayName = format(date, 'EEEE').toLowerCase(); // e.g., 'monday'
        return barber.working_hours.find(
            (wh) => wh.day.toLowerCase() === dayName && wh.is_selected
        );
    };

    // Fetch existing appointments for a specific date and barber
    const fetchExistingAppointments = async (date) => {
        if (!date || !barberId) {
            setExistingAppointments([]);
            return;
        }
        
        setLoadingAppointments(true);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const response = await appointments.getByDateAndBarber(formattedDate, barberId);
            // Handle paginated response - check for results array
            const appointmentsArray = Array.isArray(response.data) 
                ? response.data 
                : (response.data && Array.isArray(response.data.results) 
                    ? response.data.results 
                    : []);
            setExistingAppointments(appointmentsArray);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            setExistingAppointments([]);
        } finally {
            setLoadingAppointments(false);
        }
    };

    // Generate 50-min slots for a given date
    const generateTimeSlots = (date) => {
        const wh = getWorkingHoursForDate(date);
        if (!wh) return [];
        
        const slots = [];
        let start = parse(wh.start_time, 'HH:mm', date);
        const end = parse(wh.end_time, 'HH:mm', date);
        
        // Get booked times for this date, ensuring format matches (HH:mm)
        // Filter out cancelled appointments to make their time slots available
        const bookedTimes = Array.isArray(existingAppointments) 
            ? existingAppointments
                .filter(apt => apt.status !== 'cancelled') // Exclude cancelled appointments
                .map(apt => apt.start_time.substring(0, 5))
            : [];
        
        while (isBefore(addMinutes(start, 50), addMinutes(end, 1))) {
            const timeString = format(start, 'h:mm a');
            const time24Hour = format(start, 'HH:mm');
            const isBooked = bookedTimes.includes(time24Hour);
            
            if (!isBooked) {
                slots.push({
                    time: timeString,
                    available: true,
                    time24Hour: time24Hour
                });
            }
            start = addMinutes(start, 50);
        }
        return slots;
    };

    if (loadingBarber || !barber) {
        return <div>Loading...</div>;
    }

    const handleBooking = () => {
        setBookingError('');
        if (!selectedTime) return;
        setShowBookingModal(true);
    };

    const handleConfirmBooking = async () => {
        setBookingError('');
        
        // Check each required field individually and provide specific error messages
        const missingFields = [];
        
        if (!selectedService) {
            missingFields.push('Service');
        }
        if (!bookingName.trim()) {
            missingFields.push('Your Name');
        }
        if (!notificationPhone.trim()) {
            missingFields.push('Phone Number');
        }
        
        // Check guest contact info if user is not logged in
        if (!user) {
            if (!contactInfo.name.trim()) {
                missingFields.push('Contact Name');
            }
            if (!contactInfo.email.trim()) {
                missingFields.push('Contact Email');
            }
            if (!contactInfo.phone.trim()) {
                missingFields.push('Contact Phone');
            }
        }
        
        // If there are missing fields, show specific error message
        if (missingFields.length > 0) {
            const fieldList = missingFields.join(', ');
            setBookingError(`Please fill in the following required fields: ${fieldList}`);
            return;
        }

        // Format date and time for backend
        const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
        const formattedTime = selectedTime
            ? format(parse(selectedTime, 'h:mm a', new Date()), 'HH:mm')
            : '';

        // Prepare booking data for backend
        const bookingData = {
            customer: bookingName,
            barber: barberId,
            date: formattedDate,
            start_time: formattedTime,
            service: selectedService,
            notes: bookingComments,
            contact_number: notificationPhone
        };
        try {
            await appointments.create(bookingData);
            setShowBookingModal(false);
            setShowSuccessPopup(true);
            // Clear form data
            setSelectedTime(null);
            setBookingName('');
            setNotificationPhone('');
            setSelectedService('');
            setBookingComments('');
            setContactInfo({ name: '', email: '', phone: '' });
            // Refresh appointments list to update available slots
            if (selectedDate) {
                fetchExistingAppointments(selectedDate);
            }
            setTimeout(() => {
                setShowSuccessPopup(false);
                navigate('/search');
            }, 2500);
        } catch (error) {
            setBookingError('Failed to book appointment. Please try again.');
        }
    };

    const handlePhoneInput = (e) => {
        // Only allow numbers
        const value = e.target.value.replace(/[^0-9]/g, '');
        setNotificationPhone(value);
    };

    // Calendar rendering helpers
    const renderHeader = () => (
        <>
            <div className="bc-calendar-year">{format(currentMonth, 'yyyy')}</div>
            <div className="bc-calendar-header">
                <button className="bc-calendar-nav" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>&lt;</button>
                <div className="bc-calendar-month-wrapper">
                    <span className="bc-calendar-month">{format(currentMonth, 'MMMM')}</span>
                </div>
                <button className="bc-calendar-nav" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>&gt;</button>
            </div>
        </>
    );

    const renderDays = () => {
        const days = [];
        const startDate = startOfWeek(currentMonth, { weekStartsOn: 0 });
        
        // Helper function to check if barber works on a specific day
        const isWorkingDay = (dayName) => {
            if (!barber || !barber.working_hours) {
                console.log('No barber or working hours data:', { barber: !!barber, workingHours: barber?.working_hours });
                return true; // Default to available if no working hours
            }
            const dayLower = dayName.toLowerCase();
            const workingDay = barber.working_hours.find(
                (wh) => wh.day.toLowerCase() === dayLower && wh.is_selected
            );
            console.log(`Checking ${dayName}:`, { dayLower, workingDay, isWorking: !!workingDay });
            return !!workingDay;
        };
        
        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(startDate, i);
            const dayName = format(dayDate, 'EEEE'); // Full day name (e.g., "Monday")
            const dayShort = format(dayDate, 'EEE'); // Short day name (e.g., "Mon")
            const isWorking = isWorkingDay(dayName);
            
            days.push(
                <div 
                    className={`bc-calendar-day-label ${!isWorking ? 'bc-calendar-day-label--unavailable' : ''}`} 
                    key={i}
                    title={!isWorking ? `${dayName} - Not available` : dayName}
                >
                    {dayShort}
                </div>
            );
        }
        return <div className="bc-calendar-days-row">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';
        
        // Helper function to check if barber works on a specific day
        const isWorkingDay = (dayName) => {
            if (!barber || !barber.working_hours) return true; // Default to available if no working hours
            const dayLower = dayName.toLowerCase();
            const workingDay = barber.working_hours.find(
                (wh) => wh.day.toLowerCase() === dayLower && wh.is_selected
            );
            return !!workingDay;
        };
        
        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const cellDate = day; // capture the current value
                formattedDate = format(cellDate, 'd');
                const isCurrentMonth = isSameMonth(cellDate, monthStart);
                const isToday = isSameDay(cellDate, new Date());
                
                // Check if this date falls on a working day
                const dayName = format(cellDate, 'EEEE'); // Full day name (e.g., "Monday")
                const isWorking = isWorkingDay(dayName);
                
                days.push(
                    <div
                        className={`bc-calendar-cell${isCurrentMonth ? '' : ' bc-calendar-cell--disabled'}${isToday ? ' bc-calendar-cell--today' : ''}${selectedDate && isSameDay(cellDate, selectedDate) ? ' bc-calendar-cell--selected' : ''}${isCurrentMonth && !isWorking ? ' bc-calendar-cell--unavailable' : ''}`}
                        key={cellDate}
                        onClick={() => {
                            if (isCurrentMonth && isWorking) {
                                setSelectedDate(cellDate);
                                setCalendarView(false);
                            }
                        }}
                        title={isCurrentMonth && !isWorking ? `${dayName} - Not available` : ''}
                    >
                        {formattedDate}
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="bc-calendar-row" key={day}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="bc-calendar-cells">{rows}</div>;
    };

    // Filter availableSlots for selectedDate (for demo, all slots are available every day)
    const slotsForSelectedDate = selectedDate ? generateTimeSlots(selectedDate) : [];

    const renderBookingModal = () => {
        if (!showBookingModal) return null;

        return (
            <div className="bc-modal-overlay">
                <div className="bc-modal">
                    <div className="bc-modal-header">
                        <h3>Complete Your Booking</h3>
                        <button className="bc-modal-close" onClick={() => setShowBookingModal(false)}>×</button>
                    </div>
                    <div className="bc-modal-content">
                        <div className="bc-booking-summary">
                            <p>Date: {format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                            <p>Time: {selectedTime}</p>
                        </div>
                        <div className="bc-booking-name" style={{ marginBottom: '1rem' }}>
                            <label>Your Name <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="text"
                                value={bookingName}
                                onChange={e => setBookingName(e.target.value)}
                                placeholder="Enter your name"
                                className="bc-phone-input"
                                required
                            />
                        </div>
                        <div className="bc-notification-phone">
                            <label>Phone Number for Text Notifications <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="tel"
                                value={notificationPhone}
                                onChange={handlePhoneInput}
                                placeholder="Enter phone number"
                                maxLength="10"
                                className="bc-phone-input"
                                required
                            />
                            <small>We'll send appointment reminders and updates to this number</small>
                        </div>

                        <div className="bc-service-selection">
                            <label>Select Service <span style={{ color: 'red' }}>*</span></label>
                            <select 
                                value={selectedService} 
                                onChange={(e) => setSelectedService(e.target.value)}
                                className="bc-service-dropdown"
                                required
                            >
                                <option value="">Choose a service...</option>
                                {barber?.services?.map((service, index) => (
                                    <option key={index} value={service.name}>
                                        {service.name} - ${service.price_adjustment}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {!user && (
                            <div className="bc-contact-info">
                                <h4>Contact Information</h4>
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={contactInfo.name}
                                    onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})}
                                    required
                                />
                                <input
                                    type="email"
                                    placeholder="Your Email"
                                    value={contactInfo.email}
                                    onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                                    required
                                />
                                <input
                                    type="tel"
                                    placeholder="Your Phone"
                                    value={contactInfo.phone}
                                    onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                                    required
                                />
                            </div>
                        )}

                        <div className="bc-comments-section">
                            <label>Additional Details (Optional)</label>
                            <textarea
                                value={bookingComments}
                                onChange={(e) => setBookingComments(e.target.value)}
                                placeholder="Any special requests or additional information..."
                                rows="4"
                            />
                        </div>

                        {bookingError && <div className="bc-booking-error">{bookingError}</div>}
                        
                        <div className="bc-modal-actions">
                            <button 
                                className="bc-cancel-button"
                                onClick={() => setShowBookingModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="bc-confirm-button"
                                onClick={handleConfirmBooking}
                            >
                                Confirm Booking
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSuccessPopup = () => {
        if (!showSuccessPopup) return null;
        return (
            <div className="bc-modal-overlay">
                <div className="bc-modal">
                    <div className="bc-modal-header">
                        <h3>Appointment Booked!</h3>
                    </div>
                    <div className="bc-modal-content">
                        <p>Your appointment has been booked. You will receive a message with more details on the number provided shortly.</p>
                        <button className="bc-confirm-button" onClick={() => {
                            setShowSuccessPopup(false);
                            navigate('/search');
                        }}>
                            OK
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bc-container">
            <div className="bc-header">
                <button className="bc-back-button" onClick={() => navigate(-1)}>←</button>
                <h1>Book Appointment</h1>
            </div>
            <div className="bc-profile-container">
                <div className="bc-profile-picture">
                    <img 
                        src={barber.profileImage || "/images/default-avatar.png"} 
                        alt={barber.name} 
                    />
                </div>
                <div className="bc-barber-info">
                    <h2>{barber.name}</h2>
                    <p>{barber.expertise}</p>
                    <p>Price Range: {barber.price}</p>
                </div>
            </div>
            <h2 className="bc-calendar-title">Available Appointments</h2>
            <div className="bc-calendar-view">
                {!selectedDate ? (
                    <>
                        {renderHeader()}
                        {renderDays()}
                        {renderCells()}
                    </>
                ) : (
                    <div className="bc-time-slots-container">
                        <button className="bc-calendar-back" onClick={() => setSelectedDate(null)}>&larr; Back to Calendar</button>
                        <div className="bc-time-slots-header">
                            <h2 className="bc-time-slots-date">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
                        </div>
                        {slotsForSelectedDate.length === 0 ? (
                            <div className="bc-no-available-time">no available time today</div>
                        ) : (
            <div className="bc-time-slots">
                                {loadingAppointments ? (
                                    <div className="bc-loading">Loading available times...</div>
                                ) : (
                                    slotsForSelectedDate.map((slot, index) => (
                    <div 
                        key={index}
                        className={`bc-time-slot ${selectedTime === slot.time ? 'bc-selected' : ''}`}
                        onClick={() => setSelectedTime(slot.time)}
                    >
                        <div className="bc-time-icon">🕐</div>
                        <div className="bc-time-details">
                            <p>{slot.time}</p>
                                                <span className="bc-status available">
                                                    Available
                                                </span>
                        </div>
                        {selectedTime === slot.time && (
                            <div className="bc-slot-booking-button">
                                <button 
                                    className="bc-book-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleBooking();
                                    }}
                                >
                                    Book
                                </button>
                            </div>
                        )}
                    </div>
                                    ))
                                )}
            </div>
                        )}
                    </div>
                )}
            </div>
            {renderBookingModal()}
            {renderSuccessPopup()}

            {/* Footer */}
            <footer className="footer">
                <p>&copy; 2024 SoloApp</p>
            </footer>
        </div>
    );
};

export default BookingCalendar;