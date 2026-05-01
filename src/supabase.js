import { createClient } from '@supabase/supabase-js'

const supabaseUrl = '...'
const supabaseKey = '...'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})