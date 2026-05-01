import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "TON_URL_SUPABASE";
const supabaseAnonKey = "TA_CLE_ANON_SUPABASE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage,
  },
});