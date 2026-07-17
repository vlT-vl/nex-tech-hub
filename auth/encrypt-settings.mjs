import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto';

const AUTH_V2_ALG = 'AES-GCM';
const AUTH_V2_KDF = 'PBKDF2-SHA256';
const AUTH_V2_TYPE = 'nth-auth-users';
const ADMIN_USER = 'vlt@hub.local';
const DEFAULT_SETTINGS_OUTPUT = 'public/settings.enc.json';
const AUTH_ENCRYPT_ITERATIONS = 310000;
const AUTH_PASSWORD_ITERATIONS = 210000;
const KEY_LENGTH = 32;
const MAX_AUTH_USERS = 100;
const MAX_ENCRYPTED_PAYLOAD_BYTES = 256 * 1024;
const ROLE_OPTIONS = ['user', 'admin'];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeUsername(value) {
  return String(value || '').toLowerCase().trim();
}

function normalizeRole(value, username = '') {
  if (normalizeUsername(username) === ADMIN_USER) return 'admin';
  const role = String(value || 'user').toLowerCase().trim();
  return ROLE_OPTIONS.includes(role) ? role : 'user';
}

function deriveKey(password, salt, iterations) {
  return pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, KEY_LENGTH, 'sha256');
}

function hashPassword(password, options = {}) {
  const iterations = Number(options.iterations || AUTH_PASSWORD_ITERATIONS);
  const salt = options.salt ? Buffer.from(options.salt, 'base64') : randomBytes(16);
  const hash = deriveKey(password || '', salt, iterations);
  return {
    v: 1,
    alg: AUTH_V2_KDF,
    iterations,
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
  };
}

function normalizeUsers(users) {
  if (!Array.isArray(users) || users.length === 0 || users.length > MAX_AUTH_USERS) {
    throw new Error('Invalid users list');
  }

  const seen = new Set();
  return users.map((user) => {
    const username = normalizeUsername(user?.username);
    if (!username) {
      throw new Error('User without username');
    }
    if (seen.has(username)) {
      throw new Error(`Duplicate user: ${username}`);
    }
    seen.add(username);

    const passwordHash = user.passwordHash || (typeof user.password === 'string' ? hashPassword(user.password) : null);
    if (!passwordHash) {
      throw new Error(`Missing password for ${username}`);
    }

    return {
      username,
      displayName: user.displayName || user.name || '',
      role: normalizeRole(user.role, username),
      passwordHash,
    };
  });
}

const KNOWN_VIEWS = ['dashboard', 'techrelease', 'infra', 'githubrepo', 'about', 'infraProxmox', 'infraVmware'];

function normalizeViews(views) {
  if (!views || typeof views !== 'object' || Array.isArray(views)) return undefined;
  const out = {};
  for (const id of KNOWN_VIEWS) {
    out[id] = views[id] !== false;
  }
  return out;
}

function readSettingsPayload(inputFile) {
  const source = JSON.parse(readFileSync(resolve(inputFile), 'utf8'));
  const payload = { users: normalizeUsers(source.users || source) };
  const views = normalizeViews(source.views);
  if (views) payload.views = views;
  return payload;
}

function encryptPayload(payload, token) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(token, salt, AUTH_ENCRYPT_ITERATIONS);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);

  return {
    v: 2,
    type: AUTH_V2_TYPE,
    alg: AUTH_V2_ALG,
    kdf: AUTH_V2_KDF,
    iterations: AUTH_ENCRYPT_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64'),
  };
}

function assertBase64(value) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('Encrypted users payload must be base64');
  }
}

function validateEncryptedPayload(payload) {
  if (
    payload?.v !== 2 ||
    payload?.type !== AUTH_V2_TYPE ||
    payload?.alg !== AUTH_V2_ALG ||
    payload?.kdf !== AUTH_V2_KDF ||
    !Number.isSafeInteger(Number(payload.iterations)) ||
    Number(payload.iterations) < 100000 ||
    typeof payload.salt !== 'string' ||
    typeof payload.iv !== 'string' ||
    typeof payload.data !== 'string'
  ) {
    throw new Error('Invalid encrypted auth payload');
  }

  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  if (salt.length < 16 || iv.length !== 12 || data.length < 17) {
    throw new Error('Invalid encrypted auth payload dimensions');
  }
}

function readEncryptedPayload(inputFile) {
  const raw = readFileSync(resolve(inputFile), 'utf8');
  if (Buffer.byteLength(raw, 'utf8') > MAX_ENCRYPTED_PAYLOAD_BYTES) {
    throw new Error('Encrypted users payload is too large');
  }
  const payload = JSON.parse(raw);
  validateEncryptedPayload(payload);
  return { raw, payload };
}

function writeEncryptedPayload(outputFile, payload) {
  const output = resolve(outputFile);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Encrypted auth payload written to ${output}`);
}

function encryptSettings(inputFile, outputFile = DEFAULT_SETTINGS_OUTPUT) {
  const encrypted = encryptPayload(readSettingsPayload(inputFile), requiredEnv('NTH_AES_TOKEN'));
  writeEncryptedPayload(outputFile, encrypted);
}

function printSecret(inputFile = DEFAULT_SETTINGS_OUTPUT) {
  const { raw } = readEncryptedPayload(inputFile);
  process.stdout.write(Buffer.from(raw, 'utf8').toString('base64'));
  process.stdout.write('\n');
}

function writeFromEnv(outputFile = process.env.NTH_SETTINGS_OUTPUT || DEFAULT_SETTINGS_OUTPUT) {
  const encoded = requiredEnv('NTH_SETTINGS_ENC_JSON_B64');
  assertBase64(encoded);
  const raw = Buffer.from(encoded, 'base64').toString('utf8');
  if (Buffer.byteLength(raw, 'utf8') > MAX_ENCRYPTED_PAYLOAD_BYTES) {
    throw new Error('Encrypted users payload is too large');
  }
  const payload = JSON.parse(raw);
  validateEncryptedPayload(payload);
  writeEncryptedPayload(outputFile, payload);
}

function main() {
  const [command, inputFile, outputFile] = process.argv.slice(2);

  if (command === 'encrypt') {
    if (!inputFile) throw new Error('Usage: node auth/encrypt-settings.mjs encrypt <users.json> [output]');
    encryptSettings(inputFile, outputFile);
    return;
  }

  if (command === 'secret') {
    printSecret(inputFile || DEFAULT_SETTINGS_OUTPUT);
    return;
  }

  if (command === 'write-env') {
    writeFromEnv(inputFile || process.env.NTH_SETTINGS_OUTPUT || DEFAULT_SETTINGS_OUTPUT);
    return;
  }

  throw new Error('Usage: node auth/encrypt-settings.mjs <encrypt|secret|write-env> [...]');
}

main();
