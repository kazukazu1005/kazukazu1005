import { describe, expect, it } from 'vitest'
import { checkEnv, envReady, isSecretKey } from './keyCheck'

const jwt = (role: string) => `h.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.s`

describe('keyCheck', () => {
  it('flags server-only keys', () => {
    expect(isSecretKey('sb_secret_abc')).toBe(true)
    expect(isSecretKey(jwt('service_role'))).toBe(true)
    expect(isSecretKey(jwt('anon'))).toBe(false)
    expect(isSecretKey('sb_publishable_abc')).toBe(false)
    expect(isSecretKey('not-a-key')).toBe(false)
  })
  it('reports what is missing without needing the values', () => {
    expect(checkEnv(undefined, undefined)).toEqual({ hasUrl: false, urlBad: false, hasKey: false, keyProblem: null })
    expect(envReady(checkEnv('https://abc.supabase.co', 'sb_publishable_x'))).toBe(true)
    expect(envReady(checkEnv('https://abc.supabase.co', undefined))).toBe(false)
    expect(checkEnv('abc.supabase.co', 'k').urlBad).toBe(true) // missing https://
    expect(checkEnv('http://abc.supabase.co', 'k').urlBad).toBe(true)
    expect(checkEnv('  https://abc.supabase.co  ', ' k ').urlBad).toBe(false) // stray spaces are tolerated
    expect(envReady(checkEnv('https://abc.supabase.co', 'sb_secret_x'))).toBe(false)
  })
})
