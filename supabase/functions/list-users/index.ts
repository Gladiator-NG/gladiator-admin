import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
  last_logged_in_at?: string | null;
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
      throw new Error('Only Admin users can view all users.');
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) throw authError;

    const authUsers = authData?.users ?? [];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, phone, role, created_at, updated_at, last_logged_in_at',
      );

    if (profilesError) throw profilesError;

    const profilesById = new Map(
      ((profiles ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const users = authUsers.map((authUser) => {
      const profile = profilesById.get(authUser.id);
      const meta = authUser.user_metadata ?? {};
      const firstName =
        typeof meta.first_name === 'string' ? meta.first_name : '';
      const lastName = typeof meta.last_name === 'string' ? meta.last_name : '';
      const metaFullName =
        typeof meta.full_name === 'string'
          ? meta.full_name
          : `${firstName} ${lastName}`.trim() || null;

      return {
        id: authUser.id,
        email: authUser.email ?? null,
        full_name: profile?.full_name ?? metaFullName,
        phone: profile?.phone ?? null,
        role:
          profile?.role ??
          (typeof meta.role === 'string' ? meta.role : null) ??
          'Staff',
        created_at: profile?.created_at ?? authUser.created_at,
        updated_at:
          profile?.updated_at ?? authUser.updated_at ?? authUser.created_at,
        last_logged_in_at:
          authUser.last_sign_in_at ?? profile?.last_logged_in_at ?? null,
      };
    });

    return new Response(JSON.stringify({ users }), {
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

    return new Response(JSON.stringify({ error: message, users: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
