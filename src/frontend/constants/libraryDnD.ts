import type { Runner } from 'common/types'

/** Custom data transfer type for dragging games from the library onto category targets. */
export const HEROIC_LIBRARY_GAMES_DRAG_MIME =
  'application/x-heroic-library-games+json'

export type LibraryGameDragGame = {
  appName: string
  runner: Runner
}

export type LibraryGameDragPayload = {
  games: LibraryGameDragGame[]
}

const RUNNERS: readonly Runner[] = [
  'legendary',
  'gog',
  'nile',
  'sideload',
  'zoom'
]

export function isRunner(value: unknown): value is Runner {
  return typeof value === 'string' && RUNNERS.includes(value as Runner)
}

/**
 * `customCategories` keys use `${appName}_${runner}`; `runner` is always a known store id.
 */
export function parseLibraryGameKey(
  key: string
): { appName: string; runner: Runner } | null {
  for (const r of RUNNERS) {
    const suffix = `_${r}`
    if (key.endsWith(suffix)) {
      return { appName: key.slice(0, -suffix.length), runner: r }
    }
  }
  return null
}

export function libraryGameStorageKey(appName: string, runner: Runner): string {
  return `${appName}_${runner}`
}

export function parseDragPayloadGames(
  raw: string
): LibraryGameDragGame[] | null {
  try {
    const parsed = JSON.parse(raw) as LibraryGameDragPayload
    if (!parsed.games || !Array.isArray(parsed.games)) {
      return null
    }
    const out: LibraryGameDragGame[] = []
    for (const g of parsed.games) {
      if (!g || typeof g !== 'object') {
        continue
      }
      const appName = (g as { appName?: unknown }).appName
      const runner = (g as { runner?: unknown }).runner
      if (typeof appName === 'string' && isRunner(runner)) {
        out.push({ appName, runner })
      }
    }
    return out.length ? out : null
  } catch {
    return null
  }
}

/**
 * Build the drag payload: whenever any games are selected, include **all**
 * selected titles. If the drag starts on a card that is not part of the
 * selection, that card is included as well (union).
 */
export function gamesForLibraryDrag(
  appName: string,
  runner: Runner,
  selectionKeys: readonly string[]
): LibraryGameDragGame[] {
  const key = libraryGameStorageKey(appName, runner)
  if (!selectionKeys.length) {
    return [{ appName, runner }]
  }

  const byKey = new Map<string, LibraryGameDragGame>()
  for (const k of selectionKeys) {
    const parsed = parseLibraryGameKey(k)
    if (parsed) {
      byKey.set(libraryGameStorageKey(parsed.appName, parsed.runner), parsed)
    }
  }
  if (!selectionKeys.includes(key)) {
    byKey.set(key, { appName, runner })
  }

  const merged = Array.from(byKey.values())
  return merged.length ? merged : [{ appName, runner }]
}

/**
 * When two or more library cards are selected and the user invokes an action on
 * a card that is part of that selection, the action should apply to every
 * selected game. If the selection is empty or only one card, returns just the
 * primary game. If the user acts on a card outside the multi-selection, returns
 * only that card.
 */
export function libraryBulkGameTargets(
  primaryAppName: string,
  primaryRunner: Runner,
  selectedKeys: readonly string[]
): LibraryGameDragGame[] {
  const primaryKey = libraryGameStorageKey(primaryAppName, primaryRunner)
  if (selectedKeys.length >= 2 && selectedKeys.includes(primaryKey)) {
    const out: LibraryGameDragGame[] = []
    for (const k of selectedKeys) {
      const parsed = parseLibraryGameKey(k)
      if (parsed) {
        out.push(parsed)
      }
    }
    return out.length
      ? out
      : [{ appName: primaryAppName, runner: primaryRunner }]
  }
  return [{ appName: primaryAppName, runner: primaryRunner }]
}
