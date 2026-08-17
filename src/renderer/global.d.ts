import type { TritiumApi } from '../preload/index.js'

declare global {
  interface Window {
    tritium: TritiumApi
  }
}

export {}
