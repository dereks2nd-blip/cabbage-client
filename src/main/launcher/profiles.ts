import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { dataRoot, ensureDir } from './paths'
import {
  clearMods,
  installMods,
  listInstalledMods,
  readManifest,
  reconcileManifest,
  resolveProjects,
  type InstallResult
} from './modrinth'

/**
 * Mod profiles: named, version-agnostic mod loadouts ("PvP", "Max FPS", ...).
 * A profile stores Modrinth PROJECT ids, not jar files — applying one to any
 * instance resolves the right build for that Minecraft version through the
 * normal installer (with dependency resolution). Profiles live globally in
 * dataRoot so one loadout can be applied to every version.
 */

export interface ProfileMod {
  projectId: string
  title: string
}

export interface Profile {
  name: string
  mods: ProfileMod[]
  updatedAt: string
}

function profilesPath(): string {
  return join(dataRoot(), 'cabbage-profiles.json')
}

export function listProfiles(): Profile[] {
  try {
    return JSON.parse(readFileSync(profilesPath(), 'utf8')) as Profile[]
  } catch {
    return []
  }
}

function writeProfiles(profiles: Profile[]): void {
  ensureDir(dataRoot())
  writeFileSync(profilesPath(), JSON.stringify(profiles, null, 2))
}

export interface SaveProfileResult {
  profile: Profile
  /** Jars in the instance that Modrinth didn't install (not captured). */
  unmanaged: string[]
}

/**
 * Snapshot the given instance's Modrinth-installed mods as a named profile.
 * Manually-dropped jars can't be re-resolved from Modrinth, so they're
 * reported back instead of silently captured. The bundled cabbage-hud.jar is
 * excluded — the launcher re-installs it on every launch anyway.
 */
export async function saveProfile(name: string, modsDir: string): Promise<SaveProfileResult> {
  const trimmed = name.trim().slice(0, 40)
  if (!trimmed) throw new Error('Profile name is empty.')

  // Adopt manually-dropped jars into the manifest via sha1 lookup first, so
  // instances assembled outside the Mods tab can still be saved as profiles.
  try {
    await reconcileManifest(modsDir, ['cabbage-hud.jar'])
  } catch {
    /* offline / API hiccup — save whatever the manifest already has */
  }
  const entries = readManifest(modsDir)
  if (entries.length === 0) throw new Error('No Modrinth-installed mods to save for this version.')

  let infos: Awaited<ReturnType<typeof resolveProjects>> = []
  try {
    infos = await resolveProjects(entries.map((e) => e.projectId))
  } catch {
    /* offline — fall back to jar filenames below */
  }

  // Manifests can name one project both by slug and by id (preset packs use
  // slugs, dependency resolution uses ids) — dedupe on the canonical id.
  const mods: ProfileMod[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const info = infos.find((p) => p.id === e.projectId || p.slug === e.projectId)
    const canonical = info?.id ?? e.projectId
    if (seen.has(canonical)) continue
    seen.add(canonical)
    mods.push({ projectId: canonical, title: info?.title ?? e.filename.replace(/\.jar$/i, '') })
  }

  const manifestFiles = new Set(entries.map((e) => e.filename))
  const unmanaged = listInstalledMods(modsDir).filter(
    (f) => !manifestFiles.has(f) && f !== 'cabbage-hud.jar'
  )

  const profile: Profile = { name: trimmed, mods, updatedAt: new Date().toISOString() }
  const others = listProfiles().filter((p) => p.name.toLowerCase() !== trimmed.toLowerCase())
  writeProfiles([...others, profile].sort((a, b) => a.name.localeCompare(b.name)))
  return { profile, unmanaged }
}

/**
 * Replace an instance's mods with a profile's loadout. Clears the mods folder
 * first so leftovers from the previous set can't conflict. Mods without a
 * build for the target version come back as warnings, not errors.
 */
export async function applyProfile(
  name: string,
  gameVersion: string,
  loader: string,
  modsDir: string
): Promise<InstallResult> {
  const profile = listProfiles().find((p) => p.name === name)
  if (!profile) throw new Error(`No such profile: ${name}`)
  clearMods(modsDir)
  return installMods(
    profile.mods.map((m) => m.projectId),
    gameVersion,
    loader,
    modsDir
  )
}

export function deleteProfile(name: string): void {
  writeProfiles(listProfiles().filter((p) => p.name !== name))
}
