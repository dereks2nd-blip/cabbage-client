import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { dataRoot, ensureDir } from './paths'

export interface Settings {
  msClientId?: string
  ramMb?: number
}

function settingsFile(): string {
  return join(dataRoot(), 'cabbage-settings.json')
}

export function readSettings(): Settings {
  try {
    return JSON.parse(readFileSync(settingsFile(), 'utf8')) as Settings
  } catch {
    return {}
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch }
  ensureDir(dataRoot())
  writeFileSync(settingsFile(), JSON.stringify(next, null, 2))
  return next
}
