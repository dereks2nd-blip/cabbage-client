import { useEffect, useState } from 'react'
import birdSitting from './assets/tennisbird.svg'
import birdGoogly from './assets/tennisbird-googly.svg'
import { PlayPage } from './pages/PlayPage'
import { InstancesPage } from './pages/InstancesPage'
import { ModsPage } from './pages/ModsPage'
import { PerformancePage } from './pages/PerformancePage'
import { SettingsPage } from './pages/SettingsPage'

interface JavaState {
  found: boolean
  path?: string
  major?: number
  source?: string
}

export type Page = 'play' | 'instances' | 'mods' | 'performance' | 'settings'

export interface ActiveInstance {
  id: string
  name: string
  mcVersion: string
  loader: 'vanilla' | 'fabric'
}

export default function App(): JSX.Element {
  const [appVersion, setAppVersion] = useState('')
  const [java, setJava] = useState<JavaState | null>(null)
  const [page, setPage] = useState<Page>('play')

  // Shared launch config so Play and Mods agree on the target version/loader.
  const [versions, setVersions] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [loader, setLoader] = useState<'vanilla' | 'fabric'>('fabric')
  const [loadingVersions, setLoadingVersions] = useState(true)
  // Bumped when an instance card's Play is clicked: switches to the Play tab
  // and tells it to launch immediately with the freshly-set version/loader.
  const [launchToken, setLaunchToken] = useState(0)
  // The named instance that Play/Mods currently target. Null = the default
  // per-version instance (plain Play-tab behavior).
  const [activeInstance, setActiveInstance] = useState<ActiveInstance | null>(null)

  function activateInstance(inst: ActiveInstance, target: 'play' | 'mods'): void {
    setActiveInstance(inst)
    setSelected(inst.mcVersion)
    setLoader(inst.loader)
    setPage(target)
    if (target === 'play') setLaunchToken((t) => t + 1)
  }

  // Manually changing version/loader on the Play tab detaches from the
  // named instance — the selection no longer describes it.
  function selectVersion(v: string): void {
    setSelected(v)
    setActiveInstance(null)
  }
  function selectLoader(l: 'vanilla' | 'fabric'): void {
    setLoader(l)
    setActiveInstance(null)
  }

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
    { id: 'instances', label: '🗂 Instances' },
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
              setSelected={selectVersion}
              loader={loader}
              setLoader={selectLoader}
              loadingVersions={loadingVersions}
              launchToken={launchToken}
              activeInstance={activeInstance}
              onDetach={() => setActiveInstance(null)}
            />
          )}
          {page === 'instances' && (
            <InstancesPage
              versions={versions}
              loadingVersions={loadingVersions}
              activeInstanceId={activeInstance?.id ?? null}
              onActivate={activateInstance}
            />
          )}
          {page === 'mods' && (
            <ModsPage gameVersion={selected} loader={loader} activeInstance={activeInstance} />
          )}
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
