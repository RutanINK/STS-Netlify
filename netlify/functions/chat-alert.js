const DEFAULT_ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://sts.netlify.app';

function corsHeaders(origin) {
  // Accept the configured origin, any *.netlify.app deploy preview, or local dev
  const isAllowed =
    origin === DEFAULT_ALLOWED_ORIGIN ||
    /^https:\/\/[^.]+\.netlify\.app$/.test(origin) ||
    origin === 'http://localhost:8888' ||
    origin === 'http://localhost:3000';

  return {
    'Access-Control-Allow-Origin':  isAllowed ? origin : DEFAULT_ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

exports.handler = async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const cors   = corsHeaders(origin);

  // Preflight — must NOT include Content-Type or a body
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'GOOGLE_CHAT_WEBHOOK_URL environment variable is not set' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const text = String(body.text || '').trim().slice(0, 4000);
  if (!text) {
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'text field is required' }),
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        statusCode: 502,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: 'Chat webhook returned an error', detail }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Could not reach chat webhook', detail: err.message }),
    };
  }
};