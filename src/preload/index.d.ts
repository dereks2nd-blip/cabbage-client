import { ElectronAPI } from '@electron-toolkit/preload'
import type { CabbageApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    cabbage: CabbageApi
  }
}
