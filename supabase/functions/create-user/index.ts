import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { email, fullName, role } = await req.json();

    const { data, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'newGladiator123',
      user_metadata: { full_name: fullName, role, password_changed: false },
      email_confirm: true,
    });

    if (authError) throw authError;

    // Attempt profile upsert; ignore errors — the profile may already exist
    // from a DB trigger, or the role column may not exist yet.
    await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        full_name: fullName,
        role,
        created_at: data.user.created_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    // Insert a new_user notification for all admin users to see
    await supabase.from('notifications').insert({
      type: 'new_user',
      title: 'New Staff Account',
      message: `${fullName} joined as ${role}`,
      entity_type: 'user',
      metadata: { full_name: fullName, email, role },
    });

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
