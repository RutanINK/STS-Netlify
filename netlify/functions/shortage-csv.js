const SOURCES = {
  lumber: 'https://docs.google.com/spreadsheets/d/14-Yv9h35MEnJsZp1ZbO0H0UyyIL34ddNWTFeXa72xM8/export?format=csv&gid=0',
  'lumber-rx': 'https://docs.google.com/spreadsheets/d/1nrbIGow8VASSlPbJ4Cyk-W3wbY5fYh_qtLRnLER1rnI/export?format=csv&gid=0',
  bent: 'https://docs.google.com/spreadsheets/d/1F2oiif7mZyGaE0lGEMnJKKZXdBOEsXXCoo11lknhCYw/export?format=csv&gid=0',
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  const key = event.queryStringParameters?.key;
  const url = SOURCES[key];

  if (!url) {
    return {
      statusCode: 400,
      headers: {
        ...headers,
        'Content-Type': 'text/plain',
      },
      body: 'Unknown shortage source',
    };
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'STS-Netlify-Shortage-Loader',
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          ...headers,
          'Content-Type': 'text/plain',
        },
        body: text,
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        ...headers,
        'Content-Type': 'text/plain',
      },
      body: `Failed to fetch shortage CSV: ${error.message}`,
    };
  }
};