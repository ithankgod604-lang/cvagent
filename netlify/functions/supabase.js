const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (authError) return { statusCode: 400, headers, body: JSON.stringify({ error: authError.message }) };
      const userId = authData.user.id;
      await supabase.from('users').insert({
        id: userId, email, full_name: `${firstName} ${lastName}`,
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: { id: userId, email, firstName, lastName, sector, plan: 'free' } }) };
    }

    // LOGIN
    if (action === 'login') {
      const { email, password } = data;
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email or password.' }) };
      const { data: profile } = await supabase.from('users').select('*').eq('id', authData.user.id).single();
      const nameParts = (profile?.full_name || '').split(' ');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: {
        id: authData.user.id, email: authData.user.email,
        firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '',
        plan: profile?.plan || 'free', xp: profile?.xp || 0,
        token: authData.session.access_token
      }})};
    }

    // SAVE CV
    if (action === 'saveCV') {
      const { userId, jobTitle, originalCV, optimisedCV, score } = data;
      await supabase.from('cv_history').insert({ user_id: userId, job_title: jobTitle, original_cv: originalCV, optimised_cv: optimisedCV, score });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET CV HISTORY
    if (action === 'getCVHistory') {
      const { userId } = data;
      const { data: history } = await supabase.from('cv_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, history: history || [] }) };
    }

    // SAVE APPLICATION
    if (action === 'saveApplication') {
      const { userId, company, jobTitle, status, notes, appliedDate } = data;
      await supabase.from('applications').insert({ user_id: userId, company, job_title: jobTitle, status, notes, applied_date: appliedDate });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET APPLICATIONS
    if (action === 'getApplications') {
      const { userId } = data;
      const { data: apps } = await supabase.from('applications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, applications: apps || [] }) };
    }

    // UPDATE APPLICATION
    if (action === 'updateApplication') {
      const { id, status, notes } = data;
      await supabase.from('applications').update({ status, notes }).eq('id', id);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // DELETE APPLICATION
    if (action === 'deleteApplication') {
      const { id } = data;
      await supabase.from('applications').delete().eq('id', id);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // SAVE ALERT
    if (action === 'saveAlert') {
      const { userId, keywords, location } = data;
      await supabase.from('job_alerts').insert({ user_id: userId, keywords, location });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET ALERTS
    if (action === 'getAlerts') {
      const { userId } = data;
      const { data: alerts } = await supabase.from('job_alerts').select('*').eq('user_id', userId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, alerts: alerts || [] }) };
    }

    // SAVE ACHIEVEMENT
    if (action === 'saveAchievement') {
      const { userId, achievement } = data;
      await supabase.from('achievements').insert({ user_id: userId, achievement });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // UPDATE XP
    if (action === 'updateXP') {
      const { userId, xp } = data;
      await supabase.from('users').update({ xp }).eq('id', userId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
