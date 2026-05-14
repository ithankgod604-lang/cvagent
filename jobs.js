// Netlify serverless function — proxies Adzuna API calls server-side
// This completely bypasses CORS because the request comes from a server, not a browser

const ADZUNA_APP_ID  = '580a9015';
const ADZUNA_APP_KEY = 'c1c1ac66ce6e442b1fb7409fbcf542eb';
const ADZUNA_BASE    = 'https://api.adzuna.com/v1/api/jobs/gb/search/';

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const page     = params.page     || '1';
  const what     = params.what     || 'jobs';
  const where    = params.where    || 'UK';
  const category = params.category || '';
  const sort     = params.sort     || 'date';

  let url = ADZUNA_BASE + page
    + '?app_id='          + ADZUNA_APP_ID
    + '&app_key='         + ADZUNA_APP_KEY
    + '&results_per_page=20'
    + '&sort_by='         + sort
    + '&what='            + encodeURIComponent(what)
    + '&where='           + encodeURIComponent(where);

  if (category) url += '&category=' + encodeURIComponent(category);

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Adzuna API error: ' + response.status })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // cache 5 mins
      },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
