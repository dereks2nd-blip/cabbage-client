import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join, delimiter } from 'path'

const execFileAsync = promisify(execFile)

export interface JavaInfo {
  found: boolean
  path?: string
  /** Major version number, e.g. 17 or 21. */
  major?: number
  versionString?: string
  source?: 'managed' | 'JAVA_HOME' | 'PATH'
}

const javaBinName = process.platform === 'win32' ? 'java.exe' : 'java'

/**
 * Run `java -version` and parse the major version out of stderr (where the JVM
 * prints it). Returns undefined if the binary can't be executed.
 */
async function probe(javaPath: string): Promise<{ major: number; versionString: string } | undefined> {
  try {
    const { stderr } = await execFileAsync(javaPath, ['-version'])
    const match = stderr.match(/version "(\d+)(?:\.(\d+))?[^"]*"/)
    if (!match) return undefined
    // Pre-9 JDKs report 1.8.x; map that to major 8.
    const first = Number(match[1])
    const major = first === 1 && match[2] ? Number(match[2]) : first
    const versionString = (stderr.match(/version "([^"]+)"/) ?? [, ''])[1] ?? ''
    return { major, versionString }
  } catch {
    return undefined
  }
}

function candidatesFromPath(): string[] {
  const entries = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  return entries.map((dir) => join(dir, javaBinName)).filter((p) => existsSync(p))
}

/**
 * Locate a usable Java runtime, preferring a JDK we manage, then JAVA_HOME,
 * then anything on PATH. The first milestone only needs detection; if nothing
 * is found the launcher will offer to download a Mojang-provided runtime.
 */
export async function detectJava(): Promise<JavaInfo> {
  const checks: Array<{ path: string; source: JavaInfo['source'] }> = []

  if (process.env.JAVA_HOME) {
    checks.push({ path: join(process.env.JAVA_HOME, 'bin', javaBinName), source: 'JAVA_HOME' })
  }
  for (const p of candidatesFromPath()) {
    checks.push({ path: p, source: 'PATH' })
  }

  for (const c of checks) {
    if (!existsSync(c.path)) continue
    const info = await probe(c.path)
    if (info) {
      return { found: true, path: c.path, major: info.major, versionString: info.versionString, source: c.source }
    }
  }

  return { found: false }
}
