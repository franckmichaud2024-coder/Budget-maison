import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ouvybtnapkoegfwnrnlr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dnlidG5hcGtvZXFmd25ybmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjkwMjIsImV4cCI6MjA5MjgwNTAyMn0.LGHI9zm_yjAAs-Zb0Kz1tDU9vUGGuojQ5MbK4Nbhzmc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage,
  },
});