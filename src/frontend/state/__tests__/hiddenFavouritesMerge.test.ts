import {
  mergeGameListEntries,
  removeGameListEntriesByAppName
} from '../hiddenFavouritesMerge'

describe('hiddenFavouritesMerge', () => {
  test('mergeGameListEntries keeps every new appName in one list', () => {
    const existing = [{ appName: 'a', title: 'A' }]
    const merged = mergeGameListEntries(existing, [
      { appName: 'b', title: 'B' },
      { appName: 'c', title: 'C' }
    ])
    expect(merged).toEqual(
      expect.arrayContaining([
        { appName: 'a', title: 'A' },
        { appName: 'b', title: 'B' },
        { appName: 'c', title: 'C' }
      ])
    )
    expect(merged.length).toBe(3)
  })

  test('mergeGameListEntries replaces title when appName repeats', () => {
    const merged = mergeGameListEntries(
      [{ appName: 'x', title: 'Old' }],
      [{ appName: 'x', title: 'New' }]
    )
    expect(merged).toEqual([{ appName: 'x', title: 'New' }])
  })

  test('removeGameListEntriesByAppName drops all listed app names at once', () => {
    const list = [
      { appName: 'a', title: 'A' },
      { appName: 'b', title: 'B' },
      { appName: 'c', title: 'C' }
    ]
    expect(removeGameListEntriesByAppName(list, ['a', 'c'])).toEqual([
      { appName: 'b', title: 'B' }
    ])
  })
})
