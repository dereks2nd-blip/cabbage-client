import type { IpcMain } from 'electron'
import { app, BrowserWindow } from 'electron'
import { detectJava } from './launcher/java'
import { instanceMods } from './launcher/paths'
import { listInstallableVersions } from './launcher/versions'
import { isGameRunning, launchGame, stopGame, type LaunchOptions } from './launcher/launch'
import { createInstance, deleteInstance, listInstances, renameInstance } from './launcher/instances'
import {
  searchMods,
  installMod,
  installPerformancePack,
  listInstalledMods,
  removeMod,
  clearMods
} from './launcher/modrinth'
import { applyProfile, deleteProfile, listProfiles, saveProfile } from './launcher/profiles'
import { authWindow, completeLogin, loadAccount, logout } from './launcher/auth'
import { readSettings, writeSettings, type Settings } from './launcher/settings'

/**
 * Wire up all launcher IPC channels. The renderer calls these through the
 * `window.cabbage` bridge defined in the preload script.
 */
export function registerLauncherIpc(ipcMain: IpcMain): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('java:detect', () => detectJava())

  ipcMain.handle('versions:list', () => listInstallableVersions())

  // Mods only apply under Fabric, so all mod operations target the version's
  // Fabric instance regardless of the Play tab's loader toggle.
  const modsFor = (gameVersion: string): string => instanceMods(gameVersion, 'fabric')

  ipcMain.handle('mods:search', (_e, q: string, gameVersion: string) => searchMods(q, gameVersion))
  ipcMain.handle('mods:install', (_e, projectId: string, gameVersion: string) =>
    installMod(projectId, gameVersion, 'fabric', modsFor(gameVersion))
  )
  ipcMain.handle('mods:listInstalled', (_e, gameVersion: string) =>
    listInstalledMods(modsFor(gameVersion))
  )
  ipcMain.handle('mods:remove', (_e, filename: string, gameVersion: string) =>
    removeMod(modsFor(gameVersion), filename)
  )
  ipcMain.handle('mods:clear', (_e, gameVersion: string) => clearMods(modsFor(gameVersion)))
  ipcMain.handle('mods:installPack', (_e, gameVersion: string) =>
    installPerformancePack(gameVersion, 'fabric', modsFor(gameVersion))
  )

  // --- mod profiles (named loadouts, applied per-version) ---
  ipcMain.handle('profiles:list', () => listProfiles())
  ipcMain.handle('profiles:save', (_e, name: string, gameVersion: string) =>
    saveProfile(name, modsFor(gameVersion))
  )
  ipcMain.handle('profiles:apply', (_e, name: string, gameVersion: string) =>
    applyProfile(name, gameVersion, 'fabric', modsFor(gameVersion))
  )
  ipcMain.handle('profiles:delete', (_e, name: string) => deleteProfile(name))

  // --- settings ---
  ipcMain.handle('settings:get', () => readSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => writeSettings(patch))

  // --- Microsoft account ---
  ipcMain.handle('auth:current', () => {
    const a = loadAccount()
    return a ? { name: a.name, uuid: a.uuid } : null
  })
  ipcMain.handle('auth:logout', () => logout())

  // Opens Microsoft's sign-in page in a window, captures the redirect code, and
  // trades it for a Minecraft account. Resolves with the signed-in profile.
  ipcMain.handle('auth:login', () => {
    const { authorizeUrl, redirectUri } = authWindow
    return new Promise<{ name: string; uuid: string }>((resolve, reject) => {
      const win = new BrowserWindow({
        width: 520,
        height: 700,
        title: 'Sign in to Microsoft',
        autoHideMenuBar: true,
        backgroundColor: '#0e1411',
        webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:msa-login' }
      })
      let settled = false
      const done = (fn: () => void): void => {
        if (settled) return
        settled = true
        fn()
      }

      const onUrl = (url: string): void => {
        if (!url.startsWith(redirectUri)) return
        const params = new URL(url).searchParams
        const code = params.get('code')
        const error = params.get('error')
        if (error) {
          done(() => reject(new Error(params.get('error_description') ?? error)))
          win.destroy()
        } else if (code) {
          done(() => {
            completeLogin(code)
              .then((acc) => resolve({ name: acc.name, uuid: acc.uuid }))
              .catch(reject)
          })
          win.destroy()
        }
      }

      win.webContents.on('will-redirect', (_e, url) => onUrl(url))
      win.webContents.on('did-navigate', (_e, url) => onUrl(url))
      win.on('closed', () => done(() => reject(new Error('Sign-in window was closed.'))))
      win.loadURL(authorizeUrl)
    })
  })

  // --- instances ---
  ipcMain.handle('instances:list', () => listInstances())
  ipcMain.handle('instances:create', (_e, mcVersion: string, loader: string, name?: string) =>
    createInstance(mcVersion, loader, name)
  )
  ipcMain.handle('instances:rename', (_e, id: string, name: string) => renameInstance(id, name))
  ipcMain.handle('instances:delete', (_e, id: string) => deleteInstance(id))

  ipcMain.handle('launch:stop', () => stopGame())
  ipcMain.handle('launch:running', () => isGameRunning())

  // Long-running: streams progress/log/exit back over 'launch:event'.
  ipcMain.handle('launch:start', (event, opts: LaunchOptions) => {
    return launchGame(opts, (e) => {
      // Mirror to main-process stdout so launches are debuggable from the terminal.
      if (e.type === 'stage') console.log(`[launch] ${e.stage}: ${e.message}${e.total ? ` (${e.done}/${e.total})` : ''}`)
      else if (e.type === 'error') console.error(`[launch] ERROR: ${e.message}`)
      else if (e.type === 'started') console.log(`[launch] started pid=${e.pid}`)
      else if (e.type === 'exit') console.log(`[launch] exit code=${e.code}`)
      if (!event.sender.isDestroyed()) event.sender.send('launch:event', e)
    })
  })
}
