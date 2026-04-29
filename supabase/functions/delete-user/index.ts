import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

async function broadcastSessionRevoked({
  supabaseUrl,
  serviceRoleKey,
  userId,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
}) {
  const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `user:${userId}`,
          event: 'session_revoked',
          payload: {
            reason: 'user_deleted',
            user_id: userId,
            sent_at: new Date().toISOString(),
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Realtime broadcast failed with ${response.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
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
      throw new Error('Only Admin users can remove users.');
    }

    const { userId } = await req.json();

    if (!userId) throw new Error('userId is required');

    const warnings: string[] = [];

    // Delete auth user. This revokes refresh tokens; already-issued JWTs can
    // remain valid until expiry, so clients also enforce the broadcast above.
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) throw error;

    try {
      await broadcastSessionRevoked({ supabaseUrl, serviceRoleKey, userId });
    } catch (broadcastError) {
      warnings.push(
        broadcastError instanceof Error
          ? broadcastError.message
          : 'Realtime broadcast failed',
      );
    }

    return new Response(JSON.stringify({ success: true, warnings }), {
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
