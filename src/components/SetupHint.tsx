import { BUILD_TIME, envCheck } from '../supabase'

function Row({ name, state }: { name: string; state: 'ok' | 'missing' | 'bad' | 'secret' }) {
  const text = {
    ok: 'received',
    missing: 'missing: add it under Settings > Build > Variables and secrets, then retry the build',
    bad: 'received, but it must start with https://',
    secret: 'this is a secret key and is not used. Use the publishable (anon) key instead',
  }[state]
  return (
    <li>
      <code>{name}</code>: <b>{state === 'ok' ? 'OK' : 'Problem'}</b> <span className="sub">({text})</span>
    </li>
  )
}

/** Explains why sharing is off, from what this build received. Shows no secret values. */
export default function SetupHint() {
  return (
    <>
      <p style={{ margin: '12px 0 4px' }}><b>What this build received</b></p>
      <ul className="hint-list">
        <Row name="VITE_SUPABASE_URL" state={!envCheck.hasUrl ? 'missing' : envCheck.urlBad ? 'bad' : 'ok'} />
        <Row name="VITE_SUPABASE_ANON_KEY" state={!envCheck.hasKey ? 'missing' : envCheck.keyProblem ? 'secret' : 'ok'} />
      </ul>
      <p className="sub" style={{ margin: '4px 0 0' }}>
        These are read when the app is built, so after changing them, build again and reopen the app. This version was built at {new Date(BUILD_TIME).toLocaleString()}.
      </p>
    </>
  )
}
