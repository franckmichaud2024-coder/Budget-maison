import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tffwdycqudtwiyrsrsmg.supabase.co";
const supabaseKey = "TA_CLE";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // 🔴 IMPORTANT
    autoRefreshToken: false, // 🔴 IMPORTANT
  },
});