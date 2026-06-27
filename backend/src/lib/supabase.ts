import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service role client: bypasses RLS. Use ONLY on the backend.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
