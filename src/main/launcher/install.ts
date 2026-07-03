import { join, dirname } from 'path'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import AdmZip from 'adm-zip'
import { paths } from './paths'
import { findVersion } from './versions'
import { downloadFile, downloadAll, fetchJson, type DownloadSpec } from './download'
import { rulesAllow, currentOsName, type Rule } from './rules'

const RESOURCES = 'https://resources.download.minecraft.net'

interface Artifact {
  path: string
  url: string
  sha1?: string
  size?: number
}

export interface Library {
  name: string
  url?: string // Maven base URL (Fabric-style libraries)
  sha1?: string
  rules?: Rule[]
  downloads?: { artifact?: Artifact; classifiers?: Record<string, Artifact> }
  natives?: Record<string, string>
  extract?: { exclude?: string[] }
}

type NativeJar = DownloadSpec & { exclude?: string[] }

/**
 * Extract native libraries (.dll/.so/.dylib) from old-style natives jars into
 * the version's natives dir. Pre-1.19 Minecraft ships natives this way and LWJGL
 * loads them from `-Djava.library.path`, not the classpath — so without this,
 * older versions crash on startup.
 */
function extractNatives(jars: NativeJar[], nativesDir: string): void {
  mkdirSync(nativesDir, { recursive: true })
  for (const jar of jars) {
    if (!existsSync(jar.dest)) continue
    for (const entry of new AdmZip(jar.dest).getEntries()) {
      if (entry.isDirectory) continue
      const name = entry.entryName
      if (name.startsWith('META-INF/')) continue
      if (jar.exclude?.some((ex) => name.startsWith(ex))) continue
      const out = join(nativesDir, name)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, entry.getData())
    }
  }
}

export interface VersionJson {
  id: string
  inheritsFrom?: string
  mainClass: string
  assets?: string
  assetIndex?: { id: string; url: string; sha1: string; size: number }
  downloads?: { client?: { url: string; sha1: string; size: number } }
  libraries: Library[]
  javaVersion?: { component: string; majorVersion: number }
  arguments?: { game?: unknown[]; jvm?: unknown[] }
  minecraftArguments?: string
}

interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>
}

export interface InstalledVersion {
  json: VersionJson
  clientJar: string
  classpath: string[]
  assetsRoot: string
  assetIndexId: string
  nativesDir: string
  javaComponent: string
}

type ProgressFn = (stage: string, done: number, total: number) => void

/** Load a version JSON: prefer a locally-saved one (Fabric), else Mojang's manifest. */
async function getRawVersionJson(id: string): Promise<VersionJson> {
  const local = join(paths.versions(), id, `${id}.json`)
  if (existsSync(local)) return JSON.parse(await readFile(local, 'utf8')) as VersionJson

  const summary = await findVersion(id)
  if (!summary) throw new Error(`Unknown Minecraft version: ${id}`)
  const json = await fetchJson<VersionJson>(summary.url)
  await mkdir(join(paths.versions(), id), { recursive: true })
  await writeFile(local, JSON.stringify(json))
  return json
}

/** Merge a child (e.g. Fabric) version onto its parent, vanilla bits winning where the child lacks them. */
function mergeVersions(parent: VersionJson, child: VersionJson): VersionJson {
  return {
    ...parent,
    ...child,
    id: child.id,
    mainClass: child.mainClass ?? parent.mainClass,
    libraries: [...(child.libraries ?? []), ...(parent.libraries ?? [])],
    assetIndex: parent.assetIndex,
    assets: parent.assets,
    downloads: parent.downloads,
    javaVersion: parent.javaVersion,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    arguments: {
      game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
      jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])]
    }
  }
}

/** Resolve a version id to a fully-merged JSON, following `inheritsFrom`. */
async function resolveVersion(id: string): Promise<{ json: VersionJson; jarId: string }> {
  const raw = await getRawVersionJson(id)
  if (!raw.inheritsFrom) return { json: raw, jarId: raw.id }
  const parent = await resolveVersion(raw.inheritsFrom)
  return { json: mergeVersions(parent.json, raw), jarId: parent.jarId }
}

/** Turn a Maven coordinate ("group:artifact:version[:classifier]") into a download spec. */
function mavenToArtifact(name: string, baseUrl: string): Artifact {
  const [group, artifact, version, classifier] = name.split(':')
  const file = `${artifact}-${version}${classifier ? `-${classifier}` : ''}.jar`
  const path = `${group.replace(/\./g, '/')}/${artifact}/${version}/${file}`
  return { path, url: baseUrl.replace(/\/$/, '') + '/' + path }
}

function libPath(artifact: Artifact): string {
  return join(paths.libraries(), ...artifact.path.split('/'))
}

/**
 * Download everything needed to run a version (resolving Fabric inheritance,
 * client jar, libraries, assets) and return a launch descriptor.
 */
export async function installVersion(id: string, onProgress: ProgressFn): Promise<InstalledVersion> {
  const { json, jarId } = await resolveVersion(id)

  // Once a version's files are all downloaded we drop a marker and skip the
  // (expensive) re-verify on every future launch — that re-hashing thousands of
  // asset files was the whole reason launches felt slow.
  const marker = join(paths.versions(), id, '.cabbage-complete')
  const complete = existsSync(marker)

  // --- client jar (always the vanilla one) ---
  const clientJar = join(paths.versions(), jarId, `${jarId}.jar`)
  if (!complete && json.downloads?.client) {
    onProgress('client', 0, 1)
    await downloadFile({ url: json.downloads.client.url, dest: clientJar, sha1: json.downloads.client.sha1, size: json.downloads.client.size })
    onProgress('client', 1, 1)
  }

  const nativesDir = join(paths.versions(), jarId, 'natives')

  // --- libraries (vanilla artifacts + Fabric Maven libs + native jars) ---
  const classpath: string[] = []
  const seen = new Set<string>()
  const seenCoords = new Set<string>()
  const libSpecs: DownloadSpec[] = []
  const nativeJars: NativeJar[] = []
  const addToClasspath = (dest: string): void => {
    if (!seen.has(dest)) {
      seen.add(dest)
      classpath.push(dest)
    }
  }
  // Version-insensitive coordinate ("group:artifact[:classifier]"). Fabric and
  // vanilla can ship DIFFERENT versions of one library (e.g. ASM on 1.21.4:
  // vanilla 9.6 vs Fabric 9.10.1) — both on the classpath makes Fabric refuse
  // to boot ("duplicate ASM classes found"). The merged list puts the Fabric
  // profile's libraries first, so first-one-wins keeps Fabric's build.
  const coordKey = (name?: string): string | null => {
    if (!name) return null
    const [group, artifact, , classifier] = name.split(':')
    return classifier ? `${group}:${artifact}:${classifier}` : `${group}:${artifact}`
  }

  for (const lib of json.libraries) {
    if (!rulesAllow(lib.rules)) continue

    let artifact = lib.downloads?.artifact
    if (!artifact && lib.url && lib.name) artifact = mavenToArtifact(lib.name, lib.url)
    if (artifact) {
      const key = coordKey(lib.name)
      if (!key || !seenCoords.has(key)) {
        if (key) seenCoords.add(key)
        const dest = libPath(artifact)
        libSpecs.push({ url: artifact.url, dest, sha1: artifact.sha1 ?? lib.sha1, size: artifact.size })
        addToClasspath(dest)
      }
    }

    const nativeKey = lib.natives?.[currentOsName()]?.replace('${arch}', process.arch === 'ia32' ? '32' : '64')
    const classifier = nativeKey ? lib.downloads?.classifiers?.[nativeKey] : undefined
    if (classifier) {
      // Old-style natives: download the jar and extract it (see extractNatives),
      // rather than putting it on the classpath.
      nativeJars.push({
        url: classifier.url,
        dest: libPath(classifier),
        sha1: classifier.sha1,
        size: classifier.size,
        exclude: lib.extract?.exclude
      })
    }
  }

  if (!json.assetIndex) throw new Error('Version is missing an asset index')

  if (!complete) {
    await downloadAll(libSpecs, 8, (d, t) => onProgress('libraries', d, t))

    // --- assets ---
    const indexPath = join(paths.assetIndexes(), `${json.assetIndex.id}.json`)
    await downloadFile({ url: json.assetIndex.url, dest: indexPath, sha1: json.assetIndex.sha1, size: json.assetIndex.size })
    const index = JSON.parse(await readFile(indexPath, 'utf8')) as AssetIndex
    const assetSpecs: DownloadSpec[] = Object.values(index.objects).map((o) => {
      const sub = o.hash.slice(0, 2)
      return { url: `${RESOURCES}/${sub}/${o.hash}`, dest: join(paths.assetObjects(), sub, o.hash), sha1: o.hash, size: o.size }
    })
    await downloadAll(assetSpecs, 16, (d, t) => onProgress('assets', d, t))

    await writeFile(marker, new Date().toISOString())
  } else {
    onProgress('ready', 1, 1)
  }

  // Native libs (older versions) — download + extract; idempotent, so run even
  // when the version is otherwise "complete" in case natives were never extracted.
  if (nativeJars.length) {
    await downloadAll(nativeJars, 8, (d, t) => onProgress('natives', d, t))
    extractNatives(nativeJars, nativesDir)
  }

  return {
    json,
    clientJar,
    classpath: [...classpath, clientJar],
    assetsRoot: paths.assets(),
    assetIndexId: json.assetIndex.id,
    nativesDir,
    javaComponent: json.javaVersion?.component ?? 'jre-legacy'
  }
}
