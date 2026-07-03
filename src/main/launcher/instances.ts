import { join } from 'path'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { dataRoot, ensureDir, instanceDir, instanceKey } from './paths'

/**
 * Modrinth-style instance cards over the existing on-disk layout. An instance
 * IS the `instances/<mc>-<loader>` folder — nothing new is invented; this
 * module just lists those folders, decorates them with an optional display
 * name (cabbage-instance.json), and lets the UI create/rename/delete them.
 */

export interface InstanceInfo {
  /** Folder name, e.g. "1.21.11-fabric" — the stable id. */
  id: string
  mcVersion: string
  loader: string
  /** Display name; defaults to "<mc> (<loader>)". */
  name: string
  modCount: number
  hasWorlds: boolean
  lastPlayedMs: number | null
}

interface InstanceMeta {
  name?: string
}

function instancesRoot(): string {
  return join(dataRoot(), 'instances')
}

function metaPath(dir: string): string {
  return join(dir, 'cabbage-instance.json')
}

function readMeta(dir: string): InstanceMeta {
  try {
    return JSON.parse(readFileSync(metaPath(dir), 'utf8')) as InstanceMeta
  } catch {
    return {}
  }
}

/** Split "<mc>-<loader>" on the LAST dash (versions contain dashes-free ids, but be safe). */
function parseId(id: string): { mcVersion: string; loader: string } | null {
  const cut = id.lastIndexOf('-')
  if (cut <= 0 || cut === id.length - 1) return null
  const loader = id.slice(cut + 1)
  if (loader !== 'vanilla' && loader !== 'fabric') return null
  return { mcVersion: id.slice(0, cut), loader }
}

export function listInstances(): InstanceInfo[] {
  const root = instancesRoot()
  if (!existsSync(root)) return []
  const out: InstanceInfo[] = []
  for (const id of readdirSync(root)) {
    const parsed = parseId(id)
    const dir = join(root, id)
    if (!parsed || !statSync(dir).isDirectory()) continue

    const modsDir = join(dir, 'mods')
    const modCount = existsSync(modsDir)
      ? readdirSync(modsDir).filter((f) => f.toLowerCase().endsWith('.jar')).length
      : 0

    const savesDir = join(dir, 'saves')
    const hasWorlds = existsSync(savesDir) && readdirSync(savesDir).length > 0

    let lastPlayedMs: number | null = null
    const latestLog = join(dir, 'logs', 'latest.log')
    if (existsSync(latestLog)) lastPlayedMs = statSync(latestLog).mtimeMs

    out.push({
      id,
      ...parsed,
      name: readMeta(dir).name ?? `${parsed.mcVersion} (${parsed.loader})`,
      modCount,
      hasWorlds,
      lastPlayedMs
    })
  }
  // Most recently played first, never-played last.
  return out.sort((a, b) => (b.lastPlayedMs ?? 0) - (a.lastPlayedMs ?? 0))
}

export function createInstance(mcVersion: string, loader: string, name?: string): InstanceInfo {
  const dir = ensureDir(instanceDir(mcVersion, loader))
  if (name?.trim()) writeFileSync(metaPath(dir), JSON.stringify({ name: name.trim().slice(0, 40) }))
  const id = instanceKey(mcVersion, loader)
  return {
    id,
    mcVersion,
    loader,
    name: name?.trim() || `${mcVersion} (${loader})`,
    modCount: 0,
    hasWorlds: false,
    lastPlayedMs: null
  }
}

export function renameInstance(id: string, name: string): void {
  const dir = join(instancesRoot(), id)
  if (!parseId(id) || !existsSync(dir)) throw new Error(`No such instance: ${id}`)
  writeFileSync(metaPath(dir), JSON.stringify({ ...readMeta(dir), name: name.trim().slice(0, 40) }))
}

/** Permanently deletes the instance folder — mods, worlds, configs, all of it. */
export function deleteInstance(id: string): void {
  if (!parseId(id)) throw new Error(`Not an instance id: ${id}`)
  const dir = join(instancesRoot(), id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
