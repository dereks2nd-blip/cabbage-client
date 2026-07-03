import { spawn } from 'child_process'
import { delimiter, join } from 'path'
import { mkdirSync } from 'fs'
import { app } from 'electron'
import { paths, ensureDir, instanceDir } from './paths'
import { installVersion, type InstalledVersion } from './install'
import { installFabric } from './fabric'
import { ensureJavaRuntime } from './runtime'
import { offlineAccount, type Account } from './account'
import { loadAccount, ensureFreshAccount } from './auth'
import { applyThemePack } from './resourcepack'
import { ensureClientMod } from './clientmod'
import { readSettings } from './settings'
import { rulesAllow, type Rule } from './rules'

export interface LaunchOptions {
  versionId: string
  username: string
  ramMb?: number
  loader?: 'vanilla' | 'fabric'
}

export type LaunchEvent =
  | { type: 'stage'; stage: string; message: string; done?: number; total?: number }
  | { type: 'log'; line: string }
  | { type: 'started'; pid: number }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string }

type Emit = (e: LaunchEvent) => void

// The currently-running game process (one at a time — this is a launcher, not
// a server farm). Used by the Stop button.
let runningPid: number | null = null

export function isGameRunning(): boolean {
  return runningPid !== null
}

/**
 * Kill the running game. taskkill /T takes the whole tree — a crashed or hung
 * Minecraft can survive a plain child.kill() and keep mod jars locked.
 */
export function stopGame(): boolean {
  if (runningPid === null) return false
  spawn('taskkill', ['/F', '/T', '/PID', String(runningPid)])
  return true
}

interface RuleArg {
  rules?: Rule[]
  value: string | string[]
}

/** Flatten a modern `arguments` array, dropping rule-gated entries that don't apply. */
function flattenArgs(args: unknown[]): string[] {
  const out: string[] = []
  for (const a of args) {
    if (typeof a === 'string') {
      out.push(a)
    } else if (a && typeof a === 'object' && 'value' in a) {
      const ra = a as RuleArg
      if (rulesAllow(ra.rules)) {
        out.push(...(Array.isArray(ra.value) ? ra.value : [ra.value]))
      }
    }
  }
  return out
}

function substitute(args: string[], vars: Record<string, string>): string[] {
  return args.map((arg) => arg.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? `\${${k}}`))
}

/**
 * Aikar-derived G1GC flags — sane defaults that keep frame times smooth. The
 * heavy FPS wins still come from Sodium/Lithium (a later milestone); these
 * just stop the JVM from stuttering under GC.
 */
function performanceFlags(ramMb: number): string[] {
  return [
    `-Xmx${ramMb}M`,
    `-Xms${Math.min(ramMb, 2048)}M`,
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+UseG1GC',
    '-XX:G1NewSizePercent=20',
    '-XX:G1ReservePercent=20',
    '-XX:MaxGCPauseMillis=50',
    '-XX:G1HeapRegionSize=32M',
    '-Dfile.encoding=UTF-8'
  ]
}

function buildArgs(
  installed: InstalledVersion,
  opts: LaunchOptions,
  account: Account,
  gameDir: string,
  javaSep: string
): string[] {
  const { json } = installed
  ensureDir(installed.nativesDir)

  const vars: Record<string, string> = {
    auth_player_name: account.username,
    version_name: json.id,
    game_directory: gameDir,
    assets_root: installed.assetsRoot,
    game_assets: installed.assetsRoot,
    assets_index_name: installed.assetIndexId,
    auth_uuid: account.uuid,
    auth_access_token: account.accessToken,
    clientid: '',
    auth_xuid: '',
    user_type: account.userType,
    version_type: 'release',
    natives_directory: installed.nativesDir,
    launcher_name: 'CabbageClient',
    launcher_version: app.getVersion(),
    library_directory: paths.libraries(),
    classpath_separator: javaSep,
    classpath: installed.classpath.join(javaSep)
  }

  const jvmRaw = json.arguments?.jvm
    ? flattenArgs(json.arguments.jvm)
    : ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}']

  const gameRaw = json.arguments?.game
    ? flattenArgs(json.arguments.game)
    : (json.minecraftArguments ?? '').split(' ').filter(Boolean)

  const ramMb = readSettings().ramMb ?? opts.ramMb ?? 4096
  return [
    ...substitute(jvmRaw, vars),
    ...performanceFlags(ramMb),
    json.mainClass,
    ...substitute(gameRaw, vars)
  ]
}

/** Use the signed-in Microsoft account (refreshed) if there is one, else offline. */
async function resolveAccount(username: string, emit: Emit): Promise<Account> {
  const saved = loadAccount()
  if (saved) {
    try {
      const fresh = await ensureFreshAccount(saved)
      return { username: fresh.name, uuid: fresh.uuid, accessToken: fresh.accessToken, userType: 'msa' }
    } catch (err) {
      emit({
        type: 'log',
        line: `[cabbage] Microsoft session unusable (${err instanceof Error ? err.message : err}); using offline mode.`
      })
    }
  }
  return offlineAccount(username)
}

/**
 * Full launch flow: ensure Java, install the version, build the command line
 * and spawn the game. Resolves once the process has started; further progress
 * (logs, exit) arrives through `emit`.
 */
export async function launchGame(opts: LaunchOptions, emit: Emit): Promise<void> {
  try {
    const account = await resolveAccount(opts.username, emit)
    const loader = opts.loader ?? 'vanilla'
    const gameDir = ensureDir(instanceDir(opts.versionId, loader))
    const modsDir = ensureDir(join(gameDir, 'mods'))
    // Cabbage's own HUD mod, for matching-version Fabric instances only.
    ensureClientMod(modsDir, opts.versionId, loader)

    let versionId = opts.versionId
    if (loader === 'fabric') {
      emit({ type: 'stage', stage: 'fabric', message: 'Installing Fabric loader…' })
      versionId = await installFabric(opts.versionId)
    }

    emit({ type: 'stage', stage: 'install', message: `Preparing ${versionId}…` })
    const installed = await installVersion(versionId, (stage, done, total) => {
      emit({ type: 'stage', stage, message: stageLabel(stage), done, total })
    })

    emit({ type: 'stage', stage: 'java', message: 'Checking Java runtime…' })
    const javaPath = await ensureJavaRuntime(installed.javaComponent, (done, total) =>
      emit({ type: 'stage', stage: 'java', message: 'Downloading Java…', done, total })
    )

    const ramMb = readSettings().ramMb ?? opts.ramMb ?? 4096
    emit({ type: 'log', line: `[cabbage] instance=${loader}/${opts.versionId}  RAM=${ramMb}MB (-Xmx${ramMb}M)` })

    const args = buildArgs(installed, opts, account, gameDir, delimiter)
    mkdirSync(gameDir, { recursive: true })

    // Cabbage's tennis-bird title screen. Non-fatal if anything goes sideways.
    try {
      applyThemePack(gameDir, opts.versionId)
    } catch (err) {
      emit({ type: 'log', line: `[cabbage] theme pack skipped: ${err instanceof Error ? err.message : err}` })
    }

    emit({ type: 'stage', stage: 'launching', message: 'Starting Minecraft…' })
    const child = spawn(javaPath, args, { cwd: gameDir })

    child.on('error', (err) => emit({ type: 'error', message: err.message }))
    child.stdout?.on('data', (d: Buffer) => emit({ type: 'log', line: d.toString() }))
    child.stderr?.on('data', (d: Buffer) => emit({ type: 'log', line: d.toString() }))
    child.on('exit', (code) => {
      runningPid = null
      emit({ type: 'exit', code })
    })

    if (child.pid) {
      runningPid = child.pid
      emit({ type: 'started', pid: child.pid })
    }
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'client':
      return 'Downloading game client…'
    case 'libraries':
      return 'Downloading libraries…'
    case 'assets':
      return 'Downloading assets…'
    default:
      return 'Working…'
  }
}
