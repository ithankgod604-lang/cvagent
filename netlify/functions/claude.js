exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: 'API key not configured on server' } })
    };
  }

  try {
    const body = JSON.parse(event.body);

    // Split large requests into two separate calls:
    // Call 1: scores, missing, summary, experience, skills, analysis (fast)
    // Call 2: fullCV, cover letter (separate if needed)
    // This keeps each call under 10 seconds

    const requestBody = {
      ...body,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(body.max_tokens || 2000, 2500),
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: err.message || 'Internal server error' } })
    };
  }
};
