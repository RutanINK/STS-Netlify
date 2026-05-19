// ══════════════════════════════════════
// SUPABASE — all DB calls go through sb()
// ══════════════════════════════════════

async function sb(path, method = 'GET', body = null, extra = {}) {
  const h = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (method === 'POST') h['Prefer'] = 'return=representation';
  if (extra.prefer) h['Prefer'] = extra.prefer;

  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);

  // Keep the apikey header and query parameter. Some Supabase/PostgREST deployments,
  // proxies, and browser paths can reject requests when the key is only present as a header.
  // The anon key is public by design; authorization must still be enforced with RLS.
  const sep = String(path).includes('?') ? '&' : '?';
  const url = SB_URL + '/rest/v1/' + path + sep + 'apikey=' + encodeURIComponent(SB_KEY);
  opts.credentials = 'omit';
  const r = await fetch(url, opts);
  if (!r.ok) {
  const text = await r.text();

  let message = text;
  try {
    const json = JSON.parse(text);
    message = json.message || json.details || json.hint || text;
  } catch {
    // Keep raw text if Supabase did not return JSON.
  }

  throw new Error(`${method} ${path} failed (${r.status}): ${message}`);
}
  if (method === 'DELETE') return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sts_' + pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}