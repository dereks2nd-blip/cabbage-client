import { useEffect, useState } from 'react'

interface Instance {
  id: string
  mcVersion: string
  loader: string
  name: string
  modCount: number
  hasWorlds: boolean
  lastPlayedMs: number | null
}

interface Props {
  versions: string[]
  loadingVersions: boolean
  activeInstanceId: string | null
  onActivate: (
    inst: { id: string; name: string; mcVersion: string; loader: 'vanilla' | 'fabric' },
    target: 'play' | 'mods'
  ) => void
}

export function InstancesPage({
  versions,
  loadingVersions,
  activeInstanceId,
  onActivate
}: Props): JSX.Element {
  const [instances, setInstances] = useState<Instance[]>([])
  const [newVersion, setNewVersion] = useState('')
  const [newLoader, setNewLoader] = useState<'vanilla' | 'fabric'>('fabric')
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')
  const [renaming, setRenaming] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [notice, setNotice] = useState('')

  function refresh(): void {
    window.cabbage.listInstances().then(setInstances)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!newVersion && versions.length > 0) setNewVersion(versions[0])
  }, [versions, newVersion])

  async function create(): Promise<void> {
    if (!newVersion) return
    const created = await window.cabbage.createInstance(
      newVersion,
      newLoader,
      newName.trim() || undefined
    )
    setNewName('')
    setNotice(
      `Created "${created.name}" — its mods/worlds live in instances/${created.id}. ` +
        'Hit ◆ Mods on the card to give it its own mod set.'
    )
    refresh()
  }

  async function remove(id: string): Promise<void> {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      return
    }
    setConfirmDelete('')
    await window.cabbage.deleteInstance(id)
    setNotice('Instance deleted.')
    refresh()
  }

  async function saveRename(id: string): Promise<void> {
    if (renameValue.trim()) await window.cabbage.renameInstance(id, renameValue)
    setRenaming('')
    refresh()
  }

  return (
    <div className="page instances-page">
      <div className="page-head">
        <h1>INSTANCES</h1>
        <span className="muted">each instance has its own mods, worlds &amp; settings</span>
      </div>

      <div className="instance-create">
        <input
          className="input small"
          placeholder="Name (optional)"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="version-select small"
          value={newVersion}
          disabled={loadingVersions || versions.length === 0}
          onChange={(e) => setNewVersion(e.target.value)}
        >
          {versions.slice(0, 80).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <div className="seg">
          <button
            className={`seg-btn ${newLoader === 'vanilla' ? 'active' : ''}`}
            onClick={() => setNewLoader('vanilla')}
          >
            Vanilla
          </button>
          <button
            className={`seg-btn ${newLoader === 'fabric' ? 'active' : ''}`}
            onClick={() => setNewLoader('fabric')}
          >
            Fabric
          </button>
        </div>
        <button className="btn" onClick={create} disabled={!newVersion}>
          + Create
        </button>
      </div>

      {notice && <div className="notice">{notice}</div>}

      <div className="instance-grid">
        {instances.map((inst) => (
          <div
            className={`instance-card ${activeInstanceId === inst.id ? 'active' : ''}`}
            key={inst.id}
          >
            <div className="instance-card-head">
              {renaming === inst.id ? (
                <form
                  className="rename-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveRename(inst.id)
                  }}
                >
                  <input
                    className="input small"
                    autoFocus
                    value={renameValue}
                    maxLength={40}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(inst.id)}
                  />
                </form>
              ) : (
                <div
                  className="instance-name"
                  title="Click to rename"
                  onClick={() => {
                    setRenaming(inst.id)
                    setRenameValue(inst.name)
                  }}
                >
                  {inst.name} <span className="rename-hint">✎</span>
                </div>
              )}
            </div>
            <div className="instance-badges">
              <span className="chip">{inst.mcVersion}</span>
              <span className="chip">{inst.loader}</span>
              {inst.modCount > 0 && <span className="chip">◆ {inst.modCount} mods</span>}
              {inst.hasWorlds && <span className="chip">🌍 worlds</span>}
            </div>
            <div className="instance-meta muted">{lastPlayed(inst.lastPlayedMs)}</div>
            <div className="instance-actions">
              <button
                className="btn play-mini"
                onClick={() =>
                  onActivate(
                    {
                      id: inst.id,
                      name: inst.name,
                      mcVersion: inst.mcVersion,
                      loader: inst.loader as 'vanilla' | 'fabric'
                    },
                    'play'
                  )
                }
              >
                ▶ Play
              </button>
              <button
                className="btn small"
                title="Manage this instance's mods"
                onClick={() =>
                  onActivate(
                    {
                      id: inst.id,
                      name: inst.name,
                      mcVersion: inst.mcVersion,
                      loader: inst.loader as 'vanilla' | 'fabric'
                    },
                    'mods'
                  )
                }
              >
                ◆ Mods
              </button>
              <button
                className={`btn small ${confirmDelete === inst.id ? 'danger' : ''}`}
                title="Deletes mods, worlds and settings of this instance"
                onClick={() => remove(inst.id)}
                onMouseLeave={() => setConfirmDelete('')}
              >
                {confirmDelete === inst.id ? 'Really delete?' : '🗑'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {instances.length === 0 && (
        <div className="muted pad">No instances yet — create one above, or just hit Play on the Play tab.</div>
      )}
    </div>
  )
}

function lastPlayed(ms: number | null): string {
  if (!ms) return 'never played'
  const mins = Math.floor((Date.now() - ms) / 60000)
  if (mins < 1) return 'played just now'
  if (mins < 60) return `played ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `played ${hours}h ago`
  return `played ${Math.floor(hours / 24)}d ago`
}
