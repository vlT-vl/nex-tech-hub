import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/login';
import Homepage from './pages/homepage';
import { readStoredSession } from './lib/authSecurity';

function AppRoutes() {
  const [session, setSession] = useState(null);
  const [ready, setReady]     = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSession(readStoredSession());
    setReady(true);
  }, [location]);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/"     element={!session ? <Login />    : <Navigate to="/home" replace />} />
      <Route path="/home" element={session  ? <Homepage /> : <Navigate to="/"     replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
