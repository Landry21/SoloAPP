// AppointmentPanel Component
// Purpose: Manages and displays user's appointment interface
// Features: Shows today's appointments and booking options
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { appointments } from '../services/api';
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import '../styles/AppointmentPanel.css';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const AppointmentPanel = () => {
    const navigate = useNavigate();
    const auth = useAuth();
    const id = auth?.user?.professionalId || localStorage.getItem('professionalId');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dailyAppointments, setDailyAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cancelingId, setCancelingId] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [pendingCancelId, setPendingCancelId] = useState(null);
    const [makeAvailableAgain, setMakeAvailableAgain] = useState(true);
    const [showWeekPicker, setShowWeekPicker] = useState(false);
    const [weekRange, setWeekRange] = useState(null); // {start: Date, end: Date}
    const [weekAppointments, setWeekAppointments] = useState([]);

    const fetchAppointments = async (date) => {
        setLoading(true);
        setError(null);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const response = await appointments.getByDateAndBarber(formattedDate, id);
            const data = Array.isArray(response.data)
                ? response.data
                : (response.data && Array.isArray(response.data.results)
                    ? response.data.results
                    : []);
            // Filter out canceled appointments
            const activeAppointments = data.filter(apt => apt.status !== 'cancelled');
            setDailyAppointments(activeAppointments);
        } catch (err) {
            setError('Failed to load appointments.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id && selectedDate) {
            fetchAppointments(selectedDate);
        }
    }, [id, selectedDate]);

    const openCancelModal = (appointmentId) => {
        setPendingCancelId(appointmentId);
        setShowCancelModal(true);
        setCancelReason('');
    };

    const closeCancelModal = () => {
        setShowCancelModal(false);
        setPendingCancelId(null);
        setCancelReason('');
        setMakeAvailableAgain(true);
    };

    const handleConfirmCancel = async () => {
        setCancelingId(pendingCancelId);
        try {
            await appointments.updateStatus(pendingCancelId, 'cancelled');
            
            // If barber wants to make the time available again, we could add logic here
            // to update working hours or availability for that specific time slot
            if (makeAvailableAgain) {
                console.log('Making cancelled time slot available again');
                // TODO: Implement logic to make the time slot available again
                // This could involve updating working hours or creating a temporary availability slot
            }
            
            // Optionally send cancelReason to backend if supported
            fetchAppointments(selectedDate);
            
            // Dispatch custom event to refresh dashboard data
            window.dispatchEvent(new CustomEvent('appointmentCancelled'));
            
            closeCancelModal();
        } catch (err) {
            setError('Failed to cancel appointment.');
        } finally {
            setCancelingId(null);
        }
    };

    const handlePrevDay = () => setSelectedDate(addDays(selectedDate, -1));
    const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

    // Fetch appointments for a week
    const fetchWeekAppointments = async (start, end) => {
        setLoading(true);
        setError(null);
        let allAppointments = [];
        try {
            for (let i = 0; i < 7; i++) {
                const day = addDays(start, i);
                const formattedDate = format(day, 'yyyy-MM-dd');
                const response = await appointments.getByDateAndBarber(formattedDate, id);
                const data = Array.isArray(response.data)
                    ? response.data
                    : (response.data && Array.isArray(response.data.results)
                        ? response.data.results
                        : []);
                // Filter out canceled appointments
                const activeAppointments = data.filter(apt => apt.status !== 'cancelled');
                allAppointments.push({ date: day, appointments: activeAppointments });
            }
            setWeekAppointments(allAppointments);
        } catch (err) {
            setError('Failed to load week appointments.');
        } finally {
            setLoading(false);
        }
    };

    // Handler for date label click: immediately show week view for the week containing selectedDate
    const handleDateLabelClick = () => {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        setWeekRange({ start, end });
        fetchWeekAppointments(start, end);
    };

    // Navigation handlers for week and day view
    const handlePrev = () => {
        if (weekRange) {
            const prevStart = addDays(weekRange.start, -7);
            const prevEnd = addDays(weekRange.end, -7);
            setWeekRange({ start: prevStart, end: prevEnd });
            fetchWeekAppointments(prevStart, prevEnd);
        } else {
            handlePrevDay();
        }
    };
    const handleNext = () => {
        if (weekRange) {
            const nextStart = addDays(weekRange.start, 7);
            const nextEnd = addDays(weekRange.end, 7);
            setWeekRange({ start: nextStart, end: nextEnd });
            fetchWeekAppointments(nextStart, nextEnd);
        } else {
            handleNextDay();
        }
    };

    return (
        // Main container for appointment management
        <div className="appointment-panel">
            {error && (
                <div className="error-container">
                    <h3>Error</h3>
                    <p>{error}</p>
                    <button className="retry-button" onClick={() => fetchAppointments(selectedDate)}>
                        Retry
                    </button>
                </div>
            )}
            <h2 className="ap-main-title">My Appointments</h2>
            <div className="ap-date-nav ap-date-nav-centered">
                <button onClick={handlePrev}>&larr;</button>
                {weekRange ? (
                    <span className="ap-date-label ap-date-label-bold" style={{ textDecoration: 'underline' }}>
                        {`Week of ${format(weekRange.start, 'MMM d')} – ${format(weekRange.end, 'MMM d, yyyy')}`}
                    </span>
                ) : (
                    <span className="ap-date-label ap-date-label-bold" onClick={handleDateLabelClick} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    </span>
                )}
                <button onClick={handleNext}>&rarr;</button>
            </div>
            {/* Week appointments view */}
            {weekRange && weekAppointments.length > 0 && (
                <div className="ap-week-appointments">
                    <div className="ap-week-grid-wrapper">
                        <div className="ap-week-grid">
                            {weekAppointments.map(({ date, appointments }) => (
                                <div key={format(date, 'yyyy-MM-dd')} className="ap-week-day-section">
                                    <div
                                        className="ap-week-day-header"
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => {
                                            setSelectedDate(date);
                                            setWeekRange(null);
                                            fetchAppointments(date);
                                        }}
                                    >
                                        {format(date, 'EEE d')}
                                    </div>
                                    {appointments.length === 0 ? (
                                        <div className="ap-no-appointments">No appointments</div>
                                    ) : (
                                        <div className="ap-week-appointments-container">
                                            {appointments.map((apt) => (
                                                <div key={apt.id} className="ap-appointment-card">
                                                    <div className="ap-appointment-details-row">
                                                        <div className="ap-appointment-details">
                                                            <div className="ap-time-service">{apt.start_time?.slice(0,5)} for {apt.service}</div>
                                                            <div className="ap-name-contact">{apt.customer}, {apt.contact_number}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Daily appointments view (default) */}
            {!weekRange && (
            <div className="today-appointments">
                {loading ? (
                    <div>Loading...</div>
                ) : dailyAppointments.length === 0 ? (
                    <div className="ap-no-appointments">No appointments for this day.</div>
                ) : (
                        <div className="ap-appointment-grid">
                        {dailyAppointments.map((apt) => (
                                <div key={apt.id} className="ap-appointment-card">
                                    <div className="ap-appointment-details-row">
                                        <div className="ap-appointment-details">
                                            <div className="ap-time-service">{apt.start_time?.slice(0,5)} for {apt.service}</div>
                                            <div className="ap-name-contact">{apt.customer}, {apt.contact_number}</div>
                                    </div>
                                    <button
                                        className="ap-cancel-btn"
                                            onClick={() => openCancelModal(apt.id)}
                                        disabled={cancelingId === apt.id}
                                    >
                                        {cancelingId === apt.id ? 'Cancelling...' : 'Cancel'}
                                    </button>
                                </div>
                                </div>
                        ))}
                        </div>
                )}
            </div>
            )}
            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="ap-modal-overlay" onClick={closeCancelModal}>
                    <div className="ap-modal" onClick={e => e.stopPropagation()}>
                        <h3>Cancel Appointment</h3>
                        <p>Please provide a reason for cancellation (optional):</p>
                        <div className="ap-modal-form">
                            <textarea
                                className="ap-cancel-reason-input"
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="Enter reason..."
                                rows={3}
                            />
                            <div className="ap-availability-checkbox">
                                <label className="ap-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={makeAvailableAgain}
                                        onChange={e => setMakeAvailableAgain(e.target.checked)}
                                        className="ap-checkbox-input"
                                    />
                                    <span className="ap-checkbox-text">
                                        Make time slot available again in my calendar
                                    </span>
                                </label>
                            </div>
                            <div className="ap-modal-actions">
                                <button className="ap-modal-cancel-btn" onClick={closeCancelModal}>Back</button>
                                <button className="ap-modal-confirm-btn" onClick={handleConfirmCancel} disabled={cancelingId === pendingCancelId}>
                                    {cancelingId === pendingCancelId ? 'Cancelling...' : 'Confirm Cancellation'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Integrated Navigation */}
            <nav className="bp-navigation-bar">
                <div
                    className="bp-nav-item"
                    onClick={() => id && navigate(`/barber-dashboard/${id}`)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#666" width="24" height="24">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                    </svg>
                    <p>Dashboard</p>
                </div>
                <div
                    className="bp-nav-item"
                    onClick={() => navigate('/search')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#666" width="24" height="24">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                    <p>Search</p>
                </div>
                <div
                    className="bp-nav-item"
                    onClick={() => id && navigate(`/barber-profile/${id}`)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#666" width="24" height="24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <p>Profile</p>
                </div>
            </nav>

            {/* Footer */}
            <footer className="ap-footer">
                <p>&copy; 2024 SoloApp</p>
            </footer>
        </div>
    );
};

export default AppointmentPanel;