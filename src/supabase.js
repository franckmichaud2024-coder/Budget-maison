import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ouvybtnapkoegfwnrnlr.supabase.co";
const supabaseAnonKey = "sb_publishable_24gMBEBZM883cVDj8UTtwg_qVX1NYHv";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage,
  },
});