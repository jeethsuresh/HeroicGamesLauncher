import { create } from 'zustand'

import type { Runner } from 'common/types'
import { libraryGameStorageKey } from 'frontend/constants/libraryDnD'

/**
 * Persistent multi-select for library game cards (Cmd/Ctrl+click, Shift+range,
 * checkbox). Used instead of React context so updates always re-render and
 * drag handlers read fresh `selectedKeys`.
 */
type LibrarySelectionState = {
  selectedKeys: string[]
  anchorKey: string | null
  toggle: (appName: string, runner: Runner) => void
  selectRange: (
    orderedKeys: readonly string[],
    appName: string,
    runner: Runner
  ) => void
  clear: () => void
  setSelectedKeys: (keys: readonly string[]) => void
}

export const useLibrarySelectionStore = create<LibrarySelectionState>(
  (set, get) => ({
    selectedKeys: [],
    anchorKey: null,

    toggle: (appName, runner) => {
      const key = libraryGameStorageKey(appName, runner)
      set((s) => {
        const next = new Set(s.selectedKeys)
        const had = next.has(key)
        if (had) {
          next.delete(key)
          let anchor = s.anchorKey
          if (anchor === key) {
            const remaining = Array.from(next)
            anchor =
              remaining.length > 0 ? remaining[remaining.length - 1] : null
          }
          return { selectedKeys: Array.from(next), anchorKey: anchor }
        }
        next.add(key)
        return { selectedKeys: Array.from(next), anchorKey: key }
      })
    },

    selectRange: (orderedKeys, appName, runner) => {
      const currentKey = libraryGameStorageKey(appName, runner)
      const end = orderedKeys.indexOf(currentKey)
      if (end === -1) {
        set({ selectedKeys: [currentKey], anchorKey: currentKey })
        return
      }

      const anchorKey = get().anchorKey
      const anchorIdx =
        anchorKey !== null ? orderedKeys.indexOf(anchorKey) : end
      const startIdx = anchorIdx === -1 ? end : anchorIdx
      const lo = Math.min(startIdx, end)
      const hi = Math.max(startIdx, end)
      const rangeKeys = orderedKeys.slice(lo, hi + 1)
      set({ selectedKeys: [...rangeKeys], anchorKey: currentKey })
    },

    clear: () => set({ selectedKeys: [], anchorKey: null }),

    setSelectedKeys: (keys) =>
      set({
        selectedKeys: [...keys],
        anchorKey: keys.length > 0 ? keys[keys.length - 1]! : null
      })
  })
)

export function getLibrarySelectionKeys(): readonly string[] {
  return useLibrarySelectionStore.getState().selectedKeys
}
