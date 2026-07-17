const SESSION_KEY  = 'nth_user';
const SETTINGS_KEY = 'nth_settings';
const SENSITIVE_FIELD_RE = /(password|passwd|pwd|token|secret|api[_-]?key|salt|hash|credential)/i;

export function stripSensitiveFields(value, seen = new WeakSet()) {
  if (Array.isArray(value)) {
    return value.map(item => stripSensitiveFields(item, seen));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_FIELD_RE.test(key))
      .map(([key, item]) => [key, stripSensitiveFields(item, seen)])
  );
}

export function createSessionUser(user) {
  if (!user || typeof user !== 'object') return null;

  const sessionUser = stripSensitiveFields(user);
  return sessionUser && Object.keys(sessionUser).length > 0 ? sessionUser : null;
}

export function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session = createSessionUser(JSON.parse(raw));
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const cleanRaw = JSON.stringify(session);
    if (cleanRaw !== raw) {
      localStorage.setItem(SESSION_KEY, cleanRaw);
    }

    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function persistSessionUser(user) {
  const session = createSessionUser(user);
  if (!session) {
    throw new Error('Sessione utente non valida');
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SETTINGS_KEY);
}

const DEFAULT_VIEWS = { dashboard: true, techrelease: true, infra: true, githubrepo: true, about: true };

export function persistSessionSettings(views) {
  try {
    const safe = views && typeof views === 'object' ? views : DEFAULT_VIEWS;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ views: safe }));
  } catch {}
}

export function readStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(String(a ?? ''));
  const right = encoder.encode(String(b ?? ''));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }

  return diff === 0;
}
