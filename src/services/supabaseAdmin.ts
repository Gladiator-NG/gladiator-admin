import { createClient } from '@supabase/supabase-js';

// Service-role client — only used for admin operations (create/delete auth users).
// Keep VITE_SUPABASE_SERVICE_KEY secret. Never expose this key publicly.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabaseAdmin;
