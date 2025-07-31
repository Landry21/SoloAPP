import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PortfolioProvider } from './contexts/PortfolioContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import BarberDashboard from './components/BarberDashboard';
import BarberProfile from './components/BarberProfile';
import SearchScreen from './components/SearchScreen';
import BookingCalendar from './components/BookingCalendar';
import AppointmentPanel from './components/AppointmentPanel';
import UserTypeSelection from './components/UserTypeSelection';
import PostForm from './components/PostForm';
//import CreateBarberProfile from './components/BarberRegistration';
import CompleteBarberProfile from './components/CompleteBarberProfile';
import './styles/main.css';
import BarberRegistration from './components/BarberRegistration';
import SearchResults from './components/SearchResults';
import PublicBarberProfile from './components/PublicBarberProfile';
import SettingsParameters from './components/SettingsParameters';

function App() {
  return (
    <Router>
    <AuthProvider>
      <PortfolioProvider>
          <div className="App">
          <Routes>
              <Route path="/" element={<UserTypeSelection />} />
              <Route path="/login" element={<Login />} />
              <Route path="/search" element={<SearchScreen />} />
              <Route path="/register" element={<BarberRegistration />} />
              <Route path="/complete-barber-profile" element={
                <ProtectedRoute requireBarber={true}>
                  <CompleteBarberProfile />
                </ProtectedRoute>
              } />
              <Route path="/barber-dashboard/:id" element={
                <ProtectedRoute requireBarber={true}>
                  <BarberDashboard />
                </ProtectedRoute>
              } />
              <Route path="/barber-profile/:id" element={
                <ProtectedRoute>
                  <BarberProfile />
                </ProtectedRoute>
              } />
              <Route path="/public-barber/:id" element={<PublicBarberProfile />} />
              <Route path="/booking/:barberId" element={<BookingCalendar />} />
              <Route path="/post-form/:barberId" element={<PostForm />} />
              <Route path="/appointment-panel/:barberId" element={
                <ProtectedRoute requireBarber={true}>
                  <AppointmentPanel />
                </ProtectedRoute>
              } />
              <Route path="/search-results" element={<SearchResults />} />
              <Route path="/settings" element={
                <ProtectedRoute requireBarber={true}>
                  <SettingsParameters />
                </ProtectedRoute>
              } />
          </Routes>
          </div>
      </PortfolioProvider>
    </AuthProvider>
    </Router>
  );
}

export default App;