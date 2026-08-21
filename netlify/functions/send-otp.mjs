// Netlify Function (ESM): invio email OTP via Brevo
// Endpoint: /.netlify/functions/send-otp
// Nota: il progetto ha "type":"module" in package.json, quindi si usa `export const handler`.

// ⚠️ La chiave Brevo NON è nel codice: va impostata come variabile d'ambiente BREVO_API_KEY su Netlify.
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const FROM_EMAIL = 'manuel.magnani29@gmail.com';
const FROM_NAME = 'Festival della Didattica Creativa';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to_email, to_name, verification_code, original_email, purpose } = body;
  // purpose: 'register' (default) oppure 'reset' (recupero password)
  const isReset = (purpose === 'reset');
  // Email di test: reindirizza all'admin (non esiste davvero)
  const TEST_ADMIN = 'manuel.magnani29@gmail.com';
  const isTest = (original_email || to_email || '').toLowerCase().startsWith('test.');
  const finalTo = isTest ? TEST_ADMIN : to_email;
  const finalName = isTest ? ((to_name||'') + ' [TEST ' + (original_email||to_email) + ']') : (to_name||'');
  if (!to_email || !verification_code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
  }
  if (!BREVO_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'BREVO_API_KEY non configurata su Netlify' }) };
  }

  const payload = {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to: [{ email: finalTo, name: finalName || '' }],
    subject: isReset ? '🔑 Il tuo codice per reimpostare la password' : '🔐 Il tuo codice di verifica Festival Creattività',
    htmlContent: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#7c3aed;">Ciao ${to_name || ''}!</h2>
        <p>${isReset ? 'Usa questo codice per <strong>reimpostare la password</strong> del tuo account al Festival della Didattica Creativa:' : 'Usa questo codice per completare la registrazione al <strong>Festival della Didattica Creativa</strong>:'}</p>
        <p style="font-size:2rem;font-weight:900;letter-spacing:8px;color:#7c3aed;background:#f3e8ff;padding:16px 24px;border-radius:14px;text-align:center;">${verification_code}</p>
        <p>Il codice è valido per <strong>10 minuti</strong>.</p>
        <p>Se non hai richiesto tu questo codice, puoi ignorare questa email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#999;font-size:.85rem;">Festival della Didattica Creativa · Gruppo Creattività · Miramare di Rimini</p>
      </div>`
  };

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, messageId: data.messageId }) };
    }
    return { statusCode: res.status, body: JSON.stringify({ error: data.message || 'Brevo error' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
