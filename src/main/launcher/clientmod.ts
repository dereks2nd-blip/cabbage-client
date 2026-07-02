import { app } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync } from 'fs'
import { ensureDir } from './paths'

/**
 * Cabbage's own in-game HUD mod (keystrokes/FPS/coords/armor + editor). It's a
 * real Fabric mod compiled for a specific Minecraft version, so we only drop it
 * into instances of that version — installing it into any other version's
 * instance would fail Fabric's dependency check.
 */
const HUD_TARGET_VERSION = '1.21.11'
const HUD_FILENAME = 'cabbage-hud.jar'

function bundledHud(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'mods', HUD_FILENAME)
    : join(app.getAppPath(), 'resources', 'mods', HUD_FILENAME)
}

/**
 * Ensure the Cabbage HUD is present in a Fabric instance whose Minecraft version
 * matches the build target. No-op for other versions/loaders. Best-effort.
 */
export function ensureClientMod(modsDir: string, mcVersion: string, loader: string): void {
  if (loader !== 'fabric' || mcVersion !== HUD_TARGET_VERSION) return
  const src = bundledHud()
  if (!existsSync(src)) return
  const dest = join(ensureDir(modsDir), HUD_FILENAME)
  try {
    copyFileSync(src, dest)
  } catch {
    /* non-fatal */
  }
}
