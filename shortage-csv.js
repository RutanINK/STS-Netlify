const SOURCES = {
  lumber: 'https://docs.google.com/spreadsheets/d/14-Yv9h35MEnJsZp1ZbO0H0UyyIL34ddNWTFeXa72xM8/export?format=csv&gid=0',
  'lumber-rx': 'https://docs.google.com/spreadsheets/d/1nrbIGow8VASSlPbJ4Cyk-W3wbY5fYh_qtLRnLER1rnI/export?format=csv&gid=0',
  bent: 'https://docs.google.com/spreadsheets/d/1F2oiif7mZyGaE0lGEMnJKKZXdBOEsXXCoo11lknhCYw/export?format=csv&gid=0',
};

const DEFAULT_ALLOWED_ORIGIN = 'https://sts.netlify.app';

function corsHeaders(event) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

exports.handler = async function handler(event) {
  const baseHeaders = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Method not allowed',
    };
  }

  const key = event.queryStringParameters?.key;
  const url = SOURCES[key];

  if (!url) {
    return {
      statusCode: 400,
      headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Unknown shortage source',
    };
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'STS-Netlify-Shortage-Loader' },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
        body: 'Upstream shortage source returned an error',
      };
    }

    const text = await response.text();
    return {
      statusCode: 200,
      headers: { ...baseHeaders, 'Content-Type': 'text/csv; charset=utf-8' },
      body: text,
    };
  } catch {
    return {
      statusCode: 502,
      headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Failed to fetch shortage CSV',
    };
  }
};
