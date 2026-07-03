import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface LaunchOptions {
  versionId: string
  username: string
  ramMb?: number
  loader?: 'vanilla' | 'fabric'
}

export interface ModHit {
  projectId: string
  slug: string
  title: string
  description: string
  author: string
  downloads: number
  iconUrl: string | null
  categories: string[]
}

/** The typed surface the renderer is allowed to call. Keep this small. */
const cabbage = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  detectJava: (): Promise<{
    found: boolean
    path?: string
    major?: number
    versionString?: string
    source?: string
  }> => ipcRenderer.invoke('java:detect'),
  listVersions: (): Promise<{
    latestRelease: string
    versions: Array<{ id: string; type: string; releaseTime: string }>
  }> => ipcRenderer.invoke('versions:list'),
  searchMods: (query: string, gameVersion: string): Promise<ModHit[]> =>
    ipcRenderer.invoke('mods:search', query, gameVersion),
  installMod: (
    projectId: string,
    gameVersion: string
  ): Promise<{ installed: string[]; warnings: string[] }> =>
    ipcRenderer.invoke('mods:install', projectId, gameVersion),
  listInstalledMods: (gameVersion: string): Promise<string[]> =>
    ipcRenderer.invoke('mods:listInstalled', gameVersion),
  removeMod: (filename: string, gameVersion: string): Promise<void> =>
    ipcRenderer.invoke('mods:remove', filename, gameVersion),
  clearMods: (gameVersion: string): Promise<void> => ipcRenderer.invoke('mods:clear', gameVersion),
  installPerformancePack: (
    gameVersion: string
  ): Promise<{ installed: string[]; warnings: string[] }> =>
    ipcRenderer.invoke('mods:installPack', gameVersion),
  listProfiles: (): Promise<
    Array<{ name: string; mods: Array<{ projectId: string; title: string }>; updatedAt: string }>
  > => ipcRenderer.invoke('profiles:list'),
  saveProfile: (
    name: string,
    gameVersion: string
  ): Promise<{
    profile: { name: string; mods: Array<{ projectId: string; title: string }> }
    unmanaged: string[]
  }> => ipcRenderer.invoke('profiles:save', name, gameVersion),
  applyProfile: (
    name: string,
    gameVersion: string
  ): Promise<{ installed: string[]; warnings: string[] }> =>
    ipcRenderer.invoke('profiles:apply', name, gameVersion),
  deleteProfile: (name: string): Promise<void> => ipcRenderer.invoke('profiles:delete', name),
  getSettings: (): Promise<{ msClientId?: string; ramMb?: number }> =>
    ipcRenderer.invoke('settings:get'),
  setSettings: (patch: { ramMb?: number }): Promise<{ ramMb?: number }> =>
    ipcRenderer.invoke('settings:set', patch),
  currentAccount: (): Promise<{ name: string; uuid: string } | null> =>
    ipcRenderer.invoke('auth:current'),
  login: (): Promise<{ name: string; uuid: string }> => ipcRenderer.invoke('auth:login'),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
  launch: (opts: LaunchOptions): Promise<void> => ipcRenderer.invoke('launch:start', opts),
  stopGame: (): Promise<boolean> => ipcRenderer.invoke('launch:stop'),
  isGameRunning: (): Promise<boolean> => ipcRenderer.invoke('launch:running'),
  listInstances: (): Promise<
    Array<{
      id: string
      mcVersion: string
      loader: string
      name: string
      modCount: number
      hasWorlds: boolean
      lastPlayedMs: number | null
    }>
  > => ipcRenderer.invoke('instances:list'),
  createInstance: (
    mcVersion: string,
    loader: string,
    name?: string
  ): Promise<{ id: string }> => ipcRenderer.invoke('instances:create', mcVersion, loader, name),
  renameInstance: (id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('instances:rename', id, name),
  deleteInstance: (id: string): Promise<void> => ipcRenderer.invoke('instances:delete', id),
  onLaunchEvent: (cb: (e: unknown) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, e: unknown): void => cb(e)
    ipcRenderer.on('launch:event', listener)
    return () => ipcRenderer.removeListener('launch:event', listener)
  }
}

export type CabbageApi = typeof cabbage

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('cabbage', cabbage)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define on window when context isolation is off)
  window.electron = electronAPI
  // @ts-ignore
  window.cabbage = cabbage
}
