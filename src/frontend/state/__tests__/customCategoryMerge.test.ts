import {
  mergeGameKeysIntoCategory,
  removeGameKeysFromCategory
} from '../customCategoryMerge'

describe('customCategoryMerge', () => {
  test('mergeGameKeysIntoCategory adds every key in one map update', () => {
    const before = { favorites: ['gameA_legendary'] as string[] }
    const after = mergeGameKeysIntoCategory(before, 'favorites', [
      'gameB_gog',
      'gameC_nile'
    ])
    expect(after.favorites).toEqual(
      expect.arrayContaining([
        'gameA_legendary',
        'gameB_gog',
        'gameC_nile'
      ])
    )
    expect(after.favorites?.length).toBe(3)
    expect(before.favorites).toEqual(['gameA_legendary'])
  })

  test('mergeGameKeysIntoCategory deduplicates keys', () => {
    const before = { c: ['x_legendary'] }
    const after = mergeGameKeysIntoCategory(before, 'c', [
      'x_legendary',
      'y_gog'
    ])
    expect(after.c).toEqual(['x_legendary', 'y_gog'])
  })

  test('parallel stale-style updates would drop keys; merged update keeps all', () => {
    const stale: Record<string, string[]> = { myCat: [] }
    const wrongIfEachReadsStale = {
      ...stale,
      myCat: ['only_last']
    }
    expect(wrongIfEachReadsStale.myCat).toEqual(['only_last'])
    const correct = mergeGameKeysIntoCategory(stale, 'myCat', [
      'first_gog',
      'second_legendary',
      'only_last'
    ])
    expect(correct.myCat).toEqual(
      expect.arrayContaining(['first_gog', 'second_legendary', 'only_last'])
    )
  })

  test('removeGameKeysFromCategory strips every listed key at once', () => {
    const before = {
      c: ['a_legendary', 'b_gog', 'c_nile']
    }
    const after = removeGameKeysFromCategory(before, 'c', ['a_legendary', 'c_nile'])
    expect(after?.c).toEqual(['b_gog'])
  })

  test('removeGameKeysFromCategory returns null when category is missing', () => {
    expect(removeGameKeysFromCategory({}, 'missing', ['a_gog'])).toBeNull()
  })
})
