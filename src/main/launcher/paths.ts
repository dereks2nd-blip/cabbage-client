import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

/**
 * All Cabbage Client game data lives in a self-contained directory so we never
 * touch a user's existing vanilla `.minecraft`. Layout mirrors the vanilla one
 * (versions/, libraries/, assets/) so standard Minecraft tooling stays happy.
 *
 * IMPORTANT: root under `home` (C:\Users\<user>), NOT appData. Two reasons:
 * (1) No spaces — Fabric's classpath/game-jar detection breaks on spaces.
 * (2) This app's appData is redirected by an MSIX-style sandbox to a
 *     ...\Packages\...\LocalCache\Roaming\... location, so the path string we'd
 *     hand Java wouldn't match Java's own canonicalized code-source path — and
 *     Fabric then loads its loader/Mixin API in two classloaders, making every
 *     mod fail with "cannot be cast to PreLaunchEntrypoint". `home` isn't
 *     redirected, so the paths match and mods load.
 */
export function dataRoot(): string {
  return join(app.getPath('home'), 'CabbageClient', 'minecraft')
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true })
  return dir
}

export const paths = {
  root: dataRoot,
  versions: () => join(dataRoot(), 'versions'),
  libraries: () => join(dataRoot(), 'libraries'),
  assets: () => join(dataRoot(), 'assets'),
  assetIndexes: () => join(dataRoot(), 'assets', 'indexes'),
  assetObjects: () => join(dataRoot(), 'assets', 'objects'),
  runtimes: () => join(dataRoot(), 'runtimes'),
  natives: () => join(dataRoot(), 'natives'),
  mods: () => join(dataRoot(), 'mods')
}

/** A filesystem-safe instance key, e.g. "26.2-fabric" or "1.8.9-vanilla". */
export function instanceKey(mcVersion: string, loader: string): string {
  return `${mcVersion.replace(/[^a-zA-Z0-9._-]/g, '_')}-${loader}`
}

/**
 * Per-instance game directory. Global assets/libraries/versions/runtimes stay
 * shared (they're content-addressed), but each version+loader gets its own
 * mods/, saves/, config/, options.txt — so a 26.2 modset can't break 1.8.9.
 */
export function instanceDir(mcVersion: string, loader: string): string {
  return join(dataRoot(), 'instances', instanceKey(mcVersion, loader))
}

export function instanceMods(mcVersion: string, loader: string): string {
  return join(instanceDir(mcVersion, loader), 'mods')
}
