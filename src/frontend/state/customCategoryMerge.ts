/**
 * Immutable helpers for `games.customCategories` updates.
 * Multi-game assign/remove must merge in one step: repeated class `setState`
 * reads stale `this.state` and would otherwise keep only the last key.
 */
export function mergeGameKeysIntoCategory(
  customCategories: Record<string, string[]>,
  category: string,
  gameKeys: readonly string[]
): Record<string, string[]> {
  const prev = customCategories[category] || []
  const set = new Set(prev)
  for (const k of gameKeys) {
    set.add(k)
  }
  return { ...customCategories, [category]: Array.from(set) }
}

export function removeGameKeysFromCategory(
  customCategories: Record<string, string[]>,
  category: string,
  gameKeys: readonly string[]
): Record<string, string[]> | null {
  const games = customCategories[category]
  if (!games?.length) {
    return null
  }
  const removeSet = new Set(gameKeys)
  const filtered = games.filter((g) => !removeSet.has(g))
  return { ...customCategories, [category]: filtered }
}
