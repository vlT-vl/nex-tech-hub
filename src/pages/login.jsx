import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import loadSettingsPayload, { verifyAuthPassword } from '../../auth/settingsAuth';
import { getToken } from '../lib/token';
import { persistSessionUser, persistSessionSettings } from '../lib/authSecurity';
import { getUiText } from '../lib/uiText';
import NexthLogo from '../components/NexthLogo';

const SETTINGS_URL = `${import.meta.env.BASE_URL}settings.enc.json`;

async function loadAuthUsers() {
  return loadSettingsPayload(SETTINGS_URL, getToken());
}

async function findMatchingUser(users, email, password) {
  const normalizedEmail = email.toLowerCase().trim();
  for (const user of users || []) {
    if (user?.username?.toLowerCase().trim() !== normalizedEmail) continue;
    if (await verifyAuthPassword(user, password)) return user;
  }
  return null;
}

export default function Login() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [shaking, setShaking]     = useState(false);
  const navigate = useNavigate();
  const storedLang = localStorage.getItem('nth_lang');
  const language = ['it', 'en'].includes(storedLang) ? storedLang : 'it';
  const copy = getUiText(language).auth;

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 450);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loadAuthUsers();
      const user = await findMatchingUser(data.users, email, password);
      if (!user) {
        setError(copy.invalidCredentials);
        triggerShake();
        return;
      }
      persistSessionUser(user);
      if (data.views) persistSessionSettings(data.views);
      setPassword('');
      navigate('/home', { replace: true });
    } catch {
      setError(copy.authError);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-orb login-orb--1" aria-hidden="true" />
      <div className="login-orb login-orb--2" aria-hidden="true" />
      <div className="login-orb login-orb--3" aria-hidden="true" />

      <div className={`login-card${shaking ? ' is-shaking' : ''}`}>
        <div className="login-logo">
          <NexthLogo iconSize={36} variant="full" />
        </div>
        <h1 className="login-title">{copy.welcome}</h1>
        <p className="login-subtitle">{copy.subtitle}</p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-field">
            <input
              className="login-input"
              type="email"
              placeholder={copy.email}
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="login-field">
            <input
              className="login-input"
              type="password"
              placeholder={copy.password}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading && <span className="login-btn-spinner" aria-hidden="true" />}
            {loading ? copy.loading : copy.login}
          </button>
        </form>
      </div>
    </div>
  );
}
