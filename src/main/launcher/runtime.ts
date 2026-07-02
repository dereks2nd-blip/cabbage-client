import { join } from 'path'
import { existsSync } from 'fs'
import { chmod } from 'fs/promises'
import { paths, ensureDir } from './paths'
import { downloadAll, fetchJson, type DownloadSpec } from './download'

const RUNTIME_MANIFEST =
  'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

interface RuntimeFile {
  type: 'file' | 'directory' | 'link'
  executable?: boolean
  downloads?: { raw: { url: string; sha1: string; size: number } }
}

interface RuntimeManifest {
  files: Record<string, RuntimeFile>
}

type AllRuntimes = Record<
  string,
  Record<string, Array<{ manifest: { url: string; sha1: string; size: number } }>>
>

/** Maps the current platform/arch to Mojang's runtime manifest OS key. */
function osKey(): string {
  if (process.platform === 'win32') {
    if (process.arch === 'arm64') return 'windows-arm64'
    if (process.arch === 'ia32') return 'windows-x86'
    return 'windows-x64'
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
  }
  return process.arch === 'ia32' ? 'linux-i386' : 'linux'
}

/** Path to the `java` executable inside a downloaded runtime component. */
export function javaExeFor(component: string): string {
  const base = join(paths.runtimes(), component)
  if (process.platform === 'win32') return join(base, 'bin', 'java.exe')
  if (process.platform === 'darwin') return join(base, 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
  return join(base, 'bin', 'java')
}

/**
 * Ensure the given Mojang Java runtime component (e.g. `java-runtime-delta`) is
 * installed, downloading it if necessary. Returns the path to its `java` binary.
 */
export async function ensureJavaRuntime(
  component: string,
  onProgress?: (done: number, total: number) => void
): Promise<string> {
  const exe = javaExeFor(component)
  if (existsSync(exe)) return exe

  const all = await fetchJson<AllRuntimes>(RUNTIME_MANIFEST)
  const entry = all[osKey()]?.[component]?.[0]
  if (!entry) {
    throw new Error(`No Java runtime "${component}" available for ${osKey()}`)
  }

  const manifest = await fetchJson<RuntimeManifest>(entry.manifest.url)
  const targetRoot = ensureDir(join(paths.runtimes(), component))

  const specs: DownloadSpec[] = []
  const toMarkExecutable: string[] = []
  for (const [rel, file] of Object.entries(manifest.files)) {
    if (file.type !== 'file' || !file.downloads) continue
    const dest = join(targetRoot, rel)
    specs.push({ url: file.downloads.raw.url, dest, sha1: file.downloads.raw.sha1, size: file.downloads.raw.size })
    if (file.executable) toMarkExecutable.push(dest)
  }

  await downloadAll(specs, 8, onProgress)

  if (process.platform !== 'win32') {
    await Promise.all(toMarkExecutable.map((f) => chmod(f, 0o755).catch(() => undefined)))
  }
  return exe
}
