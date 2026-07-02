import { join } from 'path'
import { createHash } from 'crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { ensureDir } from './paths'
import { downloadFile } from './download'

const API = 'https://api.modrinth.com/v2'
const UA = 'cabbage-client/0.1 (personal launcher; github.com/derek)'

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Modrinth ${res.status}: ${path}`)
  return (await res.json()) as T
}

export interface ModHit {
  projectId: string
  slug: string
  title: string
  description: string
  author: string
  downloads: number
  iconUrl: string | null
  categories: string[]
}

interface SearchResponse {
  hits: Array<{
    project_id: string
    slug: string
    title: string
    description: string
    author: string
    downloads: number
    icon_url: string | null
    display_categories?: string[]
  }>
}

/** Search Modrinth for mods compatible with a Minecraft version + loader. */
export async function searchMods(
  query: string,
  gameVersion: string,
  loader = 'fabric',
  limit = 30
): Promise<ModHit[]> {
  const facets = JSON.stringify([
    ['project_type:mod'],
    [`categories:${loader}`],
    [`versions:${gameVersion}`]
  ])
  const params = new URLSearchParams({ query, limit: String(limit), index: 'relevance', facets })
  const data = await api<SearchResponse>(`/search?${params.toString()}`)
  return data.hits.map((h) => ({
    projectId: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    author: h.author,
    downloads: h.downloads,
    iconUrl: h.icon_url,
    categories: h.display_categories ?? []
  }))
}

interface Dependency {
  project_id?: string
  version_id?: string
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded'
}

interface ProjectVersion {
  id: string
  name: string
  files: Array<{ url: string; filename: string; primary: boolean; size: number; hashes: { sha1?: string } }>
  dependencies?: Dependency[]
}

// --- installed-mods manifest (maps a Modrinth project to the jar we saved) ---

export interface ManifestEntry {
  projectId: string
  filename: string
}

function manifestPath(modsDir: string): string {
  return join(modsDir, 'cabbage-manifest.json')
}

export function readManifest(modsDir: string): ManifestEntry[] {
  try {
    return JSON.parse(readFileSync(manifestPath(modsDir), 'utf8')) as ManifestEntry[]
  } catch {
    return []
  }
}

function writeManifest(modsDir: string, entries: ManifestEntry[]): void {
  ensureDir(modsDir)
  writeFileSync(manifestPath(modsDir), JSON.stringify(entries, null, 2))
}

function recordInstall(modsDir: string, projectId: string, filename: string): void {
  const entries = readManifest(modsDir).filter((e) => e.projectId !== projectId)
  entries.push({ projectId, filename })
  writeManifest(modsDir, entries)
}

export interface ProjectInfo {
  id: string
  slug: string
  title: string
}

/**
 * Bulk-resolve projects by id OR slug (manifests contain both: preset packs
 * install by slug, dependency resolution by id). Returns canonical ids so
 * callers can dedupe entries that name the same project two ways.
 */
export async function resolveProjects(idsOrSlugs: string[]): Promise<ProjectInfo[]> {
  if (idsOrSlugs.length === 0) return []
  const ids = encodeURIComponent(JSON.stringify(idsOrSlugs))
  return api<ProjectInfo[]>(`/projects?ids=${ids}`)
}

/**
 * Match jars that Modrinth didn't install (manually dropped in) to their
 * Modrinth projects by sha1 and record them in the manifest, so profile saves
 * capture them. Jars unknown to Modrinth are left alone.
 */
export async function reconcileManifest(modsDir: string, exclude: string[] = []): Promise<void> {
  const entries = readManifest(modsDir)
  const known = new Set(entries.map((e) => e.filename))
  const candidates = listInstalledMods(modsDir).filter(
    (f) => !known.has(f) && !exclude.includes(f)
  )
  if (candidates.length === 0) return

  const byHash: Record<string, string> = {}
  for (const f of candidates) {
    const hash = createHash('sha1').update(readFileSync(join(modsDir, f))).digest('hex')
    byHash[hash] = f
  }
  const res = await fetch(`${API}/version_files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ hashes: Object.keys(byHash), algorithm: 'sha1' })
  })
  if (!res.ok) throw new Error(`Modrinth ${res.status}: version_files`)
  const matches = (await res.json()) as Record<string, { project_id: string }>

  for (const [hash, version] of Object.entries(matches)) {
    const filename = byHash[hash]
    if (filename && !entries.some((e) => e.projectId === version.project_id)) {
      entries.push({ projectId: version.project_id, filename })
    }
  }
  writeManifest(modsDir, entries)
}

async function pickVersion(
  projectId: string,
  gameVersion: string,
  loader: string
): Promise<ProjectVersion | undefined> {
  const gv = encodeURIComponent(JSON.stringify([gameVersion]))
  const ld = encodeURIComponent(JSON.stringify([loader]))
  const versions = await api<ProjectVersion[]>(
    `/project/${projectId}/version?game_versions=${gv}&loaders=${ld}`
  )
  return versions[0]
}

export interface InstallResult {
  installed: string[]
  warnings: string[]
}

/**
 * Install a mod and, recursively, all of its REQUIRED dependencies (fabric-api,
 * config libs, etc.). Replaces any existing jar from the same project so we
 * never leave two versions of one mod behind. Dependency failures are collected
 * as warnings rather than aborting the whole install.
 */
export async function installMod(
  projectId: string,
  gameVersion: string,
  loader: string,
  modsDir: string,
  ctx: { seen: Set<string>; result: InstallResult } = { seen: new Set(), result: { installed: [], warnings: [] } }
): Promise<InstallResult> {
  if (ctx.seen.has(projectId)) return ctx.result
  ctx.seen.add(projectId)

  const version = await pickVersion(projectId, gameVersion, loader)
  if (!version) {
    ctx.result.warnings.push(`No ${loader} build for ${gameVersion}: ${projectId}`)
    return ctx.result
  }

  const file = version.files.find((f) => f.primary) ?? version.files[0]
  if (!file) {
    ctx.result.warnings.push(`No downloadable file: ${projectId}`)
    return ctx.result
  }

  // Replace any older jar we previously installed for this project.
  const prior = readManifest(modsDir).find((e) => e.projectId === projectId)
  if (prior && prior.filename !== file.filename) {
    const oldPath = join(modsDir, prior.filename)
    if (existsSync(oldPath)) {
      try {
        unlinkSync(oldPath)
      } catch {
        /* ignore */
      }
    }
  }

  const dest = join(ensureDir(modsDir), file.filename)
  await downloadFile({ url: file.url, dest, sha1: file.hashes.sha1, size: file.size })
  recordInstall(modsDir, projectId, file.filename)
  ctx.result.installed.push(file.filename)

  for (const dep of version.dependencies ?? []) {
    if (dep.dependency_type === 'required' && dep.project_id) {
      await installMod(dep.project_id, gameVersion, loader, modsDir, ctx)
    }
  }
  return ctx.result
}

/** Install several projects (and their deps) in one pass, sharing dedup state. */
export async function installMods(
  projectIds: string[],
  gameVersion: string,
  loader: string,
  modsDir: string
): Promise<InstallResult> {
  const ctx = { seen: new Set<string>(), result: { installed: [], warnings: [] } as InstallResult }
  for (const id of projectIds) await installMod(id, gameVersion, loader, modsDir, ctx)
  return ctx.result
}

// The "Max-FPS" stack (all verified to have 26.2 builds). Sodium is the base;
// the rest stack on top for tick, memory, render and culling wins.
export const PERFORMANCE_PACK = [
  'sodium',
  'lithium',
  'ferrite-core',
  'immediatelyfast',
  'entityculling',
  'moreculling',
  'sodium-extra'
]

export function installPerformancePack(
  gameVersion: string,
  loader: string,
  modsDir: string
): Promise<InstallResult> {
  return installMods(PERFORMANCE_PACK, gameVersion, loader, modsDir)
}

/** Filenames currently present in the given instance's mods folder. */
export function listInstalledMods(modsDir: string): string[] {
  if (!existsSync(modsDir)) return []
  return readdirSync(modsDir).filter((f) => f.toLowerCase().endsWith('.jar'))
}

/** Delete a single mod jar (and its manifest entry, if any). */
export function removeMod(modsDir: string, filename: string): void {
  const f = join(modsDir, filename)
  if (existsSync(f)) unlinkSync(f)
  writeManifest(modsDir, readManifest(modsDir).filter((e) => e.filename !== filename))
}

/** Delete every mod jar in an instance and reset its manifest. */
export function clearMods(modsDir: string): void {
  for (const f of listInstalledMods(modsDir)) {
    try {
      unlinkSync(join(modsDir, f))
    } catch {
      /* ignore */
    }
  }
  writeManifest(modsDir, [])
}
