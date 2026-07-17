const AUTH_V2_ALG = 'AES-GCM';
const AUTH_V2_KDF = 'PBKDF2-SHA256';
const AUTH_V2_TYPE = 'nth-auth-users';
const ADMIN_USER = 'vlt@hub.local';
const AUTH_ENCRYPT_ITERATIONS = 310000;
const AUTH_PASSWORD_ITERATIONS = 210000;
const FETCH_TIMEOUT_MS = 6000;
const MAX_AUTH_PAYLOAD_BYTES = 256 * 1024;
const MAX_AUTH_USERS = 100;
const ROLE_OPTIONS = ['user', 'admin'];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64ToUint8Array(base64) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    return new Uint8Array();
  }

  try {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array();
  }
}

function uint8ArrayToBase64(bytes) {
  let raw = '';
  bytes.forEach((byte) => {
    raw += String.fromCharCode(byte);
  });
  return btoa(raw);
}

async function importPasswordMaterial(password) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );
}

async function deriveAesKey(password, salt, iterations, algorithm) {
  const keyMaterial = await importPasswordMaterial(password);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: algorithm, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function derivePasswordHash(password, salt, iterations) {
  const keyMaterial = await importPasswordMaterial(password);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

function timingSafeBytesEqual(left, right) {
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

function normalizeUsername(value) {
  return String(value || '').toLowerCase().trim();
}

function normalizeRole(value, username = '') {
  if (normalizeUsername(username) === ADMIN_USER) return 'admin';
  const role = String(value || 'user').toLowerCase().trim();
  return ROLE_OPTIONS.includes(role) ? role : 'user';
}

function assertV2Payload(payload) {
  if (payload?.v !== 2 || payload?.type !== AUTH_V2_TYPE || payload?.alg !== AUTH_V2_ALG || payload?.kdf !== AUTH_V2_KDF) {
    throw new Error('Formato auth cifrato non supportato');
  }

  const iterations = Number(payload.iterations);
  const salt = base64ToUint8Array(payload.salt);
  const iv = base64ToUint8Array(payload.iv);
  const encryptedData = base64ToUint8Array(payload.data);

  if (!Number.isSafeInteger(iterations) || iterations < 100000 || salt.length < 16 || iv.length !== 12 || encryptedData.length < 17) {
    throw new Error('Payload auth cifrato non valido');
  }

  return { iterations, salt, iv, encryptedData };
}

async function decryptV2Json(payload, password) {
  const { iterations, salt, iv, encryptedData } = assertV2Payload(payload);
  const key = await deriveAesKey(password, salt, iterations, AUTH_V2_ALG);
  const decrypted = await crypto.subtle.decrypt(
    { name: AUTH_V2_ALG, iv },
    key,
    encryptedData,
  );
  return JSON.parse(textDecoder.decode(decrypted));
}

export async function decryptAuthPayload(payload, password) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload auth non valido');
  }

  return decryptV2Json(payload, password);
}

function validateSettingsPayload(payload) {
  const users = payload?.users;
  if (!payload || typeof payload !== 'object' || !Array.isArray(users) || users.length === 0 || users.length > MAX_AUTH_USERS) {
    throw new Error('Schema settings non valido');
  }

  const seen = new Set();
  users.forEach((user) => {
    const username = user?.username;
    if (!user || typeof user !== 'object' || typeof username !== 'string' || !username.trim()) {
      throw new Error('Utente auth non valido');
    }

    const normalized = username.toLowerCase().trim();
    if (seen.has(normalized)) {
      throw new Error('Utente auth duplicato');
    }
    seen.add(normalized);

    if (!user.passwordHash) {
      throw new Error('Credenziali utente auth mancanti');
    }
  });

  return payload;
}

function assertAuthUserForExport(user) {
  const username = user?.username?.toLowerCase().trim();
  if (!username) {
    throw new Error('Utente auth senza username');
  }

  if (!user.passwordHash && typeof user.password !== 'string') {
    throw new Error(`Credenziali mancanti per ${username}`);
  }

  return username;
}

export async function normalizeUsersForAuthExport(users) {
  if (!Array.isArray(users) || users.length === 0 || users.length > MAX_AUTH_USERS) {
    throw new Error('Lista utenti auth non valida');
  }

  const seen = new Set();
  const normalized = [];

  for (const user of users) {
    const username = assertAuthUserForExport(user);
    if (seen.has(username)) {
      throw new Error(`Utente duplicato: ${username}`);
    }
    seen.add(username);

    const next = { ...user, username };
    next.role = normalizeRole(next.role, username);
    if (!next.passwordHash) {
      next.passwordHash = await hashPasswordForBrowser(next.password, { iterations: AUTH_PASSWORD_ITERATIONS });
    }
    delete next.password;
    normalized.push(next);
  }

  return normalized;
}

export async function encryptAuthPayloadForBrowser(payload, password, options = {}) {
  if (!password) {
    throw new Error('Token auth mancante');
  }

  const users = await normalizeUsersForAuthExport(payload?.users || payload);
  const exportPayload = { ...(Array.isArray(payload) ? {} : payload), users };
  validateSettingsPayload(exportPayload);

  const iterations = Number(options.iterations || AUTH_ENCRYPT_ITERATIONS);
  if (!Number.isSafeInteger(iterations) || iterations < 100000) {
    throw new Error('Iterazioni auth non valide');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, iterations, AUTH_V2_ALG);
  const encrypted = await crypto.subtle.encrypt(
    { name: AUTH_V2_ALG, iv },
    key,
    textEncoder.encode(JSON.stringify(exportPayload)),
  );

  return {
    v: 2,
    type: AUTH_V2_TYPE,
    alg: AUTH_V2_ALG,
    kdf: AUTH_V2_KDF,
    iterations,
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    data: uint8ArrayToBase64(new Uint8Array(encrypted)),
  };
}

export async function verifyAuthPassword(user, password) {
  const hash = user?.passwordHash;
  if (!hash) {
    return false;
  }

  if (hash?.v !== 1 || hash?.alg !== AUTH_V2_KDF) {
    return false;
  }

  const iterations = Number(hash.iterations);
  const salt = base64ToUint8Array(hash.salt);
  const expected = base64ToUint8Array(hash.hash);
  if (!Number.isSafeInteger(iterations) || iterations < 100000 || salt.length < 16 || expected.length === 0) {
    return false;
  }

  const actual = await derivePasswordHash(password || '', salt, iterations);
  return timingSafeBytesEqual(actual, expected);
}

export async function hashPasswordForBrowser(password, options = {}) {
  const iterations = Number(options.iterations || 210000);
  const salt = options.salt ? base64ToUint8Array(options.salt) : crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password || '', salt, iterations);
  return {
    v: 1,
    alg: AUTH_V2_KDF,
    iterations,
    salt: uint8ArrayToBase64(salt),
    hash: uint8ArrayToBase64(hash),
  };
}

async function fetchJsonPayload(filePath) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(filePath, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Errore fetch JSON: ${filePath}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_AUTH_PAYLOAD_BYTES) {
      throw new Error('Payload auth troppo grande');
    }

    const raw = await response.text();
    if (raw.length > MAX_AUTH_PAYLOAD_BYTES) {
      throw new Error('Payload auth troppo grande');
    }

    return JSON.parse(raw);
  } finally {
    window.clearTimeout(timeout);
  }
}

export default async function loadSettingsPayload(filePath, password) {
  if (!filePath || !password) {
    throw new Error('Parametri loadSettingsPayload non validi');
  }

  const data = await decryptAuthPayload(await fetchJsonPayload(filePath), password);
  return validateSettingsPayload(data);
}
