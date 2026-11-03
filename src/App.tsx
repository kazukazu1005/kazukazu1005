import { useEffect, useRef, useState } from 'react'
import Toaster from './components/Toaster'
import Celebration from './components/Celebration'
import Loading from './components/Loading'
import { useAppData } from './data'
import { syncPending, useAuth } from './social'
import { useFriendActivity } from './activity'
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
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const userId = auth.session?.user.id
  const activity = useFriendActivity(userId, sharingConfigured && !!auth.profile)
  useEffect(() => {
    if (userId && auth.profile && data.ready && online) void syncPending(userId, data.workouts, data.exercises)
  }, [userId, auth.profile, data.ready, data.workouts, data.exercises, online])

  // Keep trying while something is still unsent (a weak signal, for example).
  const latestData = useRef(data)
  latestData.current = data
  useEffect(() => {
    if (!userId || !auth.profile || !online) return
    const t = setInterval(() => {
      const d = latestData.current
      if (d.ready && d.workouts.some((w) => !w.synced)) void syncPending(userId, d.workouts, d.exercises)
    }, 30000)
    return () => clearInterval(t)
  }, [userId, auth.profile, online])

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
      {!online && <div className="offline" role="status">You are offline. Records are saved on this device and shared when you are back online.</div>}
      <main>
        {route.name === 'home' ? (
          // The home screen does not wait for the data: it opens at once and fills in.
          <Home data={data} go={setRoute} signedIn={!!auth.profile} />
        ) : !data.ready ? (
          <Loading />
        ) : route.name === 'edit' ? (
          <Editor key={(route.id ?? 'new') + (route.date ?? '')} data={data} auth={auth} id={route.id} date={route.date} go={setRoute} />
        ) : route.name === 'social' ? (
          <Social data={data} auth={auth} seen={activity.seen} onSeen={activity.markSeen} onEditProfile={() => setRoute({ name: 'profile' })} />
        ) : route.name === 'profile' ? (
          <Profile data={data} auth={auth} />
        ) : route.name === 'progress' ? (
          <Progress data={data} />
        ) : (
          <Settings data={data} />
        )}
      </main>
      <Toaster />
      <Celebration />
      <nav className="tabs" aria-label="Main">
        <div className="inner">
          {tabs.map((t) => (
            <button
              key={t.key}
              aria-current={route.name === t.key ? 'page' : undefined}
              aria-label={t.key === 'social' && activity.unread ? 'Friends, new activity' : undefined}
              onClick={() => setRoute(t.to)}
            >
              <span className="tab-label">
                {t.label}
                {t.key === 'social' && activity.unread && <i className="notify-dot" aria-hidden="true" />}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
