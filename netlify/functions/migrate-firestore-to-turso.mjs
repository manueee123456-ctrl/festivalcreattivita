import crypto from 'node:crypto';
import { handler as tursoHandler } from './turso.mjs';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function reply(statusCode, payload) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(payload) };
}

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return { __type: 'timestamp', value: value.timestampValue };
  if ('bytesValue' in value) return { __type: 'bytes', value: value.bytesValue };
  if ('referenceValue' in value) return { __type: 'reference', value: value.referenceValue };
  if ('geoPointValue' in value) return { __type: 'geo', value: value.geoPointValue };
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value);
  return out;
}

function encodeFirestorePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

async function listFirestoreCollection(collectionPath) {
  const project = env('FIREBASE_PROJECT_ID', 'festivaldiduccio');
  const apiKey = env('FIREBASE_WEB_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY non configurata per la migrazione');
  const records = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '300', key: apiKey });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encodeFirestorePath(collectionPath)}?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lettura migrazione fallita per ${collectionPath} (${res.status})`);
    const payload = await res.json();
    for (const document of payload.documents || []) {
      records.push({
        collectionPath,
        docId: decodeURIComponent(String(document.name).split('/').pop()),
        data: decodeFields(document.fields || {}),
        deleted: false,
        updatedAt: Date.parse(document.updateTime || document.createTime || '') || Date.now(),
        source: 'firebase-migration'
      });
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return records;
}

function adminToken() {
  const secret = env('APP_SESSION_SECRET');
  if (secret.length < 32) throw new Error('APP_SESSION_SECRET non configurato');
  const now = Date.now();
  const payload = {
    email: env('ADMIN_EMAIL', 'manuel.magnani29@gmail.com').toLowerCase(),
    role: 'admin',
    iat: now,
    exp: now + 30 * 60 * 1000
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

async function callTurso(body, token = '') {
  const result = await tursoHandler({
    httpMethod: 'POST',
    headers: token ? { authorization: 'Bearer ' + token } : {},
    body: JSON.stringify(body)
  });
  const payload = JSON.parse(result.body || '{}');
  if (result.statusCode >= 400 || payload.ok === false) throw new Error(payload.error || 'Errore Turso');
  return payload;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Metodo non consentito' });
  const expected = env('MIGRATION_SECRET');
  const provided = String(event.headers?.['x-migration-secret'] || event.headers?.['X-Migration-Secret'] || '');
  if (expected.length < 24 || provided.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return reply(403, { ok: false, error: 'Migration secret non valido' });
  }

  try {
    const token = adminToken();
    const topLevel = [
      'settings', 'counts', 'bookings', 'users', 'admins', 'controllers',
      'helpers', 'waitlist', 'annunci', 'hype', 'staffradio', 'analytics'
    ];
    const summary = {};

    for (const collectionPath of topLevel) {
      const records = await listFirestoreCollection(collectionPath);
      await callTurso({ action: 'documents:reconcile', collectionPath, records }, token);
      summary[collectionPath] = records.length;
    }

    const activities = await callTurso({ action: 'activities:list' });
    const activityIds = [...new Set((activities.rows || []).map(row => Number(row.id)).filter(Number.isFinite))];
    let chatMessages = 0;
    for (const activityId of activityIds) {
      const collectionPath = `chats/${activityId}/messages`;
      const records = await listFirestoreCollection(collectionPath);
      await callTurso({ action: 'documents:reconcile', collectionPath, records }, token);
      chatMessages += records.length;
    }
    summary.chatMessages = chatMessages;

    return reply(200, {
      ok: true,
      message: 'Migrazione completata. Firebase non è stato cancellato.',
      summary
    });
  } catch (error) {
    console.error('Migration error:', error?.message || error);
    return reply(500, { ok: false, error: error?.message || 'Migrazione non riuscita' });
  }
}
