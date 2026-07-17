import { useEffect, useMemo, useState } from 'react';
import {
  LuExternalLink, LuEye, LuEyeOff, LuFileJson, LuKeyRound, LuPackage, LuPlus, LuSave,
  LuServer, LuSettings, LuShieldCheck, LuTerminal, LuTrash2, LuUser, LuUsers, LuWrench,
} from 'react-icons/lu';
import { TbLayoutDashboard, TbVersions } from 'react-icons/tb';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { SiGithub, SiProxmox } from 'react-icons/si';
import { GrVmware } from 'react-icons/gr';
import pkg from '../../package.json';
import loadSettingsPayload, { encryptAuthPayloadForBrowser, hashPasswordForBrowser } from '../../auth/settingsAuth';
import { getToken } from '../lib/token';
import { getUiText } from '../lib/uiText';
import '../../css/admin.css';

const ADMIN_USER = 'vlt@hub.local';
const GITHUB_OWNER = 'vlT-vl';
const GITHUB_REPO = 'nex-tech-hub';
const GITHUB_WORKFLOW = 'deploy.yml';
const GITHUB_REF = 'sourcecode';
const GITHUB_TOKEN_STORAGE_KEY = 'nth_admin_github_token';
const IS_DEV = import.meta.env.DEV;
const CAN_DISPATCH_ACTIONS = !IS_DEV || import.meta.env.VITE_NTH_ENABLE_ADMIN_DISPATCH_TEST === 'true';
const SETTINGS_URL = `${import.meta.env.BASE_URL}settings.enc.json`;
const ROLE_OPTIONS = ['user', 'admin'];

const ADMIN_TABS = [
  { id: 'sistema', Icon: LuSettings },
  { id: 'users',   Icon: LuUsers },
];

const DEFAULT_VIEWS = { dashboard: true, techrelease: true, infra: true, githubrepo: true, about: true, infraProxmox: true, infraVmware: true, infraPmxtoolsCli: false, infraPmxtoolsDownload: true, infraRvtoolsConverter: true };

const MANAGEABLE_VIEWS = [
  { id: 'dashboard',   Icon: TbLayoutDashboard },
  { id: 'techrelease', Icon: TbVersions },
  { id: 'infra',       Icon: LuServer },
  { id: 'githubrepo',  Icon: SiGithub },
  { id: 'about',       Icon: AiOutlineInfoCircle },
];

const blankNewUser = () => ({ username: '', displayName: '', role: 'user', password: '' });

const normalizeUsername = (value) => value.toLowerCase().trim();
const normalizeRole = (value, username = '') => {
  if (normalizeUsername(username) === ADMIN_USER) return 'admin';
  const role = String(value).toLowerCase().trim();
  return ROLE_OPTIONS.includes(role) ? role : 'user';
};

async function loadAuthUsers() {
  return loadSettingsPayload(SETTINGS_URL, getToken());
}

async function saveJsonFile(filename, payload) {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([content], { type: 'application/json' });

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'Encrypted settings JSON', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function jsonToBase64(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let raw = '';
  bytes.forEach((byte) => { raw += String.fromCharCode(byte); });
  return btoa(raw);
}

function readSessionToken() {
  try { return sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) || ''; }
  catch { return ''; }
}

function writeSessionToken(value) {
  try {
    if (value) sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, value);
    else sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
  } catch {}
}

async function dispatchAdminUpdate(encryptedPayload, githubToken, text) {
  if (!CAN_DISPATCH_ACTIONS) {
    await saveJsonFile('settings.enc.json', encryptedPayload);
    return { mode: 'file' };
  }

  const token = githubToken.trim();
  if (!token) throw new Error(text.tokenRequired);

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: GITHUB_REF,
        inputs: { settings_enc_json_b64: jsonToBase64(encryptedPayload) },
      }),
    },
  );

  if (!response.ok) throw new Error(`${text.dispatchError}: HTTP ${response.status}`);
  return { mode: 'dispatch' };
}

function toEditableUser(user) {
  return {
    username:     normalizeUsername(user.username),
    displayName:  user.displayName || user.name || '',
    role:         normalizeRole(user.role, user.username),
    passwordHash: user.passwordHash || null,
    password:     '',
    nextPassword: '',
  };
}

export default function Admin({ user, language = 'it', onSettingsChange }) {
  const sessionUser = normalizeUsername(user?.username || '');
  const isAdmin = sessionUser === ADMIN_USER;
  const { admin, common } = getUiText(language);

  const [activeTab,   setActiveTab]   = useState('sistema');
  const [users,       setUsers]       = useState([]);
  const [views,       setViews]       = useState(DEFAULT_VIEWS);
  const [roleFilter,  setRoleFilter]  = useState(null);
  const [newUser,     setNewUser]     = useState(blankNewUser);
  const [githubToken, setGithubToken] = useState(CAN_DISPATCH_ACTIONS ? readSessionToken : '');
  const [status,      setStatus]      = useState({ type: 'idle', message: '' });
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);

  const hasDuplicateUsers = useMemo(() => {
    const seen = new Set();
    for (const item of users) {
      const u = normalizeUsername(item.username);
      if (!u) continue;
      if (seen.has(u)) return true;
      seen.add(u);
    }
    return false;
  }, [users]);

  const adminCount = useMemo(
    () => users.filter((u) => normalizeRole(u.role, u.username) === 'admin').length,
    [users],
  );
  const userCount = useMemo(
    () => users.filter((u) => normalizeRole(u.role, u.username) === 'user').length,
    [users],
  );

  const filteredUsers = useMemo(
    () => roleFilter ? users.filter((u) => normalizeRole(u.role, u.username) === roleFilter) : users,
    [users, roleFilter],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    loadAuthUsers()
      .then((data) => {
        if (cancelled) return;
        setUsers((data.users || []).map(toEditableUser));
        setViews({ ...DEFAULT_VIEWS, ...(data.views || {}) });
        setStatus({ type: 'ok', message: IS_DEV ? admin.loadOkDev : admin.loadOkProd });
      })
      .catch(() => { if (!cancelled) setStatus({ type: 'error', message: admin.loadError }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [admin.loadError, admin.loadOkDev, admin.loadOkProd, isAdmin]);

  // Applica il toggle subito in tutta l'app (sidebar, Insights, ecc. via onSettingsChange),
  // indipendentemente dal salvataggio: il pulsante "Salva" resta l'unico modo per
  // persistere la modifica in settings.enc.json / dispatch GitHub Actions.
  const updateView = (patch) => {
    setViews((v) => {
      const next = { ...v, ...patch };
      if (onSettingsChange) onSettingsChange(next);
      return next;
    });
  };

  const updateUser = (index, patch) =>
    setUsers((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const removeUser = (index) =>
    setUsers((items) => items.filter((_, i) => i !== index));

  const addUser = () => {
    const username = normalizeUsername(newUser.username);
    if (!username || !newUser.password) {
      setStatus({ type: 'error', message: admin.missingNewUser });
      return;
    }
    if (users.some((item) => normalizeUsername(item.username) === username)) {
      setStatus({ type: 'error', message: admin.duplicateUser });
      return;
    }
    setUsers((items) => [...items, { ...blankNewUser(), ...newUser, username }]);
    setNewUser(blankNewUser());
    setStatus({ type: 'ok', message: admin.userAdded });
  };

  const buildExportUsers = async () => {
    if (!users.length) throw new Error(admin.emptyList);
    if (hasDuplicateUsers) throw new Error(admin.duplicateList);
    if (!users.some((item) => normalizeUsername(item.username) === ADMIN_USER)) {
      throw new Error(admin.adminRequired);
    }

    const nextUsers = [];
    for (const item of users) {
      const username = normalizeUsername(item.username);
      const next = {
        username,
        displayName: item.displayName.trim(),
        role: normalizeRole(item.role, username),
      };
      const passwordToHash = item.nextPassword || item.password;
      if (passwordToHash) {
        next.passwordHash = await hashPasswordForBrowser(passwordToHash);
      } else if (item.passwordHash) {
        next.passwordHash = item.passwordHash;
      } else {
        throw new Error(`${admin.missingPassword} ${username}`);
      }
      nextUsers.push(next);
    }
    return nextUsers;
  };

  const saveChanges = async () => {
    setSaving(true);
    setStatus({ type: 'idle', message: '' });
    try {
      const exportUsers   = await buildExportUsers();
      const exportPayload = { users: exportUsers, views };
      const encrypted     = await encryptAuthPayloadForBrowser(exportPayload, getToken());
      const result        = await dispatchAdminUpdate(encrypted, githubToken, admin);
      setUsers(exportUsers.map(toEditableUser));
      if (onSettingsChange) onSettingsChange(views);
      setStatus({
        type: 'ok',
        message: result.mode === 'dispatch' ? admin.dispatchOk : admin.fileOk,
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || admin.saveError });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="admin-page admin-page--denied">
        <div className="admin-denied">
          <LuShieldCheck className="admin-denied-icon" />
          <h1>{admin.deniedTitle}</h1>
          <p>{admin.deniedMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <div className="admin-kicker"><LuShieldCheck /> Admin</div>
          <h1>{admin.title}</h1>
        </div>
        <div className="admin-header-actions">
          <div
            className={`admin-token-shell${githubToken ? ' has-value' : ''}`}
            title={CAN_DISPATCH_ACTIONS ? admin.dispatchToken : admin.noteDev}
          >
            <LuKeyRound className="admin-token-shell__icon" />
            <input
              className="admin-token-inline"
              type="password"
              value={githubToken}
              onChange={(e) => { setGithubToken(e.target.value); writeSessionToken(e.target.value); }}
              placeholder={admin.dispatchTokenPlaceholder}
              aria-label={admin.dispatchToken}
              autoComplete="off"
              disabled={!CAN_DISPATCH_ACTIONS}
            />
          </div>
          <button
            className="admin-export-btn"
            type="button"
            onClick={saveChanges}
            disabled={loading || saving || hasDuplicateUsers}
          >
            <LuSave /> {saving ? common.loading : admin.saveChanges}
          </button>
        </div>
      </header>

      {status.message && (
        <div className={`admin-status admin-status--${status.type}`}>{status.message}</div>
      )}

      <nav className="admin-tabs-nav">
        {ADMIN_TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            className={`admin-tab-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon /> {admin[`${id}Tab`]}
          </button>
        ))}
      </nav>

      {/* ── Utenti ──────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="admin-grid">
          <div className="admin-panel admin-panel--users">
            <div className="admin-panel-head">
              <LuUsers />
              <span>{admin.users}</span>
              {roleFilter && (
                <span className="admin-panel-head-filter">
                  <span className={`admin-role-badge admin-role-badge--${roleFilter}`}>
                    {roleFilter === 'admin' ? <LuShieldCheck /> : <LuUser />}
                    {roleFilter}
                  </span>
                  <button type="button" className="admin-filter-clear" onClick={() => setRoleFilter(null)}>✕</button>
                </span>
              )}
              <strong>{roleFilter ? `${filteredUsers.length} / ${users.length}` : users.length}</strong>
            </div>

            {loading ? (
              <div className="admin-empty">{common.loading}</div>
            ) : (
              <div className="admin-users-table">
                <div className="admin-ut-row admin-ut-row--head">
                  <div />
                  <div className="admin-ut-head">{admin.email} · {admin.name}</div>
                  <div className="admin-ut-head admin-ut-head--center">{admin.role}</div>
                  <div className="admin-ut-head admin-ut-head--pwd">{admin.newPassword}</div>
                  <div />
                </div>

                {filteredUsers.map((item, index) => {
                  const realIndex = users.indexOf(item);
                  const role = normalizeRole(item.role, item.username);
                  const locked = item.username === ADMIN_USER;
                  return (
                    <div className={`admin-ut-row${locked ? ' admin-ut-row--locked' : ''}`} key={`${item.username}-${index}`}>
                      <div className={`admin-ut-avatar admin-ut-avatar--${role}`}>
                        {role === 'admin' ? <LuShieldCheck /> : <LuUser />}
                      </div>

                      <div className="admin-ut-identity">
                        <input
                          className="admin-ut-input admin-ut-input--name"
                          value={item.displayName}
                          onChange={(e) => updateUser(realIndex, { displayName: e.target.value })}
                          placeholder={admin.name}
                        />
                        <input
                          className="admin-ut-input admin-ut-input--email"
                          value={item.username}
                          onChange={(e) => updateUser(realIndex, { username: normalizeUsername(e.target.value) })}
                          disabled={locked}
                          placeholder="email@hub.local"
                        />
                      </div>

                      <div className="admin-ut-cell--role">
                        <button
                          type="button"
                          className={`admin-role-badge admin-role-badge--${role}`}
                          onClick={() => updateUser(realIndex, { role: role === 'admin' ? 'user' : 'admin' })}
                          disabled={locked}
                        >
                          {role === 'admin' ? <LuShieldCheck /> : <LuUser />}
                          {role}
                        </button>
                      </div>

                      <div className="admin-ut-cell--pwd">
                        <input
                          className="admin-ut-input admin-ut-input--pwd"
                          type="password"
                          value={item.nextPassword}
                          onChange={(e) => updateUser(realIndex, { nextPassword: e.target.value })}
                          placeholder={admin.keepPassword}
                          autoComplete="new-password"
                        />
                      </div>

                      <div className="admin-ut-cell--actions">
                        <button
                          className="admin-icon-btn"
                          type="button"
                          onClick={() => removeUser(realIndex)}
                          disabled={locked}
                          title={admin.remove}
                        >
                          <LuTrash2 />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="admin-panel admin-panel--add">
            <div className="admin-panel-head"><LuPlus /><span>{admin.newUser}</span></div>
            <label>
              <span>{admin.email}</span>
              <input
                value={newUser.username}
                onChange={(e) => setNewUser((item) => ({ ...item, username: e.target.value }))}
                placeholder="user@hub.local"
              />
            </label>
            <label>
              <span>{admin.name}</span>
              <input
                value={newUser.displayName}
                onChange={(e) => setNewUser((item) => ({ ...item, displayName: e.target.value }))}
              />
            </label>
            <div className="admin-role-field">
              <span>{admin.role}</span>
              <button
                type="button"
                className={`admin-role-badge admin-role-badge--${normalizeRole(newUser.role)}`}
                onClick={() => setNewUser((item) => ({ ...item, role: normalizeRole(item.role) === 'admin' ? 'user' : 'admin' }))}
              >
                {normalizeRole(newUser.role) === 'admin' ? <LuShieldCheck /> : <LuUser />}
                {normalizeRole(newUser.role)}
              </button>
            </div>
            <label>
              <span>{admin.password}</span>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((item) => ({ ...item, password: e.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <button className="admin-secondary-btn" type="button" onClick={addUser}>
              <LuPlus /> {admin.addUser}
            </button>
            <div className="admin-note">
              <LuKeyRound />
              <p>{CAN_DISPATCH_ACTIONS ? admin.noteDispatch : admin.noteDev}</p>
            </div>
          </aside>
        </div>
      )}

      {/* ── Sistema ─────────────────────────────────────────────── */}
      {activeTab === 'sistema' && (
        <div className="admin-sistema">
          <div className="admin-stat-cards">
            <div className="admin-stat-card admin-stat-card--clickable" onClick={() => { setRoleFilter(null); setActiveTab('users'); }}>
              <div className="admin-stat-icon"><LuUsers /></div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">{loading ? '—' : users.length}</div>
                <div className="admin-stat-label">{admin.totalUsers}</div>
              </div>
            </div>
            <div className="admin-stat-card admin-stat-card--clickable" onClick={() => { setRoleFilter('admin'); setActiveTab('users'); }}>
              <div className="admin-stat-icon admin-stat-icon--admin"><LuShieldCheck /></div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">{loading ? '—' : adminCount}</div>
                <div className="admin-stat-label">{admin.adminCount}</div>
              </div>
            </div>
            <div className="admin-stat-card admin-stat-card--clickable" onClick={() => { setRoleFilter('user'); setActiveTab('users'); }}>
              <div className="admin-stat-icon admin-stat-icon--user"><LuUser /></div>
              <div className="admin-stat-body">
                <div className="admin-stat-value">{loading ? '—' : userCount}</div>
                <div className="admin-stat-label">{admin.userCount}</div>
              </div>
            </div>
          </div>

          <div className="admin-panel admin-panel--views">
            <div className="admin-panel-head"><LuEye /><span>{admin.viewVisibility}</span></div>
            <div className="admin-views-list">
              {MANAGEABLE_VIEWS.map(({ id, Icon }) => {
                const enabled = views[id] !== false;
                return (
                  <div className="admin-view-toggle-row" key={id}>
                    <Icon className="admin-view-icon" />
                    <span className="admin-view-label">{admin.viewNames?.[id] ?? id}</span>
                    <span className={`admin-view-state${enabled ? ' admin-view-state--on' : ' admin-view-state--off'}`}>
                      {enabled ? <LuEye /> : <LuEyeOff />}
                    </span>
                    <label className="admin-toggle-switch" title={enabled ? admin.viewNames?.[id] : admin.maintenance}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateView({ [id]: e.target.checked })}
                      />
                      <span className="admin-toggle-slider" />
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="admin-views-note">{admin.viewsNote}</p>
          </div>

          <div className="admin-panel admin-panel--infra">
            <div className="admin-panel-head"><LuServer /><span>{admin.infraSettings}</span></div>
            <div className="admin-views-list">
              <div className="admin-view-toggle-row">
                <SiProxmox className="admin-view-icon" style={{ color: '#f97316' }} />
                <span className="admin-view-label">Proxmox</span>
                <span className={`admin-view-state${views.infraProxmox !== false ? ' admin-view-state--on' : ' admin-view-state--off'}`}>
                  {views.infraProxmox !== false ? <LuEye /> : <LuEyeOff />}
                </span>
                <label className="admin-toggle-switch">
                  <input
                    type="checkbox"
                    checked={views.infraProxmox !== false}
                    onChange={(e) => updateView({ infraProxmox: e.target.checked })}
                  />
                  <span className="admin-toggle-slider" />
                </label>
              </div>
              <div className="admin-view-toggle-row">
                <GrVmware className="admin-view-icon" style={{ color: '#56a668' }} />
                <span className="admin-view-label">VMware</span>
                <span className={`admin-view-state${views.infraVmware !== false ? ' admin-view-state--on' : ' admin-view-state--off'}`}>
                  {views.infraVmware !== false ? <LuEye /> : <LuEyeOff />}
                </span>
                <label className="admin-toggle-switch">
                  <input
                    type="checkbox"
                    checked={views.infraVmware !== false}
                    onChange={(e) => updateView({ infraVmware: e.target.checked })}
                  />
                  <span className="admin-toggle-slider" />
                </label>
              </div>
              <div className="admin-view-toggle-row">
                <LuTerminal className="admin-view-icon" style={{ color: '#f97316' }} />
                <span className="admin-view-label">pmxtools CLI</span>
                <span className={`admin-view-state${views.infraPmxtoolsCli === true ? ' admin-view-state--on' : ' admin-view-state--off'}`}>
                  {views.infraPmxtoolsCli === true ? <LuEye /> : <LuEyeOff />}
                </span>
                <label className="admin-toggle-switch">
                  <input
                    type="checkbox"
                    checked={views.infraPmxtoolsCli === true}
                    onChange={(e) => updateView({ infraPmxtoolsCli: e.target.checked })}
                  />
                  <span className="admin-toggle-slider" />
                </label>
              </div>
              <div className="admin-view-toggle-row">
                <LuFileJson className="admin-view-icon" style={{ color: '#f97316' }} />
                <span className="admin-view-label">pmxtools</span>
                <span className={`admin-view-state${views.infraPmxtoolsDownload !== false ? ' admin-view-state--on' : ' admin-view-state--off'}`}>
                  {views.infraPmxtoolsDownload !== false ? <LuEye /> : <LuEyeOff />}
                </span>
                <label className="admin-toggle-switch">
                  <input
                    type="checkbox"
                    checked={views.infraPmxtoolsDownload !== false}
                    onChange={(e) => updateView({ infraPmxtoolsDownload: e.target.checked })}
                  />
                  <span className="admin-toggle-slider" />
                </label>
              </div>
              <div className="admin-view-toggle-row">
                <LuWrench className="admin-view-icon" style={{ color: '#56a668' }} />
                <span className="admin-view-label">RVTools converter</span>
                <span className={`admin-view-state${views.infraRvtoolsConverter !== false ? ' admin-view-state--on' : ' admin-view-state--off'}`}>
                  {views.infraRvtoolsConverter !== false ? <LuEye /> : <LuEyeOff />}
                </span>
                <label className="admin-toggle-switch">
                  <input
                    type="checkbox"
                    checked={views.infraRvtoolsConverter !== false}
                    onChange={(e) => updateView({ infraRvtoolsConverter: e.target.checked })}
                  />
                  <span className="admin-toggle-slider" />
                </label>
              </div>
            </div>
            <p className="admin-views-note">{admin.infraNote}</p>
          </div>

          <div className="admin-panel admin-panel--info">
            <div className="admin-panel-head"><LuPackage /><span>{admin.appInfo}</span></div>
            <div className="admin-info-rows">
              <div className="admin-info-row">
                <span>{admin.appVersion}</span><strong>{pkg.version}</strong>
              </div>
              <div className="admin-info-row">
                <span>{admin.appBuild}</span><strong>{pkg.build}</strong>
              </div>
              <div className="admin-info-row">
                <span>{admin.appUpdated}</span><strong>{pkg.updated}</strong>
              </div>
              <div className="admin-info-row">
                <span>{admin.settingsFile}</span><strong>settings.enc.json</strong>
              </div>
              <div className="admin-info-row">
                <span>{admin.deployRepo}</span>
                <a
                  href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-repo-link"
                >
                  {GITHUB_OWNER}/{GITHUB_REPO} <LuExternalLink />
                </a>
              </div>
              <div className="admin-info-row">
                <span>{admin.deployBranch}</span><strong>{GITHUB_REF}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
