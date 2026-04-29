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

    const authHeader = req.headers.get('authorization') ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      throw new Error('Missing auth token. Please sign in again.');
    }

    const {
      data: { user: caller },
      error: callerError,
    } = await supabase.auth.getUser(accessToken);

    if (callerError || !caller) {
      throw new Error('Invalid or expired session. Please sign in again.');
    }

    const { data: callerProfile, error: profileReadError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();

    if (profileReadError) {
      throw new Error(
        `Unable to verify permissions: ${profileReadError.message}`,
      );
    }

    const callerRole = callerProfile?.role?.toLowerCase() ?? '';
    if (callerRole !== 'admin') {
      throw new Error('Only Admin users can send invites.');
    }

    const { email, fullName, role, redirectTo } = await req.json();

    const { data, error: authError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role,
          invite_pending: true,
          password_changed: false,
        },
        redirectTo,
      });

    if (authError) throw authError;

    const invitedUser = data?.user ?? null;
    const warnings: string[] = [];

    // Best effort profile sync. Do not fail successful invites if this fails.
    if (invitedUser?.id) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: invitedUser.id,
          full_name: fullName,
          role,
          created_at: invitedUser.created_at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        warnings.push(`Profile sync warning: ${profileError.message}`);
      }
    }

    // Best effort activity notification. Do not fail successful invites if this fails.
    const { error: notifError } = await supabase.from('notifications').insert({
      type: 'new_user',
      title: 'New Staff Account',
      message: `${fullName} was invited as ${role}`,
      entity_type: 'user',
      metadata: { full_name: fullName, email, role },
    });

    if (notifError) {
      warnings.push(`Notification warning: ${notifError.message}`);
    }

    return new Response(
      JSON.stringify({ invited: true, user: invitedUser, warnings }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
    return new Response(
      JSON.stringify({
        invited: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  }
});
