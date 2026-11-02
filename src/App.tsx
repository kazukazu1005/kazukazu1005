import { useState } from 'react'
import { useAppData } from './data'
import Home from './screens/Home'
import Editor from './screens/Editor'
import Progress from './screens/Progress'
import Settings from './screens/Settings'

export type Route = { name: 'home' } | { name: 'edit'; id?: string } | { name: 'progress' } | { name: 'settings' }

export default function App() {
  const data = useAppData()
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const tab = route.name === 'edit' ? 'edit' : route.name

  const tabs: { key: Route['name']; label: string; to: Route }[] = [
    { key: 'home', label: 'ホーム', to: { name: 'home' } },
    { key: 'edit', label: '記録する', to: { name: 'edit' } },
    { key: 'progress', label: '成長', to: { name: 'progress' } },
    { key: 'settings', label: '設定', to: { name: 'settings' } },
  ]

  return (
    <div className="app">
      <header className="top">
        <h1>筋トレメモ</h1>
      </header>
      <main>
        {!data.ready ? (
          <p>読み込み中…</p>
        ) : route.name === 'home' ? (
          <Home data={data} go={setRoute} />
        ) : route.name === 'edit' ? (
          <Editor key={route.id ?? 'new'} data={data} id={route.id} go={setRoute} />
        ) : route.name === 'progress' ? (
          <Progress data={data} />
        ) : (
          <Settings data={data} />
        )}
      </main>
      <nav className="tabs" aria-label="メインメニュー">
        <div className="inner">
          {tabs.map((t) => (
            <button key={t.key} aria-current={tab === t.key ? 'page' : undefined} onClick={() => setRoute(t.to)}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
