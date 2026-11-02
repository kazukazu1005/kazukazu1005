import { useEffect, useState } from 'react'
import { useAppData } from './data'
import { syncPending, useAuth } from './social'
import Home from './screens/Home'
import Editor from './screens/Editor'
import Progress from './screens/Progress'
import Settings from './screens/Settings'
import Social from './screens/Social'
import Profile from './screens/Profile'
import Avatar from './components/Avatar'
import { sharingConfigured } from './supabase'

export type Route = { name: 'home' } | { name: 'edit'; id?: string; date?: string } | { name: 'social' } | { name: 'progress' } | { name: 'settings' } | { name: 'profile' }
export type Auth = ReturnType<typeof useAuth>

export default function App() {
  const data = useAppData()
  const auth = useAuth()
  const [route, setRoute] = useState<Route>({ name: 'home' })

  const userId = auth.session?.user.id
  useEffect(() => {
    if (userId && auth.profile && data.ready) void syncPending(userId, data.workouts, data.exercises)
  }, [userId, auth.profile, data.ready, data.workouts, data.exercises])

  const tabs: { key: Route['name']; label: string; to: Route }[] = [
    { key: 'home', label: 'Home', to: { name: 'home' } },
    { key: 'edit', label: 'Log', to: { name: 'edit' } },
    { key: 'social', label: 'Friends', to: { name: 'social' } },
    { key: 'progress', label: 'Progress', to: { name: 'progress' } },
    { key: 'settings', label: 'Settings', to: { name: 'settings' } },
  ]

  return (
    <div className="app">
      <header className="top row spread">
        <h1>Gym Bro</h1>
        {sharingConfigured && (
          <button className="profile-btn" aria-label="Your profile" aria-current={route.name === 'profile' ? 'page' : undefined} onClick={() => setRoute({ name: 'profile' })}>
            {auth.profile ? <Avatar profile={auth.profile} size={40} /> : <span className="avatar" style={{ width: 40, height: 40, fontSize: 18 }} aria-hidden="true">＋</span>}
          </button>
        )}
      </header>
      <main>
        {!data.ready ? (
          <p>Loading…</p>
        ) : route.name === 'home' ? (
          <Home data={data} go={setRoute} signedIn={!!auth.profile} />
        ) : route.name === 'edit' ? (
          <Editor key={(route.id ?? 'new') + (route.date ?? '')} data={data} auth={auth} id={route.id} date={route.date} go={setRoute} />
        ) : route.name === 'social' ? (
          <Social data={data} auth={auth} onEditProfile={() => setRoute({ name: 'profile' })} />
        ) : route.name === 'profile' ? (
          <Profile data={data} auth={auth} />
        ) : route.name === 'progress' ? (
          <Progress data={data} />
        ) : (
          <Settings data={data} />
        )}
      </main>
      <nav className="tabs" aria-label="Main">
        <div className="inner">
          {tabs.map((t) => (
            <button key={t.key} aria-current={route.name === t.key ? 'page' : undefined} onClick={() => setRoute(t.to)}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
