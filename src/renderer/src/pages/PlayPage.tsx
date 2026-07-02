import { useEffect, useRef, useState } from 'react'

type LaunchEvent =
  | { type: 'stage'; stage: string; message: string; done?: number; total?: number }
  | { type: 'log'; line: string }
  | { type: 'started'; pid: number }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string }

type Phase = 'idle' | 'working' | 'running' | 'error'

interface Props {
  versions: string[]
  selected: string
  setSelected: (v: string) => void
  loader: 'vanilla' | 'fabric'
  setLoader: (l: 'vanilla' | 'fabric') => void
  loadingVersions: boolean
}

export function PlayPage({
  versions,
  selected,
  setSelected,
  loader,
  setLoader,
  loadingVersions
}: Props): JSX.Element {
  const [username, setUsername] = useState('Player')
  const [phase, setPhase] = useState<Phase>('idle')
  const [stageMsg, setStageMsg] = useState('')
  const [percent, setPercent] = useState<number | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const consoleRef = useRef<HTMLDivElement>(null)

  const [account, setAccount] = useState<{ name: string; uuid: string } | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    window.cabbage.currentAccount().then(setAccount)
  }, [])

  async function signIn(): Promise<void> {
    setAuthBusy(true)
    setAuthError('')
    try {
      setAccount(await window.cabbage.login())
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e))
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut(): Promise<void> {
    await window.cabbage.logout()
    setAccount(null)
  }

  useEffect(() => {
    const off = window.cabbage.onLaunchEvent((raw) => {
      const e = raw as LaunchEvent
      if (e.type === 'stage') {
        setStageMsg(e.message)
        setPercent(e.total ? Math.round(((e.done ?? 0) / e.total) * 100) : null)
      } else if (e.type === 'log') {
        setLogLines((prev) => [...prev.slice(-300), ...e.line.split(/\r?\n/).filter(Boolean)])
      } else if (e.type === 'started') {
        setPhase('running')
        setStageMsg(`Running (pid ${e.pid})`)
        setPercent(null)
      } else if (e.type === 'exit') {
        setPhase('idle')
        setStageMsg(`Game closed (exit ${e.code ?? '?'})`)
      } else if (e.type === 'error') {
        setPhase('error')
        setErrorMsg(e.message)
      }
    })
    return off
  }, [])

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight })
  }, [logLines])

  const busy = phase === 'working' || phase === 'running'

  function play(): void {
    if (!selected) return
    setPhase('working')
    setErrorMsg('')
    setLogLines([])
    setStageMsg('Starting…')
    setPercent(null)
    window.cabbage.launch({ versionId: selected, username, ramMb: 4096, loader })
  }

  return (
    <div className="hero">
      <h1>READY TO LAUNCH</h1>
      <p className="muted">
        Pick a version, hit play. Cabbage grabs Java, downloads the game, tunes the JVM and drops
        you in-game. Use Fabric to load mods &amp; FPS boosters from the Mods tab.
      </p>

      <div className="field">
        <label>Account</label>
        {account ? (
          <div className="account-card signed-in">
            <span className="acc-dot" />
            <span className="acc-name">{account.name}</span>
            <span className="acc-type">Microsoft · online play</span>
            <button className="btn small" disabled={busy} onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="account-card">
            <button className="btn ms-btn" disabled={authBusy} onClick={signIn}>
              {authBusy ? 'Signing in…' : '🎮 Sign in with Microsoft'}
            </button>
            <span className="muted">Opens a Microsoft login. Needed for public servers.</span>
          </div>
        )}
        {authError && <div className="error-line">✖ {authError}</div>}
      </div>

      {!account && (
        <div className="field">
          <label>Offline username (singleplayer only)</label>
          <input
            className="input"
            value={username}
            maxLength={16}
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label>Loader</label>
        <div className="seg">
          <button
            className={`seg-btn ${loader === 'vanilla' ? 'active' : ''}`}
            disabled={busy}
            onClick={() => setLoader('vanilla')}
          >
            Vanilla
          </button>
          <button
            className={`seg-btn ${loader === 'fabric' ? 'active' : ''}`}
            disabled={busy}
            onClick={() => setLoader('fabric')}
          >
            Fabric (mods)
          </button>
        </div>
      </div>

      <div className="field">
        <label>Version</label>
        <div className="launch-row">
          <select
            className="version-select"
            value={selected}
            disabled={busy || loadingVersions || versions.length === 0}
            onChange={(e) => setSelected(e.target.value)}
          >
            {loadingVersions && <option>Loading…</option>}
            {!loadingVersions && versions.length === 0 && <option>Offline</option>}
            {versions.slice(0, 80).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button className="play-btn" onClick={play} disabled={busy || !selected}>
            {phase === 'working' ? 'WORKING…' : phase === 'running' ? 'PLAYING…' : `▶ PLAY ${selected}`}
          </button>
        </div>
      </div>

      {(busy || stageMsg) && phase !== 'error' && (
        <div className="progress">
          <div className="progress-head">
            <span className="progress-stage">{stageMsg}</span>
            <span>{percent !== null ? `${percent}%` : ''}</span>
          </div>
          {percent !== null && (
            <div className="bar">
              <div className="bar-fill" style={{ width: `${percent}%` }} />
            </div>
          )}
          {logLines.length > 0 && (
            <div className="console" ref={consoleRef}>
              {logLines.join('\n')}
            </div>
          )}
        </div>
      )}

      {phase === 'error' && (
        <>
          <div className="error-line">✖ {errorMsg}</div>
          {logLines.length > 0 && (
            <div className="console" ref={consoleRef}>
              {logLines.join('\n')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
