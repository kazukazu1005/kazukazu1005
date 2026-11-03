export interface EnvCheck {
  hasUrl: boolean
  /** The URL is set but is not an https:// address. */
  urlBad: boolean
  hasKey: boolean
  /** Set when the key must not be used in a browser app (a secret / service_role key). */
  keyProblem: 'secret' | null
}

/** Does this look like a server-only key (new "sb_secret_" format, or a JWT whose role is service_role)? */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const part = key.split('.')[1]
  if (!part) return false
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))
    return (JSON.parse(json) as { role?: string }).role === 'service_role'
  } catch {
    return false
  }
}

/** Check the two build-time settings without ever returning their values. */
export function checkEnv(url?: string, key?: string): EnvCheck {
  const u = url?.trim() ?? ''
  const k = key?.trim() ?? ''
  return {
    hasUrl: u !== '',
    urlBad: u !== '' && !/^https:\/\/[^/\s]+/.test(u),
    hasKey: k !== '',
    keyProblem: k !== '' && isSecretKey(k) ? 'secret' : null,
  }
}

export const envReady = (c: EnvCheck) => c.hasUrl && !c.urlBad && c.hasKey && c.keyProblem === null
