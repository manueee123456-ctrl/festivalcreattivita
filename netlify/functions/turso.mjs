import crypto from 'node:crypto';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const SECURITY_SALT = 'FDC_2026_SECURITY_SALT_v1';
const MAX_BODY_BYTES = 5_500_000;
const MAX_MIRROR_RECORDS = 500;

function response(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function tursoBaseUrl() {
  const raw = env('TURSO_DATABASE_URL');
  if (!raw) throw new Error('TURSO_DATABASE_URL non configurato');
  return raw.replace(/^libsql:/i, 'https:').replace(/\/+$/, '');
}

function tursoToken() {
  const token = env('TURSO_AUTH_TOKEN');
  if (!token) throw new Error('TURSO_AUTH_TOKEN non configurato');
  return token;
}

function toTursoValue(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { type: 'null' };
    return Number.isInteger(value)
      ? { type: 'integer', value: String(value) }
      : { type: 'float', value };
  }
  if (typeof value === 'bigint') return { type: 'integer', value: value.toString() };
  return { type: 'text', value: typeof value === 'string' ? value : JSON.stringify(value) };
}

function statement(sql, args = []) {
  return { sql, args: args.map(toTursoValue) };
}

function fromTursoValue(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer' || cell.type === 'float') return Number(cell.value);
  return cell.value;
}

async function tursoPipeline(requests) {
  const res = await fetch(tursoBaseUrl() + '/v2/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + tursoToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests: [...requests, { type: 'close' }] })
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Risposta Turso non valida (' + res.status + ')'); }
  if (!res.ok) throw new Error(data?.error?.message || 'Errore HTTP Turso ' + res.status);
  const streamError = (data.results || []).find(r => r?.type === 'error');
  if (streamError) throw new Error(streamError.error?.message || 'Errore Turso');
  return data;
}

async function tursoExecute(sql, args = []) {
  const data = await tursoPipeline([{ type: 'execute', stmt: statement(sql, args) }]);
  const first = data.results?.[0];
  if (!first || first.type !== 'ok') throw new Error('Esecuzione Turso non riuscita');
  return first.response?.result || {};
}

async function tursoQuery(sql, args = []) {
  const result = await tursoExecute(sql, args);
  const cols = result.cols || [];
  return (result.rows || []).map(row => {
    const out = {};
    row.forEach((cell, index) => {
      out[cols[index]?.name || String(index)] = fromTursoValue(cell);
    });
    return out;
  });
}

function previousStepOk(step) {
  return { type: 'ok', step };
}

async function tursoAtomic(statements) {
  if (!statements.length) return;
  const steps = [{ stmt: statement('BEGIN IMMEDIATE') }];
  for (const item of statements) {
    steps.push({
      condition: previousStepOk(steps.length - 1),
      stmt: statement(item.sql, item.args || [])
    });
  }
  const lastWriteStep = steps.length - 1;
  steps.push({ condition: previousStepOk(lastWriteStep), stmt: statement('COMMIT') });
  const commitStep = steps.length - 1;
  steps.push({
    condition: { type: 'not', cond: { type: 'is_autocommit' } },
    stmt: statement('ROLLBACK')
  });

  const data = await tursoPipeline([{ type: 'batch', batch: { steps } }]);
  const first = data.results?.[0];
  if (!first || first.type !== 'ok' || first.response?.type !== 'batch') {
    throw new Error('Transazione Turso non riuscita');
  }
  const result = first.response.result || {};
  const errors = result.step_errors || [];
  const writeError = errors.slice(0, commitStep + 1).find(Boolean);
  if (writeError) throw new Error(writeError.message || 'Errore nella transazione Turso');
}

let schemaPromise;
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = tursoAtomic([
      {
        sql: `CREATE TABLE IF NOT EXISTS app_documents (
          collection_path TEXT NOT NULL,
          doc_id TEXT NOT NULL,
          data_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL DEFAULT 'turso',
          PRIMARY KEY (collection_path, doc_id)
        )`
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_app_documents_active
              ON app_documents(collection_path, deleted, updated_at)`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS activities_history (
          history_id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_json TEXT NOT NULL,
          actor_email TEXT,
          created_at INTEGER NOT NULL
        )`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS password_reset_codes (
          email TEXT PRIMARY KEY,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          requested_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0
        )`
      }
    ]).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function getAppDocument(collectionPath, docId, includeDeleted = false) {
  collectionPath = normalizePath(collectionPath);
  docId = normalizeDocId(docId);
  const rows = await tursoQuery(
    `SELECT doc_id, data_json, updated_at, deleted
     FROM app_documents
     WHERE collection_path=? AND doc_id=? ${includeDeleted ? '' : 'AND deleted=0'}
     LIMIT 1`,
    [collectionPath, docId]
  );
  if (!rows.length) return null;
  let data = {};
  try { data = JSON.parse(rows[0].data_json || '{}'); } catch {}
  return { docId: rows[0].doc_id, data, updatedAt: rows[0].updated_at, deleted: !!rows[0].deleted };
}

async function listAppDocuments(collectionPath) {
  collectionPath = normalizePath(collectionPath);
  const rows = await tursoQuery(
    `SELECT doc_id, data_json, updated_at
     FROM app_documents
     WHERE collection_path=? AND deleted=0`,
    [collectionPath]
  );
  return rows.map(row => {
    let data = {};
    try { data = JSON.parse(row.data_json || '{}'); } catch {}
    return { docId: row.doc_id, data, updatedAt: row.updated_at };
  });
}

async function findUserRecord(email) {
  email = String(email || '').trim().toLowerCase();
  const direct = await getAppDocument('users', email);
  if (direct) return direct;
  const records = await listAppDocuments('users');
  return records.find(record => String(record.data?.email || '').toLowerCase() === email) || null;
}

function fieldValue(data, path) {
  return String(path || '').split('.').reduce((value, key) => value == null ? undefined : value[key], data);
}

function comparableValue(value) {
  if (value && typeof value === 'object' && value.__type && value.value) return value.value;
  return value;
}

function applyQuery(records, filters = [], orderBy = [], rowLimit = 0) {
  let result = records.slice();
  for (const filter of filters || []) {
    if (filter.op !== '==') throw new Error('Operatore query non supportato');
    result = result.filter(record => comparableValue(fieldValue(record.data, filter.field)) === comparableValue(filter.value));
  }
  if (orderBy && orderBy.length) {
    result.sort((a, b) => {
      for (const order of orderBy) {
        const av = comparableValue(fieldValue(a.data, order.field));
        const bv = comparableValue(fieldValue(b.data, order.field));
        if (av === bv) continue;
        const direction = String(order.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
        if (av == null) return 1 * direction;
        if (bv == null) return -1 * direction;
        return (av < bv ? -1 : 1) * direction;
      }
      return a.docId.localeCompare(b.docId);
    });
  }
  const limit = Math.max(0, Math.min(1000, Number(rowLimit) || 0));
  return limit ? result.slice(0, limit) : result;
}

const DELETE_VALUE = Symbol('delete-value');

function resolveWriteValue(value, existingValue) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.__op === 'serverTimestamp') {
      return { __type: 'timestamp', value: new Date().toISOString() };
    }
    if (value.__op === 'increment') {
      return (Number(existingValue) || 0) + (Number(value.value) || 0);
    }
    if (value.__op === 'delete') return DELETE_VALUE;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = resolveWriteValue(child, existingValue && typeof existingValue === 'object' ? existingValue[key] : undefined);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(item => resolveWriteValue(item, undefined)).filter(item => item !== DELETE_VALUE);
  return value === undefined ? null : value;
}

function deepMerge(existing, patch) {
  const out = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === DELETE_VALUE) delete out[key];
    else if (value && typeof value === 'object' && !Array.isArray(value) && !value.__type) out[key] = deepMerge(out[key], value);
    else out[key] = value;
  }
  return out;
}

function stripDeleted(value) {
  if (value === DELETE_VALUE) return undefined;
  if (Array.isArray(value)) return value.map(stripDeleted).filter(item => item !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      const clean = stripDeleted(child);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return value;
}

function buildStoredData(input, existing, merge) {
  const resolved = resolveWriteValue(input || {}, existing || {});
  return merge ? deepMerge(existing || {}, resolved) : stripDeleted(resolved);
}

function primaryEmail(data) {
  return String(data?.userEmail || data?.email || '').trim().toLowerCase();
}

function canReadCollection(session, path) {
  if (['settings', 'counts', 'annunci', 'hype'].includes(path)) return true;
  if (/^chats\/[^/]+\/messages$/.test(path)) return true;
  if (!session) return false;
  if (session.role === 'admin') return true;
  if (path === 'bookings' || path === 'waitlist' || path === 'users') return true;
  if (path === 'staffradio') return ['admin', 'controller', 'helper'].includes(session.role);
  if (['admins', 'controllers', 'helpers', 'analytics'].includes(path)) return false;
  return false;
}

function filterReadableRecords(session, path, records) {
  if (!session || session.role === 'admin') return records;
  if (path === 'bookings' && ['controller', 'helper'].includes(session.role)) return records;
  if (path === 'bookings' || path === 'waitlist' || path === 'users') {
    const email = String(session.email || '').toLowerCase();
    return records.filter(record => primaryEmail(record.data) === email || record.docId.toLowerCase() === email);
  }
  return records;
}

function sanitizeRecordForClient(path, record, session) {
  if (!record) return null;
  const data = { ...(record.data || {}) };
  if (session?.role !== 'admin' && ['users', 'admins', 'controllers', 'helpers'].includes(path)) {
    delete data.passHash;
    delete data.rawPass;
  }
  return { ...record, data };
}

function canWriteDocument(session, path, docId, data) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  const email = String(session.email || '').toLowerCase();
  if (path === 'users') return docId.toLowerCase() === email;
  if (path === 'waitlist') return docId.toLowerCase().includes(email) || primaryEmail(data) === email;
  if (/^chats\/[^/]+\/messages$/.test(path)) return String(data?.email || '').toLowerCase() === email;
  if (path === 'hype' || path === 'analytics') return true;
  if (path === 'staffradio') return ['admin', 'controller', 'helper'].includes(session.role) && String(data?.email || email).toLowerCase() === email;
  return false;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function legacyHash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) - h) + value.charCodeAt(i);
    h |= 0;
  }
  return 'h_' + Math.abs(h);
}

function passwordMatches(password, storedHash) {
  if (!password || !storedHash) return false;
  const candidates = [
    sha256(password + ':' + SECURITY_SALT),
    sha256(password),
    Buffer.from(password).toString('base64'),
    legacyHash(password)
  ];
  return candidates.some(candidate => {
    if (candidate.length !== String(storedHash).length) return false;
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(String(storedHash)));
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signSession(payload) {
  const secret = env('APP_SESSION_SECRET');
  if (secret.length < 32) throw new Error('APP_SESSION_SECRET deve contenere almeno 32 caratteri');
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

function verifySession(token) {
  const secret = env('APP_SESSION_SECRET');
  if (!token || secret.length < 32) return null;
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.email || !payload.role || Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function bearerToken(headers = {}) {
  const auth = headers.authorization || headers.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

// Durata della sessione: legge l'impostazione "Scadenza sessione (ore)" dal sito
// (settings/site.sessionHours), con valore predefinito 24 ore.
const SESSION_DEFAULT_MS = 24 * 60 * 60 * 1000;
const SESSION_RENEW_WINDOW_MS = 2 * 60 * 60 * 1000;

async function sessionTtlMs() {
  try {
    const site = await getAppDocument('settings', 'site');
    const hours = Number(site && site.data && site.data.sessionHours);
    if (Number.isFinite(hours) && hours >= 1) return Math.min(168, hours) * 60 * 60 * 1000;
  } catch {}
  return SESSION_DEFAULT_MS;
}

async function resolveCurrentRole(email) {
  email = String(email || '').trim().toLowerCase();
  const mainAdminEmail = env('ADMIN_EMAIL', 'manuel.magnani29@gmail.com').toLowerCase();
  if (email === mainAdminEmail) return 'admin';
  for (const [collection, role] of [['admins', 'admin'], ['controllers', 'controller'], ['helpers', 'helper']]) {
    const record = await getAppDocument(collection, email).catch(() => null);
    if (record && record.data) return role;
  }
  const profileRecord = await findUserRecord(email).catch(() => null);
  const profileRole = String(profileRecord?.data?.role || 'user');
  return ['admin', 'controller', 'helper', 'user'].includes(profileRole) ? profileRole : 'user';
}

async function createSession(email, password) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (!email || !password) throw new Error('Email e password obbligatorie');

  await ensureSchema();
  const candidates = [];
  const mainAdminEmail = env('ADMIN_EMAIL', 'manuel.magnani29@gmail.com').toLowerCase();
  const profileRecord = await findUserRecord(email).catch(() => null);
  const profile = profileRecord?.data || null;

  // Per l'admin principale accetta prima la password aggiornata su Turso,
  // poi l'hash di emergenza configurato nelle variabili Netlify.
  if (email === mainAdminEmail) {
    if (profile?.passHash) candidates.push({ hash: profile.passHash, role: 'admin' });
    if (env('ADMIN_PASS_HASH')) candidates.push({ hash: env('ADMIN_PASS_HASH'), role: 'admin' });
  } else {
    // Mantiene lo stesso ordine del login nel sito: ruoli staff prima dell'utente normale.
    for (const [collection, candidateRole] of [['admins', 'admin'], ['controllers', 'controller'], ['helpers', 'helper']]) {
      const roleRecord = await getAppDocument(collection, email).catch(() => null);
      if (roleRecord?.data?.passHash) candidates.push({ hash: roleRecord.data.passHash, role: candidateRole });
    }
    if (profile?.passHash && profile.verified !== false) candidates.push({ hash: profile.passHash, role: profile.role || 'user' });
  }

  const matched = candidates.find(candidate => passwordMatches(password, candidate.hash));
  if (!matched) throw new Error('Credenziali non valide');

  const now = Date.now();
  const payload = { email, role: matched.role, iat: now, exp: now + (await sessionTtlMs()) };
  return { token: signSession(payload), user: { email, role: matched.role }, expiresAt: payload.exp };
}

function normalizePath(value) {
  const path = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  if (!path || path.length > 300 || !/^[A-Za-z0-9_@.\/-]+$/.test(path)) throw new Error('Percorso raccolta non valido');
  return path;
}

function normalizeDocId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 500 || /[\u0000-\u001f]/.test(id)) throw new Error('ID documento non valido');
  return id;
}

function authorizeDocumentWrite(session, path, docId, data, deleting = false) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  const email = String(session.email || '').toLowerCase();
  if (path === 'users') return docId.toLowerCase() === email;
  if (path === 'bookings') return String(data?.userEmail || '').toLowerCase() === email;
  if (path === 'waitlist') return docId.toLowerCase().includes(email) || String(data?.userEmail || '').toLowerCase() === email;
  if (/^chats\/[^/]+\/messages$/.test(path)) return String(data?.email || '').toLowerCase() === email;
  if (path === 'counts' || path === 'hype') return true;
  if (path === 'staffradio') return ['admin', 'controller', 'helper'].includes(session.role);
  return false;
}

function normalizeMirrorRecord(record) {
  const collectionPath = normalizePath(record?.collectionPath);
  const docId = normalizeDocId(record?.docId);
  const data = record?.data && typeof record.data === 'object' ? record.data : {};
  const dataJson = JSON.stringify(data);
  if (Buffer.byteLength(dataJson) > 800_000) throw new Error('Documento troppo grande');
  return {
    collectionPath,
    docId,
    data,
    dataJson,
    deleted: record?.deleted ? 1 : 0,
    updatedAt: Number(record?.updatedAt) || Date.now(),
    source: String(record?.source || 'turso').slice(0, 30)
  };
}

function mirrorUpsertStatement(record) {
  return {
    sql: `INSERT INTO app_documents
          (collection_path, doc_id, data_json, updated_at, deleted, source)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(collection_path, doc_id) DO UPDATE SET
            data_json=excluded.data_json,
            updated_at=excluded.updated_at,
            deleted=excluded.deleted,
            source=excluded.source`,
    args: [record.collectionPath, record.docId, record.dataJson, record.updatedAt, record.deleted, record.source]
  };
}

async function upsertMirrorRecords(records) {
  if (!Array.isArray(records) || !records.length) return 0;
  if (records.length > MAX_MIRROR_RECORDS) throw new Error('Troppi documenti in una singola richiesta');
  const normalized = records.map(normalizeMirrorRecord);
  await tursoAtomic(normalized.map(mirrorUpsertStatement));
  return normalized.length;
}

async function reconcileMirrorCollection(collectionPath, records) {
  collectionPath = normalizePath(collectionPath);
  if (!Array.isArray(records) || records.length > MAX_MIRROR_RECORDS) throw new Error('Elenco documenti non valido');
  const normalized = records.map(record => normalizeMirrorRecord({ ...record, collectionPath, deleted: false }));
  const now = Date.now();
  const statements = [{
    sql: `UPDATE app_documents SET deleted=1, updated_at=?
          WHERE collection_path=? AND deleted=0`,
    args: [now, collectionPath]
  }];
  statements.push(...normalized.map(mirrorUpsertStatement));
  await tursoAtomic(statements);
  return normalized.length;
}

async function deleteMirrorRecord(collectionPath, docId, previousData = {}) {
  const record = normalizeMirrorRecord({ collectionPath, docId, data: previousData, deleted: true });
  await tursoAtomic([mirrorUpsertStatement(record)]);
}

async function setAppDocument(collectionPath, docId, inputData, merge = false, source = 'turso') {
  const existingRecord = await getAppDocument(collectionPath, docId, true);
  const existingData = existingRecord && !existingRecord.deleted ? existingRecord.data : {};
  const data = buildStoredData(inputData, existingData, !!merge);
  const record = normalizeMirrorRecord({ collectionPath, docId, data, deleted: false, source, updatedAt: Date.now() });
  await tursoAtomic([mirrorUpsertStatement(record)]);
  return { docId: record.docId, data };
}

async function updateAppDocument(collectionPath, docId, patchData, source = 'turso') {
  const existing = await getAppDocument(collectionPath, docId);
  if (!existing) throw new Error('Documento non trovato');
  return setAppDocument(collectionPath, docId, patchData, true, source);
}

function validateRegistration(data, email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Email non valida');
  if (String(data?.email || '').toLowerCase() !== email) throw new Error('Email non coerente');
  if (!/^[a-f0-9]{64}$/i.test(String(data?.passHash || '')) && !String(data?.passHash || '').startsWith('h_')) {
    throw new Error('Hash password non valido');
  }
  return {
    ...data,
    email,
    nome: String(data.nome || '').slice(0, 100),
    cognome: String(data.cognome || '').slice(0, 100),
    role: 'user',
    verified: data.verified !== false
  };
}

async function registerUser(email, data) {
  email = String(email || '').trim().toLowerCase();
  const existing = await findUserRecord(email);
  if (existing) throw new Error('Account già esistente');
  const clean = validateRegistration(data, email);
  return setAppDocument('users', email, clean, false, 'registration');
}

async function resetUserPassword(email, passHash) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(String(passHash || '')) && !String(passHash || '').startsWith('h_')) {
    throw new Error('Hash password non valido');
  }
  const existing = await findUserRecord(email);
  if (!existing) throw new Error('Account non trovato');
  return setAppDocument('users', existing.docId, { passHash, verified: true }, true, 'password-reset');
}

function resetCodeHash(email, code) {
  return sha256(String(email).toLowerCase() + ':' + String(code) + ':' + env('APP_SESSION_SECRET'));
}

async function startPasswordReset(email) {
  email = String(email || '').trim().toLowerCase();
  const user = await findUserRecord(email);
  if (!user) return; // Risposta neutra per non facilitare l'enumerazione degli account.
  const previous = await tursoQuery('SELECT requested_at FROM password_reset_codes WHERE email=?', [email]);
  if (previous.length && Date.now() - Number(previous[0].requested_at) < 60_000) throw new Error('Attendi un minuto prima di richiedere un nuovo codice');
  const code = String(crypto.randomInt(100000, 1000000));
  const now = Date.now();
  await tursoExecute(
    `INSERT INTO password_reset_codes(email,code_hash,expires_at,requested_at,attempts)
     VALUES(?,?,?,?,0)
     ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,
       expires_at=excluded.expires_at,requested_at=excluded.requested_at,attempts=0`,
    [email, resetCodeHash(email, code), now + 10 * 60_000, now]
  );
  const siteUrl = env('URL', env('DEPLOY_PRIME_URL')).replace(/\/$/, '');
  if (!siteUrl) throw new Error('URL Netlify non disponibile');
  const mailRes = await fetch(siteUrl + '/.netlify/functions/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to_email: email,
      to_name: user.data.nome || '',
      verification_code: code,
      purpose: 'reset'
    })
  });
  const mailData = await mailRes.json().catch(() => ({}));
  if (!mailRes.ok || mailData.ok === false) throw new Error('Invio del codice non riuscito');
}

async function confirmPasswordReset(email, code, passHash) {
  email = String(email || '').trim().toLowerCase();
  code = String(code || '').trim();
  const rows = await tursoQuery('SELECT code_hash,expires_at,attempts FROM password_reset_codes WHERE email=?', [email]);
  if (!rows.length || Number(rows[0].expires_at) < Date.now() || Number(rows[0].attempts) >= 5) {
    throw new Error('Codice non valido o scaduto');
  }
  const expected = String(rows[0].code_hash);
  const actual = resetCodeHash(email, code);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
    await tursoExecute('UPDATE password_reset_codes SET attempts=attempts+1 WHERE email=?', [email]);
    throw new Error('Codice non valido o scaduto');
  }
  await resetUserPassword(email, passHash);
  await tursoExecute('DELETE FROM password_reset_codes WHERE email=?', [email]);
}

function validateActivities(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 500) throw new Error('Elenco attività non valido');
  const seen = new Set();
  return input.map(raw => {
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) throw new Error('ID attività non valido o duplicato: ' + raw.id);
    seen.add(id);
    const title = String(raw.title || '').trim().slice(0, 300);
    const day = String(raw.day || '').replace(/^day/i, '').trim().slice(0, 20);
    if (!title || !day) throw new Error('Titolo e giorno sono obbligatori');
    return {
      id,
      day,
      time: String(raw.time || '').slice(0, 100),
      title,
      emoji: String(raw.emoji || '').slice(0, 30),
      cat: String(raw.cat || '').slice(0, 150),
      theme: String(raw.theme || 'mente').slice(0, 80),
      max: Math.max(1, Math.min(10000, Number(raw.max) || 15)),
      location: raw.location ? String(raw.location).slice(0, 500) : null,
      note: raw.note ? String(raw.note).slice(0, 2000) : null,
      phoneOnly: raw.phoneOnly ? 1 : 0,
      phoneNumber: raw.phoneNumber ? String(raw.phoneNumber).slice(0, 100) : null
    };
  });
}

async function replaceActivities(input, actorEmail) {
  const activities = validateActivities(input);
  const now = Date.now();
  const statements = [
    {
      sql: 'INSERT INTO activities_history (snapshot_json, actor_email, created_at) VALUES (?, ?, ?)',
      args: [JSON.stringify(activities), actorEmail || null, now]
    },
    { sql: 'DELETE FROM activities' }
  ];
  for (const a of activities) {
    statements.push({
      sql: `INSERT INTO activities
            (id, day, time, title, emoji, cat, theme, max, location, note, phoneOnly, phoneNumber)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [a.id, a.day, a.time, a.title, a.emoji, a.cat, a.theme, a.max, a.location, a.note, a.phoneOnly, a.phoneNumber]
    });
  }
  await tursoAtomic(statements);
  return activities.length;
}

async function createBooking(session, bookingData, capacity, requestedDocId) {
  if (!session) throw new Error('Accesso richiesto');
  const email = String(session.email || '').toLowerCase();
  if (session.role !== 'admin' && String(bookingData?.userEmail || '').toLowerCase() !== email) {
    throw new Error('Prenotazione non autorizzata');
  }
  const activityId = Number(bookingData?.id);
  const num = Math.max(1, Math.min(3, Number(bookingData?.num) || 1));
  capacity = Math.max(1, Math.min(10000, Number(capacity) || Number(bookingData?.max) || 15));
  if (!Number.isFinite(activityId)) throw new Error('Attività non valida');
  const docId = normalizeDocId(requestedDocId || crypto.randomUUID());
  const cleanData = buildStoredData({ ...bookingData, id: activityId, num, userEmail: email }, {}, false);
  const bookingRecord = normalizeMirrorRecord({ collectionPath: 'bookings', docId, data: cleanData, source: 'turso' });
  const countId = String(activityId);
  const now = Date.now();
  const emptyCount = JSON.stringify({ total: 0 });

  await tursoAtomic([
    {
      sql: `INSERT INTO app_documents(collection_path,doc_id,data_json,updated_at,deleted,source)
            VALUES('counts',?,?,?,0,'turso')
            ON CONFLICT(collection_path,doc_id) DO UPDATE SET
              data_json=CASE WHEN app_documents.deleted=1 THEN excluded.data_json ELSE app_documents.data_json END,
              deleted=0,
              updated_at=CASE WHEN app_documents.deleted=1 THEN excluded.updated_at ELSE app_documents.updated_at END`,
      args: [countId, emptyCount, now]
    },
    {
      sql: `INSERT INTO app_documents(collection_path,doc_id,data_json,updated_at,deleted,source)
            SELECT 'bookings',?,?,?,?, 'turso'
            WHERE COALESCE((SELECT CAST(json_extract(data_json,'$.total') AS INTEGER)
                            FROM app_documents WHERE collection_path='counts' AND doc_id=? AND deleted=0),0) + ? <= ?
              AND NOT EXISTS (
                SELECT 1 FROM app_documents
                WHERE collection_path='bookings' AND deleted=0
                  AND CAST(json_extract(data_json,'$.id') AS INTEGER)=?
                  AND lower(json_extract(data_json,'$.userEmail'))=lower(?)
              )`,
      args: [docId, bookingRecord.dataJson, now, 0, countId, num, capacity, activityId, email]
    },
    {
      sql: `UPDATE app_documents
            SET data_json=json_set(data_json,'$.total',
                  COALESCE(CAST(json_extract(data_json,'$.total') AS INTEGER),0)+?),
                updated_at=?, source='turso'
            WHERE collection_path='counts' AND doc_id=? AND deleted=0 AND changes()>0`,
      args: [num, now, countId]
    }
  ]);

  const created = await getAppDocument('bookings', docId);
  if (!created) {
    const duplicate = applyQuery(await listAppDocuments('bookings'), [
      { field: 'id', op: '==', value: activityId },
      { field: 'userEmail', op: '==', value: email }
    ], [], 1);
    if (duplicate.length) throw new Error('prenotazione_duplicata');
    throw new Error('posti_esauriti');
  }
  const count = await getAppDocument('counts', countId);
  return { docId, booking: created.data, total: Number(count?.data?.total) || 0 };
}

async function deleteBooking(session, docId) {
  if (!session) throw new Error('Accesso richiesto');
  docId = normalizeDocId(docId);
  const booking = await getAppDocument('bookings', docId);
  if (!booking) throw new Error('Prenotazione non trovata');
  const owner = String(booking.data.userEmail || '').toLowerCase();
  if (session.role !== 'admin' && owner !== String(session.email || '').toLowerCase()) {
    throw new Error('Cancellazione non autorizzata');
  }
  const activityId = String(booking.data.id);
  const num = Math.max(1, Number(booking.data.num) || 1);
  const now = Date.now();
  await tursoAtomic([
    {
      sql: `UPDATE app_documents SET deleted=1,updated_at=?,source='turso'
            WHERE collection_path='bookings' AND doc_id=? AND deleted=0`,
      args: [now, docId]
    },
    {
      sql: `UPDATE app_documents
            SET data_json=json_set(data_json,'$.total',MAX(0,
                  COALESCE(CAST(json_extract(data_json,'$.total') AS INTEGER),0)-?)),
                updated_at=?,source='turso'
            WHERE collection_path='counts' AND doc_id=? AND deleted=0 AND changes()>0`,
      args: [num, now, activityId]
    }
  ]);
  const count = await getAppDocument('counts', activityId);
  return { docId, activityId: Number(activityId), total: Number(count?.data?.total) || 0 };
}

async function joinImprovedWaitlist(session, body) {
  if (!session) throw new Error('Accesso richiesto');
  const activityId = Number(body.activityId);
  if (!Number.isFinite(activityId)) throw new Error('Attività non valida');
  const email = String(session.email).trim().toLowerCase();
  const docId = String(activityId) + '_' + email;
  const existing = await getAppDocument('waitlist', docId);
  if (!existing) await setAppDocument('waitlist', docId, {
    activityId, userEmail:email, nome:String(body.nome||''), cognome:String(body.cognome||''),
    requestedAt:Date.now(), participants:Math.max(1,Math.min(3,Number(body.participants)||1))
  }, false, 'turso');
  const records = (await listAppDocuments('waitlist')).filter(r=>Number(r.data.activityId)===activityId)
    .sort((a,b)=>(Number(a.data.requestedAt)||a.updatedAt)-(Number(b.data.requestedAt)||b.updatedAt));
  return { docId, position:records.findIndex(r=>r.docId===docId)+1, total:records.length };
}
async function improvedWaitlistStatus(session, activityId) {
  if (!session) throw new Error('Accesso richiesto');
  activityId=Number(activityId); const email=String(session.email).toLowerCase(); const docId=activityId+'_'+email;
  const records=(await listAppDocuments('waitlist')).filter(r=>Number(r.data.activityId)===activityId)
    .sort((a,b)=>(Number(a.data.requestedAt)||a.updatedAt)-(Number(b.data.requestedAt)||b.updatedAt));
  const index=records.findIndex(r=>r.docId===docId); const count=await getAppDocument('counts',String(activityId));
  const activityRows=await tursoQuery('SELECT max FROM activities WHERE id=? LIMIT 1',[activityId]);
  const capacity=Number(activityRows[0]?.max)||15, occupied=Number(count?.data?.total)||0;
  return { joined:index>=0, position:index+1, total:records.length, canClaim:index===0&&occupied<capacity, available:Math.max(0,capacity-occupied) };
}
async function leaveImprovedWaitlist(session, activityId) {
  if (!session) throw new Error('Accesso richiesto');
  const docId=Number(activityId)+'_'+String(session.email).toLowerCase(); const record=await getAppDocument('waitlist',docId);
  if (record) await deleteMirrorRecord('waitlist',docId,record.data); return {docId};
}
async function claimImprovedWaitlist(session, body) {
  const status=await improvedWaitlistStatus(session,body.activityId);
  if (!status.joined||status.position!==1) throw new Error('Non sei il primo in lista');
  if (!status.canClaim) throw new Error('Nessun posto disponibile');
  const result=await createBooking(session,body.bookingData||{},body.capacity,body.docId);
  await leaveImprovedWaitlist(session,body.activityId); return result;
}
async function checkInBooking(session, docId) {
  if (!session || !['admin','controller','helper'].includes(session.role)) throw new Error('Accesso controllore richiesto');
  docId=normalizeDocId(docId); const now=Date.now();
  const result=await tursoExecute(`UPDATE app_documents SET
    data_json=json_set(data_json,'$.checkedIn',json('true'),'$.checkInAt',?,'$.checkedInBy',?),
    updated_at=?,source='turso'
    WHERE collection_path='bookings' AND doc_id=? AND deleted=0
      AND COALESCE(json_extract(data_json,'$.checkedIn'),0) NOT IN (1,'true')`,[now,session.email,now,docId]);
  const booking=await getAppDocument('bookings',docId);
  if (!booking) throw new Error('Prenotazione non trovata');
  return {already:Number(result.rows_affected||result.affected_row_count||0)===0,booking:booking.data};
}

async function handleAction(body, session) {
  const action = String(body?.action || 'health');

  if (action === 'session') return { ok: true, ...(await createSession(body.email, body.password)) };

  // Rinnovo sessione: chi ha ancora una sessione valida riceve un token nuovo
  // (scadenza spostata in avanti), senza dover reinserire email e password.
  if (action === 'session:renew' || action === 'session:refreshRole') {
    if (!session) return { __status: 401, ok: false, error: 'Sessione scaduta o non valida' };
    await ensureSchema();
    // Rilegge il ruolo attuale da Turso: una promozione a controllore/helper/admin
    // diventa effettiva senza dover aspettare la scadenza della vecchia sessione.
    const currentRole = await resolveCurrentRole(session.email);
    const now = Date.now();
    const payload = { email: session.email, role: currentRole, iat: now, exp: now + (await sessionTtlMs()) };
    return { ok: true, token: signSession(payload), user: { email: session.email, role: currentRole }, expiresAt: payload.exp };
  }

  await ensureSchema();

  if (action === 'health') {
    const rows = await tursoQuery('SELECT COUNT(*) AS activities FROM activities');
    return { ok: true, activities: rows[0]?.activities || 0, schema: 1 };
  }

  if (action === 'activities:list') {
    const rows = await tursoQuery('SELECT * FROM activities ORDER BY day, time, id');
    return { ok: true, rows };
  }

  if (action === 'activities:replace') {
    if (!session || session.role !== 'admin') return { __status: 403, ok: false, error: 'Accesso admin richiesto' };
    const count = await replaceActivities(body.activities, session.email);
    return { ok: true, count };
  }

  if (action === 'users:exists') {
    const email = String(body.email || '').trim().toLowerCase();
    const record = await findUserRecord(email);
    return { ok: true, exists: !!record };
  }

  if (action === 'users:register') {
    const result = await registerUser(body.email, body.data || {});
    return { ok: true, docId: result.docId };
  }

  if (action === 'passwordReset:start') {
    await startPasswordReset(body.email);
    return { ok: true };
  }

  if (action === 'passwordReset:confirm') {
    try {
      await confirmPasswordReset(body.email, body.code, body.passHash);
      return { ok: true };
    } catch (error) {
      return { __status: 400, ok: false, error: error.message };
    }
  }

  if (action === 'waitlist:join') {
    try { return {ok:true,...(await joinImprovedWaitlist(session,body))}; }
    catch(error){ return {__status:error.message==='Accesso richiesto'?401:400,ok:false,error:error.message}; }
  }
  if (action === 'waitlist:status') {
    try { return {ok:true,...(await improvedWaitlistStatus(session,body.activityId))}; }
    catch(error){ return {__status:error.message==='Accesso richiesto'?401:400,ok:false,error:error.message}; }
  }
  if (action === 'waitlist:leave') {
    try { return {ok:true,...(await leaveImprovedWaitlist(session,body.activityId))}; }
    catch(error){ return {__status:error.message==='Accesso richiesto'?401:400,ok:false,error:error.message}; }
  }
  if (action === 'waitlist:claim') {
    try { return {ok:true,...(await claimImprovedWaitlist(session,body))}; }
    catch(error){ return {__status:/posto|lista/i.test(error.message)?409:400,ok:false,error:error.message}; }
  }
  if (action === 'bookings:checkin') {
    try { return {ok:true,...(await checkInBooking(session,body.docId))}; }
    catch(error){ return {__status:/Accesso/.test(error.message)?403:404,ok:false,error:error.message}; }
  }

  if (action === 'bookings:create') {
    try {
      const result = await createBooking(session, body.bookingData || {}, body.capacity, body.docId);
      return { ok: true, ...result };
    } catch (error) {
      if (['posti_esauriti', 'prenotazione_duplicata'].includes(error.message)) {
        return { __status: 409, ok: false, error: error.message };
      }
      if (error.message === 'Accesso richiesto') return { __status: 401, ok: false, error: 'Sessione scaduta o non valida' };
      if (error.message === 'Prenotazione non autorizzata') return { __status: 403, ok: false, error: error.message };
      throw error;
    }
  }

  if (action === 'bookings:delete') {
    try {
      const result = await deleteBooking(session, body.docId);
      return { ok: true, ...result };
    } catch (error) {
      if (error.message === 'Accesso richiesto') return { __status: 401, ok: false, error: 'Sessione scaduta o non valida' };
      if (/non trovata|non autorizzata/.test(error.message)) return { __status: 403, ok: false, error: error.message };
      throw error;
    }
  }

  if (action === 'documents:get') {
    const path = normalizePath(body.collectionPath);
    const docId = normalizeDocId(body.docId);
    if (!canReadCollection(session, path)) {
      if (!session) return { __status: 401, ok: false, error: 'Sessione scaduta o non valida' };
      return { __status: 403, ok: false, error: 'Lettura non autorizzata' };
    }
    const record = await getAppDocument(path, docId);
    const readable = record ? filterReadableRecords(session, path, [record]) : [];
    return { ok: true, record: sanitizeRecordForClient(path, readable[0] || null, session) };
  }

  if (action === 'documents:query') {
    const path = normalizePath(body.collectionPath);
    if (!canReadCollection(session, path)) {
      if (!session) return { __status: 401, ok: false, error: 'Sessione scaduta o non valida' };
      return { __status: 403, ok: false, error: 'Lettura non autorizzata' };
    }
    let records = await listAppDocuments(path);
    records = filterReadableRecords(session, path, records);
    records = applyQuery(records, body.filters || [], body.orderBy || [], body.limit || 0);
    return { ok: true, records: records.map(record => sanitizeRecordForClient(path, record, session)) };
  }

  if (action === 'documents:set') {
    const path = normalizePath(body.collectionPath);
    const docId = normalizeDocId(body.docId);
    const input = body.data && typeof body.data === 'object' ? body.data : {};
    if (!session) return { __status: 401, ok: false, error: 'Sessione scaduta o non valida' };
    const existing = await getAppDocument(path, docId, true);
    const authData = body.merge && existing?.data ? deepMerge(existing.data, input) : input;
    if (!canWriteDocument(session, path, docId, authData)) return { __status: 403, ok: false, error: 'Scrittura non autorizzata' };
    const result = await setAppDocument(path, docId, input, !!body.merge, 'turso');
    return { ok: true, record: result };
  }

  if (action === 'documents:update') {
    const path = normalizePath(body.collectionPath);
    const docId = normalizeDocId(body.docId);
    const input = body.data && typeof body.data === 'object' ? body.data : {};
    const existing = await getAppDocument(path, docId);
    if (!existing || !canWriteDocument(session, path, docId, deepMerge(existing.data, input))) {
      return { __status: 403, ok: false, error: 'Aggiornamento non autorizzato' };
    }
    const result = await updateAppDocument(path, docId, input, 'turso');
    return { ok: true, record: result };
  }

  if (action === 'documents:remove') {
    const path = normalizePath(body.collectionPath);
    const docId = normalizeDocId(body.docId);
    const existing = await getAppDocument(path, docId);
    if (!existing || !canWriteDocument(session, path, docId, existing.data)) {
      return { __status: 403, ok: false, error: 'Cancellazione non autorizzata' };
    }
    await deleteMirrorRecord(path, docId, existing.data);
    return { ok: true };
  }

  if (action === 'documents:batch') {
    if (!session || session.role !== 'admin') return { __status: 403, ok: false, error: 'Accesso admin richiesto' };
    const operations = Array.isArray(body.operations) ? body.operations.slice(0, 600) : [];
    const statements = [];
    for (const operation of operations) {
      const path = normalizePath(operation.collectionPath);
      const docId = normalizeDocId(operation.docId);
      const existing = await getAppDocument(path, docId, true);
      if (operation.type === 'delete') {
        const record = normalizeMirrorRecord({ collectionPath: path, docId, data: existing?.data || {}, deleted: true, source: 'turso' });
        statements.push(mirrorUpsertStatement(record));
      } else {
        const data = buildStoredData(operation.data || {}, existing?.data || {}, operation.type === 'update' || !!operation.merge);
        const record = normalizeMirrorRecord({ collectionPath: path, docId, data, deleted: false, source: 'turso' });
        statements.push(mirrorUpsertStatement(record));
      }
    }
    if (statements.length) await tursoAtomic(statements);
    return { ok: true, count: statements.length };
  }

  if (action === 'documents:upsertMany') {
    if (!session || session.role !== 'admin') return { __status: 403, ok: false, error: 'Accesso admin richiesto' };
    const count = await upsertMirrorRecords(body.records);
    return { ok: true, count };
  }

  if (action === 'documents:reconcile') {
    if (!session || session.role !== 'admin') return { __status: 403, ok: false, error: 'Accesso admin richiesto' };
    const count = await reconcileMirrorCollection(body.collectionPath, body.records || []);
    return { ok: true, count };
  }

  if (action === 'documents:upsert') {
    const record = normalizeMirrorRecord(body.record);
    if (!authorizeDocumentWrite(session, record.collectionPath, record.docId, record.data, false)) {
      return { __status: 403, ok: false, error: 'Operazione non autorizzata' };
    }
    await upsertMirrorRecords([record]);
    return { ok: true };
  }

  if (action === 'documents:delete') {
    const path = normalizePath(body.collectionPath);
    const docId = normalizeDocId(body.docId);
    const previousData = body.previousData && typeof body.previousData === 'object' ? body.previousData : {};
    if (!authorizeDocumentWrite(session, path, docId, previousData, true)) {
      return { __status: 403, ok: false, error: 'Operazione non autorizzata' };
    }
    await deleteMirrorRecord(path, docId, previousData);
    return { ok: true };
  }

  return { __status: 404, ok: false, error: 'Azione non supportata' };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return response(204, {});
  if (event.httpMethod !== 'POST') return response(405, { ok: false, error: 'Metodo non consentito' });
  if (Buffer.byteLength(event.body || '') > MAX_BODY_BYTES) return response(413, { ok: false, error: 'Richiesta troppo grande' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return response(400, { ok: false, error: 'JSON non valido' }); }

  try {
    const verifiedSession = verifySession(bearerToken(event.headers));
    let session = verifiedSession;
    let roleChanged = false;

    // Non fidarsi del ruolo rimasto nel vecchio token: per ogni richiesta
    // autenticata rilegge il ruolo corrente da Turso. Una rimozione dei privilegi
    // diventa quindi effettiva immediatamente, anche senza logout manuale.
    if (session) {
      await ensureSchema();
      const currentRole = await resolveCurrentRole(session.email);
      roleChanged = currentRole !== session.role;
      if (roleChanged) session = { ...session, role: currentRole };
    }

    const result = await handleAction(body, session);
    const status = result.__status || 200;
    if ('__status' in result) delete result.__status;
    // Rinnova anche quando il ruolo è cambiato, così il browser riceve subito
    // un token corretto (oltre al normale rinnovo prima della scadenza).
    if (
      session && result && result.token === undefined &&
      (roleChanged || (result.ok !== false && Number(session.exp) - Date.now() < SESSION_RENEW_WINDOW_MS))
    ) {
      try {
        const now = Date.now();
        result.token = signSession({ email: session.email, role: session.role, iat: now, exp: now + (await sessionTtlMs()) });
        result.sessionUser = { email: session.email, role: session.role };
      } catch {}
    }
    return response(status, result);
  } catch (error) {
    console.error('Turso function error:', error?.message || error);
    const message = /configurato|deve contenere/.test(String(error?.message))
      ? String(error.message)
      : 'Operazione database non riuscita';
    return response(500, { ok: false, error: message });
  }
}
