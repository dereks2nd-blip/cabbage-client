import { useState } from 'react'

const PACK = [
  { name: 'Sodium', note: 'rendering engine rewrite' },
  { name: 'Lithium', note: 'game logic / tick speed' },
  { name: 'FerriteCore', note: 'lower memory use' },
  { name: 'ImmediatelyFast', note: 'faster UI / text draw' },
  { name: 'EntityCulling', note: 'skip hidden entities' },
  { name: 'MoreCulling', note: 'skip hidden blocks' },
  { name: 'Sodium Extra', note: 'extra FPS toggles + fog' }
]

const FLAGS = [
  '-XX:+UseG1GC',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:G1NewSizePercent=20',
  '-XX:G1ReservePercent=20',
  '-XX:MaxGCPauseMillis=50',
  '-XX:G1HeapRegionSize=32M'
]

const TIPS = [
  { mod: 'Sodium', note: 'Rewrites the rendering engine — the single biggest FPS win.' },
  { mod: 'Lithium', note: 'Optimizes game logic/tick performance with no behavior changes.' },
  { mod: 'FerriteCore', note: 'Cuts memory usage so the GC runs less often.' },
  { mod: 'Iris', note: 'Shaders (OptiFine-compatible) that still keep Sodium speed.' }
]

export function PerformancePage({ gameVersion }: { gameVersion: string }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function installPack(): Promise<void> {
    if (!gameVersion) return
    setBusy(true)
    setResult('')
    try {
      const res = await window.cabbage.installPerformancePack(gameVersion)
      setResult(
        `✓ Installed ${res.installed.length} files.` +
          (res.warnings.length ? ` Skipped: ${res.warnings.join('; ')}` : ' Launch with Fabric to use them.')
      )
    } catch (e) {
      setResult(`✖ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>PERFORMANCE</h1>
        <span className="muted">how Cabbage squeezes out frames</span>
      </div>

      <div className="card">
        <h2>Max-FPS pack</h2>
        <p className="muted">
          One click installs the full optimization stack (with dependencies) for MC {gameVersion}.
          Stacks on top of Sodium for tick, memory, render and culling wins.
        </p>
        <div className="pack-grid">
          {PACK.map((p) => (
            <div key={p.name} className="pack-item">
              <span className="pack-name">{p.name}</span>
              <span className="muted">{p.note}</span>
            </div>
          ))}
        </div>
        <button className="btn play-wide" disabled={busy || !gameVersion} onClick={installPack}>
          {busy ? 'Installing…' : '⚡ Install Max-FPS pack'}
        </button>
        {result && <div className="notice">{result}</div>}
      </div>

      <div className="card">
        <h2>Active JVM flags</h2>
        <p className="muted">
          Aikar-style G1GC tuning applied to every launch — keeps frame times smooth by stopping
          long GC pauses.
        </p>
        <div className="flags">
          {FLAGS.map((f) => (
            <code key={f} className="flag">
              {f}
            </code>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Recommended FPS mods</h2>
        <p className="muted">
          Install these from the Mods tab (Fabric loader). This is where the real
          &quot;better-than-Lunar&quot; frames come from.
        </p>
        <ul className="tip-list">
          {TIPS.map((t) => (
            <li key={t.mod}>
              <span className="tip-mod">{t.mod}</span> — <span className="muted">{t.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
