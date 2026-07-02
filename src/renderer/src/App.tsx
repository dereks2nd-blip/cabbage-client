import { useEffect, useState } from 'react'
import birdSitting from './assets/tennisbird.svg'
import birdGoogly from './assets/tennisbird-googly.svg'
import { PlayPage } from './pages/PlayPage'
import { ModsPage } from './pages/ModsPage'
import { PerformancePage } from './pages/PerformancePage'
import { SettingsPage } from './pages/SettingsPage'

interface JavaState {
  found: boolean
  path?: string
  major?: number
  source?: string
}

export type Page = 'play' | 'mods' | 'performance' | 'settings'

export default function App(): JSX.Element {
  const [appVersion, setAppVersion] = useState('')
  const [java, setJava] = useState<JavaState | null>(null)
  const [page, setPage] = useState<Page>('play')

  // Shared launch config so Play and Mods agree on the target version/loader.
  const [versions, setVersions] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [loader, setLoader] = useState<'vanilla' | 'fabric'>('fabric')
  const [loadingVersions, setLoadingVersions] = useState(true)

  useEffect(() => {
    window.cabbage.getVersion().then(setAppVersion)
    window.cabbage.detectJava().then(setJava)
    window.cabbage
      .listVersions()
      .then((res) => {
        setVersions(res.versions.map((v) => v.id))
        setSelected(res.latestRelease)
      })
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false))
  }, [])

  const navItems: Array<{ id: Page; label: string }> = [
    { id: 'play', label: '▶ Play' },
    { id: 'mods', label: '◆ Mods' },
    { id: 'performance', label: '⚡ Performance' },
    { id: 'settings', label: '⚙ Settings' }
  ]

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <img src={birdSitting} alt="" />
          <span className="brand-name">CABBAGE CLIENT</span>
          <span className="badge">v{appVersion || '0.1.0'}</span>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <nav>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <img className="mascot-mini" src={birdGoogly} alt="tennis bird" />
            <JavaPill java={java} />
          </div>
        </aside>

        <main className="content">
          <img className="bg-bird one" src={birdSitting} alt="" />
          <img className="bg-bird two" src={birdGoogly} alt="" />

          {page === 'play' && (
            <PlayPage
              versions={versions}
              selected={selected}
              setSelected={setSelected}
              loader={loader}
              setLoader={setLoader}
              loadingVersions={loadingVersions}
            />
          )}
          {page === 'mods' && <ModsPage gameVersion={selected} loader={loader} />}
          {page === 'performance' && <PerformancePage gameVersion={selected} />}
          {page === 'settings' && <SettingsPage appVersion={appVersion} java={java} />}
        </main>
      </div>
    </div>
  )
}

function JavaPill({ java }: { java: JavaState | null }): JSX.Element {
  if (java === null) return <div className="pill pill-neutral">Checking Java…</div>
  if (!java.found) return <div className="pill pill-warn">No Java — auto-downloads on play</div>
  return (
    <div className="pill pill-ok" title={java.path}>
      Java {java.major} · {java.source}
    </div>
  )
}
