const VERSION_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

export interface VersionSummary {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  releaseTime: string
}

interface ManifestResponse {
  latest: { release: string; snapshot: string }
  versions: VersionSummary[]
}

let cache: { at: number; data: ManifestResponse } | undefined
const CACHE_MS = 5 * 60 * 1000

async function fetchManifest(): Promise<ManifestResponse> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data
  const res = await fetch(VERSION_MANIFEST)
  if (!res.ok) throw new Error(`Version manifest fetch failed: ${res.status}`)
  const data = (await res.json()) as ManifestResponse
  cache = { at: Date.now(), data }
  return data
}

/**
 * Returns release versions newest-first, plus the latest release/snapshot ids.
 * Snapshots are intentionally excluded from the default list to keep things
 * simple for the first milestone.
 */
export async function listInstallableVersions(): Promise<{
  latestRelease: string
  versions: VersionSummary[]
}> {
  const manifest = await fetchManifest()
  const versions = manifest.versions.filter((v) => v.type === 'release')
  return { latestRelease: manifest.latest.release, versions }
}

export async function findVersion(id: string): Promise<VersionSummary | undefined> {
  const manifest = await fetchManifest()
  return manifest.versions.find((v) => v.id === id)
}
