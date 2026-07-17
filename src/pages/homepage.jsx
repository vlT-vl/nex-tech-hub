import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';
import { MdLightMode, MdDarkMode } from 'react-icons/md';
import { TbLayoutDashboard, TbVersions } from 'react-icons/tb';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { LuShieldCheck, LuUser, LuWrench, LuMonitorCog } from 'react-icons/lu';
import { SiGithub } from 'react-icons/si';
import pkgjson from '../../package.json';
import NexthLogo from '../components/NexthLogo';
import Dashboard from './dashboard';
import TechRelease from './techrelease';
import About from './about';
import Admin from './admin';
import Insights from './infrainsights';
import GithubRepo from './githubrepo';
import { clearStoredSession, readStoredSession, persistSessionSettings, readStoredSettings } from '../lib/authSecurity';
import { getUiText } from '../lib/uiText';
import { DataProvider } from '../context/DataContext';

const ALL_NAV = [
  { id: 'dashboard',   labelKey: 'dashboard',  Icon: TbLayoutDashboard },
  { id: 'techrelease', labelKey: 'techrelease', Icon: TbVersions },
  { id: 'infra',       labelKey: 'infra',       Icon: LuMonitorCog },
  { id: 'githubrepo',  labelKey: 'githubrepo',  Icon: SiGithub },
  { id: 'about',       labelKey: 'about',       Icon: AiOutlineInfoCircle },
];

const ADMIN_USER = 'vlt@hub.local';
const DEFAULT_VIEWS = { dashboard: true, techrelease: true, infra: true, githubrepo: true, about: true };

export default function Homepage() {
  const [user,        setUser]        = useState(null);
  const [activeView,  setActiveView]  = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [views,       setViews]       = useState(DEFAULT_VIEWS);
  const [darkMode,    setDarkMode]    = useState(() => localStorage.getItem('nth_theme') === 'dark');
  const [language,    setLanguage]    = useState(() => {
    const stored = localStorage.getItem('nth_lang');
    return ['it', 'en'].includes(stored) ? stored : 'it';
  });
  const navigate = useNavigate();
  const copy = getUiText(language);
  const isAdmin = user?.username?.toLowerCase?.().trim() === ADMIN_USER;

  const isViewEnabled = (id) => isAdmin || views[id] !== false;

  const navItems = [
    ...ALL_NAV.filter(({ id }) => id !== 'about' && (isAdmin || isViewEnabled(id))),
    ...(isAdmin ? [{ id: 'admin', labelKey: 'admin', Icon: LuShieldCheck }] : []),
    ...(isAdmin || isViewEnabled('about') ? [ALL_NAV.find(n => n.id === 'about')] : []),
  ];

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) { navigate('/', { replace: true }); return; }
    setUser(stored);
    const settings = readStoredSettings();
    if (settings?.views) setViews(settings.views);
  }, []);

  // Auto-redirect non-admin away from disabled active view
  useEffect(() => {
    if (!isAdmin && !isViewEnabled(activeView)) {
      const firstEnabled = ALL_NAV.find(({ id }) => isViewEnabled(id));
      setActiveView(firstEnabled?.id ?? 'dashboard');
    }
  }, [views, isAdmin]);

  // Mirror the theme on <body> too: content portaled outside .homepage-main
  // (e.g. the GitHub Repo modal, via createPortal to document.body) can't see
  // .homepage-main.theme-dark through normal CSS inheritance otherwise.
  useEffect(() => {
    document.body.classList.toggle('theme-dark', darkMode);
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem('nth_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const switchLanguage = (next) => {
    if (!['it', 'en'].includes(next)) return;
    setLanguage(next);
    localStorage.setItem('nth_lang', next);
  };

  const handleLogout = () => {
    clearStoredSession();
    navigate('/', { replace: true });
  };

  const switchView = (id) => {
    setActiveView(id);
    setSidebarOpen(false);
  };

  // Called by Admin both live (on every toggle, for instant preview across the app)
  // and after a successful save, to sync views immediately without a reload.
  const handleSettingsChange = (newViews) => {
    setViews(newViews);
    persistSessionSettings(newViews);
  };

  return (
    <div className="homepage-container">
      {sidebarOpen && (
        <div
          className="sidebar-overlay show"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(v => !v)}
        aria-label={sidebarOpen ? copy.nav.closeMenu : copy.nav.openMenu}
      >
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <NexthLogo iconSize={50} variant="stacked" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label={copy.nav.mainNavigation}>
          {navItems.map(({ id, labelKey, Icon }) => {
            const inMaintenance = isAdmin && views[id] === false;
            return (
              <div
                key={id}
                className={`sidebar-item${activeView === id ? ' active' : ''}${inMaintenance ? ' sidebar-item--maintenance' : ''}`}
                onClick={() => switchView(id)}
                role="button"
                tabIndex={0}
                aria-current={activeView === id ? 'page' : undefined}
              >
                <Icon className="sidebar-icon" aria-hidden="true" />
                <span>{copy.nav[labelKey]}</span>
                {inMaintenance && (
                  <span className="sidebar-maintenance-badge" title={copy.admin?.maintenance}>
                    <LuWrench />
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <button className="theme-toggle" onClick={toggleTheme} title={darkMode ? copy.nav.switchToLight : copy.nav.switchToDark}>
          {darkMode ? <MdLightMode size={15} /> : <MdDarkMode size={15} />}
          {darkMode ? copy.nav.lightTheme : copy.nav.darkTheme}
        </button>

        <div className="language-switch" role="group" aria-label={copy.nav.language}>
          <button className={language === 'it' ? 'active' : ''} onClick={() => switchLanguage('it')} type="button">IT</button>
          <button className={language === 'en' ? 'active' : ''} onClick={() => switchLanguage('en')} type="button">EN</button>
        </div>

        <div className="sidebar-user">
          <div className={`sidebar-user-avatar sidebar-user-avatar--${isAdmin ? 'admin' : 'user'}`} aria-hidden="true">
            {isAdmin ? <LuShieldCheck /> : <LuUser />}
          </div>
          <div className="sidebar-user-info">
            <span className="user-display-name">{user?.displayName || user?.username || copy.nav.user}</span>
            <div className="sidebar-user-meta">
              <span className="user-email" title={user?.username}>{user?.username}</span>
              <span className={`sidebar-role-badge sidebar-role-badge--${isAdmin ? 'admin' : 'user'}`}>
                {isAdmin ? 'admin' : 'user'}
              </span>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              <FaSignOutAlt aria-hidden="true" /> {copy.nav.logout}
            </button>
          </div>
        </div>

        <div className="sidebar-footer">{pkgjson.author}</div>
      </aside>

      <DataProvider language={language}>
        <main className={`homepage-main${darkMode ? ' theme-dark' : ''}${activeView === 'dashboard' ? ' homepage-main--dashboard' : ''}`}>
          <div className={activeView === 'dashboard' ? 'view-panel--active view-panel--dashboard' : 'view-panel--hidden view-panel--dashboard'}>
            <Dashboard darkMode={darkMode} language={language} />
          </div>
          <div className={activeView === 'techrelease' ? 'view-panel--active' : 'view-panel--hidden'}>
            <TechRelease language={language} />
          </div>
          <div className={activeView === 'infra' ? 'view-panel--active' : 'view-panel--hidden'}>
            <Insights language={language} infraSettings={views} />
          </div>
          <div className={activeView === 'githubrepo' ? 'view-panel--active' : 'view-panel--hidden'}>
            <GithubRepo language={language} />
          </div>
          <div className={activeView === 'about' ? 'view-panel--active' : 'view-panel--hidden'}>
            <About darkMode={darkMode} language={language} />
          </div>
          {isAdmin && (
            <div className={activeView === 'admin' ? 'view-panel--active' : 'view-panel--hidden'}>
              <Admin user={user} language={language} onSettingsChange={handleSettingsChange} />
            </div>
          )}
        </main>
      </DataProvider>
    </div>
  );
}
