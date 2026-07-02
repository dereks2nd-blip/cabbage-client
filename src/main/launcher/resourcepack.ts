import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, cpSync } from 'fs'
import AdmZip from 'adm-zip'
import { ensureDir, paths } from './paths'

const PACK_NAME = 'CabbageTennisPack'

/** Read the resource-pack format the given MC version expects (from its client jar). */
function resourceFormat(mcVersion: string): number {
  try {
    const entry = new AdmZip(join(paths.versions(), mcVersion, `${mcVersion}.jar`)).getEntry('version.json')
    if (entry) {
      const j = JSON.parse(entry.getData().toString('utf8')) as {
        pack_version?: { resource_major?: number; resource?: number }
      }
      return j.pack_version?.resource_major ?? j.pack_version?.resource ?? 88
    }
  } catch {
    /* fall through */
  }
  return 88
}

/** Write pack.mcmeta with a format compatible with the target MC version. */
function writeMcmeta(packDir: string, mcVersion: string): void {
  const major = resourceFormat(mcVersion)
  writeFileSync(
    join(packDir, 'pack.mcmeta'),
    JSON.stringify(
      {
        pack: {
          description: '§aCabbage Client §7— tennis bird theme',
          pack_format: major,
          min_format: [major, 0],
          max_format: [major, 2147483647]
        }
      },
      null,
      2
    )
  )
}

/** Where the bundled pack lives (repo in dev, resources dir when packaged). */
function packSource(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resourcepack')
    : join(app.getAppPath(), 'resources', 'resourcepack')
}

/**
 * Copy the tennis-bird pack into the game's resourcepacks folder and switch it
 * on in options.txt, so the custom title screen shows without the user having to
 * enable it manually. Best-effort — never blocks a launch.
 */
export function applyThemePack(gameDir: string, mcVersion: string): void {
  const src = packSource()
  if (!existsSync(src)) return

  const dest = join(ensureDir(join(gameDir, 'resourcepacks')), PACK_NAME)
  cpSync(src, dest, { recursive: true })
  writeMcmeta(dest, mcVersion)

  enableInOptions(gameDir, `file/${PACK_NAME}`)
}

function enableInOptions(gameDir: string, entry: string): void {
  const file = join(gameDir, 'options.txt')

  if (!existsSync(file)) {
    writeFileSync(file, `resourcePacks:["vanilla","${entry}"]\n`)
    return
  }

  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  let sawResourcePacks = false

  const next = lines.map((line) => {
    if (line.startsWith('resourcePacks:')) {
      sawResourcePacks = true
      return `resourcePacks:${withEntry(line.slice('resourcePacks:'.length), entry)}`
    }
    if (line.startsWith('incompatibleResourcePacks:')) {
      // Make sure our pack isn't parked in the "incompatible" list.
      return `incompatibleResourcePacks:${withoutEntry(line.slice('incompatibleResourcePacks:'.length), entry)}`
    }
    return line
  })

  if (!sawResourcePacks) next.push(`resourcePacks:["vanilla","${entry}"]`)
  writeFileSync(file, next.join('\n'))
}

function parseList(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? (arr as string[]) : []
  } catch {
    return []
  }
}

function withEntry(raw: string, entry: string): string {
  const list = parseList(raw)
  if (!list.includes(entry)) list.push(entry)
  return JSON.stringify(list)
}

function withoutEntry(raw: string, entry: string): string {
  return JSON.stringify(parseList(raw).filter((e) => e !== entry))
}
