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
          source TEXT NOT NULL DEFAULT 'firebase',
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
      }
    ]).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
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

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return null;
}

function decodeFirestoreFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeFirestoreValue(value);
  return out;
}

async function getFirestoreDocument(collection, documentId) {
  const project = env('FIREBASE_PROJECT_ID', 'festivaldiduccio');
  const apiKey = env('FIREBASE_WEB_API_KEY');
  const keyPart = apiKey ? '?key=' + encodeURIComponent(apiKey) : '';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}${keyPart}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Errore lettura profilo Firebase');
  const doc = await res.json();
  return decodeFirestoreFields(doc.fields || {});
}

async function findFirestoreUserByEmail(email) {
  const project = env('FIREBASE_PROJECT_ID', 'festivaldiduccio');
  const apiKey = env('FIREBASE_WEB_API_KEY');
  const keyPart = apiKey ? '?key=' + encodeURIComponent(apiKey) : '';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents:runQuery${keyPart}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
        limit: 1
      }
    })
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const doc = rows.find(row => row.document)?.document;
  return doc ? decodeFirestoreFields(doc.fields || {}) : null;
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

async function createSession(email, password) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (!email || !password) throw new Error('Email e password obbligatorie');

  const candidates = [];
  const mainAdminEmail = env('ADMIN_EMAIL', 'manuel.magnani29@gmail.com').toLowerCase();
  let profile = await getFirestoreDocument('users', email).catch(() => null);
  if (!profile) profile = await findFirestoreUserByEmail(email).catch(() => null);

  // Per l'admin principale accetta prima la password aggiornata su Firebase,
  // poi l'hash di emergenza configurato nelle variabili Netlify.
  if (email === mainAdminEmail) {
    if (profile?.passHash) candidates.push({ hash: profile.passHash, role: 'admin' });
    if (env('ADMIN_PASS_HASH')) candidates.push({ hash: env('ADMIN_PASS_HASH'), role: 'admin' });
  } else {
    // Mantiene lo stesso ordine del login nel sito: ruoli staff prima dell'utente normale.
    for (const [collection, candidateRole] of [['admins', 'admin'], ['controllers', 'controller'], ['helpers', 'helper']]) {
      const roleDoc = await getFirestoreDocument(collection, email).catch(() => null);
      if (roleDoc?.passHash) candidates.push({ hash: roleDoc.passHash, role: candidateRole });
    }
    if (profile?.passHash) candidates.push({ hash: profile.passHash, role: profile.role || 'user' });
  }

  const matched = candidates.find(candidate => passwordMatches(password, candidate.hash));
  if (!matched) throw new Error('Credenziali non valide');

  const now = Date.now();
  const payload = { email, role: matched.role, iat: now, exp: now + 12 * 60 * 60 * 1000 };
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
    updatedAt: Number(record?.updatedAt) || Date.now()
  };
}

function mirrorUpsertStatement(record) {
  return {
    sql: `INSERT INTO app_documents
          (collection_path, doc_id, data_json, updated_at, deleted, source)
          VALUES (?, ?, ?, ?, ?, 'firebase')
          ON CONFLICT(collection_path, doc_id) DO UPDATE SET
            data_json=excluded.data_json,
            updated_at=excluded.updated_at,
            deleted=excluded.deleted,
            source=excluded.source`,
    args: [record.collectionPath, record.docId, record.dataJson, record.updatedAt, record.deleted]
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

async function handleAction(body, event) {
  const action = String(body?.action || 'health');
  const session = verifySession(bearerToken(event.headers));

  if (action === 'session') return { ok: true, ...(await createSession(body.email, body.password)) };

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
    const result = await handleAction(body, event);
    const status = result.__status || 200;
    if ('__status' in result) delete result.__status;
    return response(status, result);
  } catch (error) {
    console.error('Turso function error:', error?.message || error);
    const message = /configurato|deve contenere/.test(String(error?.message))
      ? String(error.message)
      : 'Operazione database non riuscita';
    return response(500, { ok: false, error: message });
  }
}
