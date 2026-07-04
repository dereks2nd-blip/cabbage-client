import { app } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync } from 'fs'
import { ensureDir } from './paths'

/**
 * Cabbage's own in-game HUD mod (keystrokes/FPS/coords/armor + editor + ESP).
 * A Fabric mod is compiled per Minecraft version, so resources/mods holds one
 * jar per supported version (built from mod/ — `gradle build -PmcVer=<v>`).
 * Instances of other versions get nothing (Fabric's dependency check would
 * reject a mismatched jar anyway).
 */
export const HUD_VERSIONS = [
  '1.21.11',
  '1.21.9',
  '1.21.5',
  '1.21.4',
  '1.21.1',
  '1.20.4',
  '1.20.2',
  '1.20.1'
]
const HUD_FILENAME = 'cabbage-hud.jar'

function bundledHud(mcVersion: string): string {
  const file = `cabbage-hud-${mcVersion}.jar`
  return app.isPackaged
    ? join(process.resourcesPath, 'mods', file)
    : join(app.getAppPath(), 'resources', 'mods', file)
}

/**
 * Ensure the Cabbage HUD is present in a Fabric instance of a supported
 * Minecraft version. No-op for other versions/loaders. Best-effort.
 */
export function ensureClientMod(modsDir: string, mcVersion: string, loader: string): void {
  if (loader !== 'fabric' || !HUD_VERSIONS.includes(mcVersion)) return
  const src = bundledHud(mcVersion)
  if (!existsSync(src)) return
  const dest = join(ensureDir(modsDir), HUD_FILENAME)
  try {
    copyFileSync(src, dest)
  } catch {
    /* non-fatal */
  }
}
