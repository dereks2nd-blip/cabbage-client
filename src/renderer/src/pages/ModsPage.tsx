import { useEffect, useState } from 'react'

interface ModHit {
  projectId: string
  slug: string
  title: string
  description: string
  author: string
  downloads: number
  iconUrl: string | null
  categories: string[]
}

interface Props {
  gameVersion: string
  loader: 'vanilla' | 'fabric'
}

interface Profile {
  name: string
  mods: Array<{ projectId: string; title: string }>
  updatedAt: string
}

// A few good FPS/QoL mods to surface before the user searches anything.
const SUGGESTED = 'sodium lithium iris'

// Feather/Lunar-style features, each mapped to a Modrinth search.
const PRESETS: Array<{ label: string; query: string }> = [
  { label: '⚡ FPS Boost', query: 'sodium lithium' },
  { label: '⌨ Keystrokes', query: 'keystrokes' },
  { label: '🛡 Armor HUD', query: 'armor hud' },
  { label: '📊 FPS Display', query: 'fps' },
  { label: '🔍 Zoom', query: 'zoom' },
  { label: '🗺 Minimap', query: 'minimap' },
  { label: '✨ Shaders', query: 'iris shaders' },
  { label: '🎯 Coords/HUD', query: 'hud coordinates' }
]

export function ModsPage({ gameVersion, loader }: Props): JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ModHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [installing, setInstalling] = useState<Record<string, 'busy' | 'done' | 'err'>>({})
  const [installed, setInstalled] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileName, setProfileName] = useState('')
  const [profileBusy, setProfileBusy] = useState('')

  async function runSearch(q: string): Promise<void> {
    if (!gameVersion) return
    setLoading(true)
    setError('')
    try {
      setResults(await window.cabbage.searchMods(q, gameVersion))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function refreshInstalled(): void {
    if (gameVersion) window.cabbage.listInstalledMods(gameVersion).then(setInstalled)
  }

  function refreshProfiles(): void {
    window.cabbage.listProfiles().then(setProfiles)
  }

  useEffect(() => {
    runSearch(SUGGESTED)
    refreshInstalled()
    refreshProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameVersion])

  async function saveProfile(): Promise<void> {
    if (!profileName.trim()) return
    setProfileBusy('save')
    try {
      const res = await window.cabbage.saveProfile(profileName, gameVersion)
      setNotice(
        `Saved profile "${res.profile.name}" (${res.profile.mods.length} mods).` +
          (res.unmanaged.length
            ? ` ⚠ Not captured (manually added): ${res.unmanaged.join(', ')}`
            : '')
      )
      setProfileName('')
      refreshProfiles()
    } catch (e) {
      setNotice(`✖ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProfileBusy('')
    }
  }

  async function applyProfile(name: string): Promise<void> {
    setProfileBusy(name)
    setNotice(`Applying "${name}"…`)
    try {
      const res = await window.cabbage.applyProfile(name, gameVersion)
      setNotice(
        `Applied "${name}": ${res.installed.length} mods installed for ${gameVersion}.` +
          (res.warnings.length ? ` ⚠ ${res.warnings.join('; ')}` : '')
      )
      refreshInstalled()
    } catch (e) {
      setNotice(`✖ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProfileBusy('')
    }
  }

  async function deleteProfile(name: string): Promise<void> {
    await window.cabbage.deleteProfile(name)
    refreshProfiles()
  }

  async function install(hit: ModHit): Promise<void> {
    setInstalling((s) => ({ ...s, [hit.projectId]: 'busy' }))
    setNotice('')
    try {
      const res = await window.cabbage.installMod(hit.projectId, gameVersion)
      setInstalling((s) => ({ ...s, [hit.projectId]: 'done' }))
      const deps = Math.max(0, res.installed.length - 1)
      setNotice(
        `Installed ${hit.title}${deps ? ` + ${deps} dependenc${deps === 1 ? 'y' : 'ies'}` : ''}.` +
          (res.warnings.length ? ` ⚠ ${res.warnings.join('; ')}` : '')
      )
      refreshInstalled()
    } catch (e) {
      setInstalling((s) => ({ ...s, [hit.projectId]: 'err' }))
      setNotice(`✖ ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function remove(filename: string): Promise<void> {
    await window.cabbage.removeMod(filename, gameVersion)
    refreshInstalled()
  }

  async function clearAll(): Promise<void> {
    await window.cabbage.clearMods(gameVersion)
    setNotice('Cleared all mods for this version.')
    refreshInstalled()
  }

  return (
    <div className="page mods-page">
      <div className="page-head">
        <h1>MODS</h1>
        <span className="muted">
          {loader === 'fabric' ? `Fabric · MC ${gameVersion}` : '⚠ switch loader to Fabric on Play tab'}
        </span>
      </div>

      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault()
          runSearch(query || SUGGESTED)
        }}
      >
        <input
          className="input"
          placeholder="Search Modrinth (e.g. sodium, shaders, minimap)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="preset-chip"
            onClick={() => {
              setQuery(p.query)
              runSearch(p.query)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="profiles-strip">
        <span className="muted">Profiles:</span>
        {profiles.length === 0 && <span className="muted">none saved yet</span>}
        {profiles.map((p) => (
          <span
            key={p.name}
            className="chip removable profile-chip"
            title={p.mods.map((m) => m.title).join(', ')}
          >
            <button
              className="chip-apply"
              disabled={profileBusy !== ''}
              onClick={() => applyProfile(p.name)}
              title={`Replace this version's mods with "${p.name}" (${p.mods.length} mods)`}
            >
              {profileBusy === p.name ? '…' : `▶ ${p.name} (${p.mods.length})`}
            </button>
            <button className="chip-x" onClick={() => deleteProfile(p.name)} title="Delete profile">
              ×
            </button>
          </span>
        ))}
        <form
          className="profile-save"
          onSubmit={(e) => {
            e.preventDefault()
            saveProfile()
          }}
        >
          <input
            className="input small"
            placeholder="Save current as…"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            maxLength={40}
          />
          <button
            className="btn small"
            type="submit"
            disabled={profileBusy !== '' || !profileName.trim() || installed.length === 0}
          >
            {profileBusy === 'save' ? '…' : 'Save'}
          </button>
        </form>
      </div>

      {installed.length > 0 && (
        <div className="installed-strip">
          <span className="muted">Installed ({installed.length}):</span>{' '}
          {installed.map((m) => (
            <span key={m} className="chip removable" title={m}>
              {m.replace(/\.jar$/, '')}
              <button className="chip-x" onClick={() => remove(m)} title="Remove">
                ×
              </button>
            </span>
          ))}
          <button className="btn small danger" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error-line">✖ {error}</div>}
      {loading && <div className="muted pad">Searching…</div>}

      <div className="mod-grid">
        {results.map((hit) => {
          const state = installing[hit.projectId]
          return (
            <div className="mod-card" key={hit.projectId}>
              <div className="mod-card-top">
                {hit.iconUrl ? (
                  <img className="mod-icon" src={hit.iconUrl} alt="" loading="lazy" />
                ) : (
                  <div className="mod-icon placeholder">◆</div>
                )}
                <div className="mod-meta">
                  <div className="mod-title">{hit.title}</div>
                  <div className="mod-author muted">by {hit.author}</div>
                </div>
              </div>
              <div className="mod-desc">{hit.description}</div>
              <div className="mod-card-bottom">
                <span className="muted dl">⬇ {formatDownloads(hit.downloads)}</span>
                <button
                  className={`btn small ${state === 'done' ? 'ok' : ''}`}
                  disabled={state === 'busy' || state === 'done'}
                  onClick={() => install(hit)}
                >
                  {state === 'busy'
                    ? '…'
                    : state === 'done'
                      ? '✓ Installed'
                      : state === 'err'
                        ? 'Retry'
                        : 'Install'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!loading && results.length === 0 && !error && (
        <div className="muted pad">No results. Try another search.</div>
      )}
    </div>
  )
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
