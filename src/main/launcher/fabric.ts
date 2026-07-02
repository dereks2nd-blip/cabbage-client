import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { paths } from './paths'
import { fetchJson } from './download'

const FABRIC_META = 'https://meta.fabricmc.net/v2'

interface LoaderEntry {
  loader: { version: string; stable: boolean }
}

interface FabricProfile {
  id: string
  inheritsFrom: string
  libraries?: Array<{ name: string; url?: string }>
  [key: string]: unknown
}

interface IntermediaryEntry {
  maven: string
}

/**
 * Install the Fabric loader for a given Minecraft version by fetching Fabric's
 * launcher profile and saving it as a local version JSON that `installVersion`
 * resolves via `inheritsFrom`. Returns the Fabric version id to launch.
 */
export async function installFabric(gameVersion: string): Promise<string> {
  const loaders = await fetchJson<LoaderEntry[]>(`${FABRIC_META}/versions/loader/${gameVersion}`)
  if (!loaders.length) throw new Error(`Fabric has no loader for Minecraft ${gameVersion}`)
  const chosen = loaders.find((l) => l.loader.stable) ?? loaders[0]

  const profile = await fetchJson<FabricProfile>(
    `${FABRIC_META}/versions/loader/${gameVersion}/${chosen.loader.version}/profile/json`
  )

  // The meta profile omits the intermediary mappings library; add it so it
  // lands on the classpath (Fabric needs it to set up remapping correctly).
  const interRes = await fetchJson<IntermediaryEntry[] | IntermediaryEntry>(
    `${FABRIC_META}/versions/intermediary/${gameVersion}`
  )
  const inter = Array.isArray(interRes) ? interRes[0] : interRes
  profile.libraries = profile.libraries ?? []
  if (inter?.maven && !profile.libraries.some((l) => l.name === inter.maven)) {
    profile.libraries.push({ name: inter.maven, url: 'https://maven.fabricmc.net/' })
  }

  const dir = join(paths.versions(), profile.id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${profile.id}.json`), JSON.stringify(profile))
  return profile.id
}
