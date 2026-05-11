import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tffwdycqudtwiyrsrsmg.supabase.co";

const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZndkeWNxdWR0d2l5cnNyc21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIwNzMsImV4cCI6MjA5Mjk1ODA3M30._iBr0xnwlJn57P9WEE1ZN5S4kBmUn4vsmwqfAUDJmoo";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});