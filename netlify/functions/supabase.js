const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supaFetch(path, method, body, customToken) {
  const res = await fetch(SUPABASE_URL + path, {
    method: method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + (customToken || SUPABASE_SERVICE_KEY),
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch(e) { return { ok: res.ok, status: res.status, data: text }; }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { action, data } = JSON.parse(event.body || '{}');

    // REGISTER
    if (action === 'register') {
      const { email, password, firstName, lastName, sector } = data;
      const authRes = await supaFetch('/auth/v1/admin/users', 'POST', {
        email, password, email_confirm: true,
        user_metadata: { firstName, lastName, sector }
      });
      if (!authRes.ok) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: authRes.data.msg || authRes.data.message || 'Registration failed' }) };
      }
      const userId = authRes.data.id;
      await supaFetch('/rest/v1/users', 'POST', {
        id: userId, email,
        full_name: firstName + ' ' + lastName,
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: { id: userId, email, firstName, lastName, sector, plan: 'free' } })};
    }

    // LOGIN (email + password)
    if (action === 'login') {
      const { email, password } = data;
      const authRes = await supaFetch('/auth/v1/token?grant_type=password', 'POST', { email, password });
      if (!authRes.ok) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email or password.' }) };
      }
      const userId = authRes.data.user && authRes.data.user.id;
      const profileRes = await supaFetch('/rest/v1/users?id=eq.' + userId + '&select=*', 'GET');
      const profile = profileRes.data && profileRes.data[0];
      const nameParts = ((profile && profile.full_name) || '').split(' ');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: {
        id: userId, email: authRes.data.user.email,
        firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '',
        plan: (profile && profile.plan) || 'free', xp: (profile && profile.xp) || 0,
        token: authRes.data.access_token
      }})};
    }

    // GOOGLE LOGIN — returns the OAuth redirect URL
    if (action === 'googleLogin') {
      const redirectTo = (data && data.redirectTo) || 'https://cvagentuk.co.uk';
      const oauthUrl = SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectTo);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, url: oauthUrl }) };
    }

    // SAVE CV
    if (action === 'saveCV') {
      const { userId, jobTitle, originalCV, optimisedCV, score } = data;
      await supaFetch('/rest/v1/cv_history', 'POST', { user_id: userId, job_title: jobTitle, original_cv: originalCV, optimised_cv: optimisedCV, score });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // SAVE APPLICATION
    if (action === 'saveApplication') {
      const { userId, company, jobTitle, status, notes, appliedDate } = data;
      await supaFetch('/rest/v1/applications', 'POST', { user_id: userId, company, job_title: jobTitle, status, notes, applied_date: appliedDate });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET APPLICATIONS
    if (action === 'getApplications') {
      const { userId } = data;
      const res = await supaFetch('/rest/v1/applications?user_id=eq.' + userId + '&order=created_at.desc', 'GET');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, applications: res.data || [] }) };
    }

    // UPDATE XP
    if (action === 'updateXP') {
      const { userId, xp } = data;
      await supaFetch('/rest/v1/users?id=eq.' + userId, 'PATCH', { xp });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GOOGLE CALLBACK — get user info from access token
    if (action === 'googleCallback') {
      const { token } = data;
      if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No token provided' }) };

      const userRes = await supaFetch('/auth/v1/user', 'GET', null, token);
      if (!userRes.ok) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token' }) };

      const userData = userRes.data;
      const fullName = (userData.user_metadata && userData.user_metadata.full_name) || '';
      const nameParts = fullName.split(' ');

      // Upsert profile
      await supaFetch('/rest/v1/users', 'POST', {
        id: userData.id,
        email: userData.email,
        full_name: fullName || userData.email.split('@')[0],
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
      });

      return { statusCode: 200, headers, body: JSON.stringify({
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          firstName: nameParts[0] || userData.email.split('@')[0],
          lastName: nameParts.slice(1).join(' ') || '',
          plan: 'free',
          xp: 0,
          provider: 'google',
          token: token
        }
      })};
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action: ' + action }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
