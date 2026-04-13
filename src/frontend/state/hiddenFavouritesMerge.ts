import type { HiddenGame } from 'common/types'

/** Merge `{ appName, title }` entries; later entries replace same `appName`. */
export function mergeGameListEntries(
  existing: readonly HiddenGame[],
  toAdd: readonly HiddenGame[]
): HiddenGame[] {
  const map = new Map<string, HiddenGame>()
  for (const entry of existing) {
    map.set(entry.appName, entry)
  }
  for (const entry of toAdd) {
    map.set(entry.appName, entry)
  }
  return Array.from(map.values())
}

export function removeGameListEntriesByAppName(
  existing: readonly HiddenGame[],
  appNamesToRemove: readonly string[]
): HiddenGame[] {
  if (!appNamesToRemove.length) {
    return [...existing]
  }
  const remove = new Set(appNamesToRemove)
  return existing.filter((e) => !remove.has(e.appName))
}
