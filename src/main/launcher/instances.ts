import { join } from 'path'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { dataRoot, ensureDir, instanceKey } from './paths'

/**
 * Modrinth-style named instances. An instance is a folder under
 * `instances/<slug>` with a `cabbage-instance.json` meta ({name, mcVersion,
 * loader}) — so you can have SEVERAL instances of the same Minecraft version,
 * each with its own mods/worlds/config ("PvP 1.21.11", "Building 1.21.11", …).
 *
 * Legacy folders from the old scheme (`<mcVersion>-<loader>`, no meta) are
 * still recognized by parsing the folder name, so nothing needs migrating.
 */

export interface InstanceInfo {
  /** Folder name under instances/ — the stable id. */
  id: string
  mcVersion: string
  loader: string
  name: string
  modCount: number
  hasWorlds: boolean
  lastPlayedMs: number | null
}

interface InstanceMeta {
  name?: string
  mcVersion?: string
  loader?: string
}

function instancesRoot(): string {
  return join(dataRoot(), 'instances')
}

/** Reject anything that could escape instances/ before joining paths. */
function assertSafeId(id: string): void {
  if (!id || /[\\/]|\.\./.test(id)) throw new Error(`Bad instance id: ${id}`)
}

export function instanceDirById(id: string): string {
  assertSafeId(id)
  return join(instancesRoot(), id)
}

export function instanceModsById(id: string): string {
  return join(instanceDirById(id), 'mods')
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

/** Legacy folder-name fallback: "<mc>-<loader>" split on the LAST dash. */
function parseLegacyId(id: string): { mcVersion: string; loader: string } | null {
  const cut = id.lastIndexOf('-')
  if (cut <= 0 || cut === id.length - 1) return null
  const loader = id.slice(cut + 1)
  if (loader !== 'vanilla' && loader !== 'fabric') return null
  return { mcVersion: id.slice(0, cut), loader }
}

function resolve(id: string): { mcVersion: string; loader: string; name: string } | null {
  const meta = readMeta(join(instancesRoot(), id))
  const legacy = parseLegacyId(id)
  const mcVersion = meta.mcVersion ?? legacy?.mcVersion
  const loader = meta.loader ?? legacy?.loader
  if (!mcVersion || !loader) return null
  return { mcVersion, loader, name: meta.name ?? `${mcVersion} (${loader})` }
}

export function listInstances(): InstanceInfo[] {
  const root = instancesRoot()
  if (!existsSync(root)) return []
  const out: InstanceInfo[] = []
  for (const id of readdirSync(root)) {
    const dir = join(root, id)
    if (!statSync(dir).isDirectory()) continue
    const info = resolve(id)
    if (!info) continue

    const modsDir = join(dir, 'mods')
    const modCount = existsSync(modsDir)
      ? readdirSync(modsDir).filter((f) => f.toLowerCase().endsWith('.jar')).length
      : 0

    const savesDir = join(dir, 'saves')
    const hasWorlds = existsSync(savesDir) && readdirSync(savesDir).length > 0

    let lastPlayedMs: number | null = null
    const latestLog = join(dir, 'logs', 'latest.log')
    if (existsSync(latestLog)) lastPlayedMs = statSync(latestLog).mtimeMs

    out.push({ id, ...info, modCount, hasWorlds, lastPlayedMs })
  }
  // Most recently played first, never-played last.
  return out.sort((a, b) => (b.lastPlayedMs ?? 0) - (a.lastPlayedMs ?? 0))
}

export function getInstance(id: string): InstanceInfo | null {
  assertSafeId(id)
  return listInstances().find((i) => i.id === id) ?? null
}

export function createInstance(mcVersion: string, loader: string, name?: string): InstanceInfo {
  const displayName = name?.trim().slice(0, 40) || `${mcVersion} (${loader})`
  // Slug from the name so the folder is recognizable; suffix on collision so
  // "PvP" twice (or a second unnamed 1.21.11 fabric) still gets its own folder.
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9._]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || instanceKey(mcVersion, loader)
  let slug = base
  let n = 2
  while (existsSync(join(instancesRoot(), slug))) slug = `${base}-${n++}`

  const dir = ensureDir(join(instancesRoot(), slug))
  const meta: InstanceMeta = { name: displayName, mcVersion, loader }
  writeFileSync(metaPath(dir), JSON.stringify(meta, null, 2))
  return {
    id: slug,
    mcVersion,
    loader,
    name: displayName,
    modCount: 0,
    hasWorlds: false,
    lastPlayedMs: null
  }
}

export function renameInstance(id: string, name: string): void {
  const dir = instanceDirById(id)
  if (!existsSync(dir)) throw new Error(`No such instance: ${id}`)
  const meta = { ...readMeta(dir), name: name.trim().slice(0, 40) }
  writeFileSync(metaPath(dir), JSON.stringify(meta, null, 2))
}

/** Permanently deletes the instance folder — mods, worlds, configs, all of it. */
export function deleteInstance(id: string): void {
  const dir = instanceDirById(id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
