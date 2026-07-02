import { useEffect, useState } from 'react'

interface Props {
  appVersion: string
  java: { found: boolean; path?: string; major?: number; source?: string } | null
}

export function SettingsPage({ appVersion, java }: Props): JSX.Element {
  const [ramMb, setRamMb] = useState(4096)
  const [savedRam, setSavedRam] = useState(4096)

  useEffect(() => {
    window.cabbage.getSettings().then((s) => {
      const v = s.ramMb ?? 4096
      setRamMb(v)
      setSavedRam(v)
    })
  }, [])

  async function saveRam(): Promise<void> {
    await window.cabbage.setSettings({ ramMb })
    setSavedRam(ramMb)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>SETTINGS</h1>
        <span className="muted">the boring-but-useful stuff</span>
      </div>

      <div className="card">
        <h2>Allocated RAM</h2>
        <p className="muted">
          More memory helps with big modpacks and far render distances. 4–6 GB is the sweet spot for
          most setups; going too high can actually hurt.
        </p>
        <div className="ram-row">
          <input
            type="range"
            min={2048}
            max={16384}
            step={512}
            value={ramMb}
            onChange={(e) => setRamMb(Number(e.target.value))}
            className="ram-slider"
          />
          <span className="ram-value">{(ramMb / 1024).toFixed(1)} GB</span>
          <button className="btn small" disabled={ramMb === savedRam} onClick={saveRam}>
            {ramMb === savedRam ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>About</h2>
        <Row k="Launcher" v={`Cabbage Client v${appVersion || '0.1.0'}`} />
        <Row k="Accounts" v="Microsoft (online) + offline" />
        <Row k="Allocated RAM" v={`${(savedRam / 1024).toFixed(1)} GB`} />
      </div>

      <div className="card">
        <h2>Java</h2>
        {java?.found ? (
          <>
            <Row k="Version" v={`Java ${java.major}`} />
            <Row k="Source" v={java.source ?? '—'} />
            <Row k="Path" v={java.path ?? '—'} />
          </>
        ) : (
          <p className="muted">
            No system Java detected. Cabbage downloads the correct Mojang runtime automatically the
            first time you launch.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Roadmap</h2>
        <ul className="tip-list">
          <li>✓ Microsoft login · RAM slider · one-click FPS pack</li>
          <li>Mod profiles — save &amp; switch loadouts (next)</li>
          <li>Custom tennis HUD — needs a mappings-available MC version</li>
        </ul>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="kv">
      <span className="kv-k muted">{k}</span>
      <span className="kv-v">{v}</span>
    </div>
  )
}
