import { createWriteStream, existsSync, mkdirSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import { dirname } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

export interface DownloadSpec {
  url: string
  dest: string
  sha1?: string
  size?: number
}

export async function fileSha1(file: string): Promise<string> {
  return createHash('sha1').update(await readFile(file)).digest('hex')
}

/** Returns true if the file already on disk is valid and can be skipped. */
async function isValid(spec: DownloadSpec): Promise<boolean> {
  if (!existsSync(spec.dest)) return false
  if (spec.sha1) return (await fileSha1(spec.dest)) === spec.sha1
  if (spec.size) return statSync(spec.dest).size === spec.size
  return true
}

export async function downloadFile(spec: DownloadSpec): Promise<void> {
  if (await isValid(spec)) return
  mkdirSync(dirname(spec.dest), { recursive: true })
  const res = await fetch(spec.url)
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) ${spec.url}`)
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(spec.dest))
  if (spec.sha1) {
    const got = await fileSha1(spec.dest)
    if (got !== spec.sha1) throw new Error(`Checksum mismatch for ${spec.dest}`)
  }
}

/**
 * Download many files with a bounded worker pool, invoking `onProgress` after
 * each completes. Skips files that are already present and valid.
 */
export async function downloadAll(
  specs: DownloadSpec[],
  concurrency = 8,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  let next = 0
  let done = 0
  const total = specs.length
  const worker = async (): Promise<void> => {
    while (next < total) {
      const spec = specs[next++]
      await downloadFile(spec)
      done++
      onProgress?.(done, total)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total || 1) }, worker))
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) ${url}`)
  return (await res.json()) as T
}
