import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { checkEnv, envReady } from './keyCheck'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/** What the build received (never the values themselves). Shown on the "not set up" screens. */
export const envCheck = checkEnv(url, key)

/** null when the app was built without usable Supabase settings (no sharing, local log only). */
export const supabase: SupabaseClient | null = envReady(envCheck) ? createClient(url!, key!) : null
export const sharingConfigured = supabase !== null

/** When this version was built, so a stale cached copy is easy to spot. */
export const BUILD_TIME: string = __BUILD_TIME__
