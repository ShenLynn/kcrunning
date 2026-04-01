import { createClient } from '@supabase/supabase-js'

// Server-only — uses secret key, never sent to browser
const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SECRET_KEY!

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false },
})
