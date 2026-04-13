import React, { useContext, useEffect, useMemo, useRef } from 'react'
import { GameInfo, Runner } from 'common/types'
import cx from 'classnames'
import GameCard from '../GameCard'
import ContextProvider from 'frontend/state/ContextProvider'
import { useTranslation } from 'react-i18next'
import Checkbox from '@mui/material/Checkbox'
import { libraryGameStorageKey } from 'frontend/constants/libraryDnD'
import { useLibrarySelectionStore } from 'frontend/state/librarySelectionStore'

interface Props {
  library: GameInfo[]
  layout?: string
  isFirstLane?: boolean
  handleGameCardClick: (
    app_name: string,
    runner: Runner,
    gameInfo: GameInfo
  ) => void
  onlyInstalled?: boolean
  isRecent?: boolean
  isFavourite?: boolean
}

// When a card is focused in the library,
const scrollCardIntoView = (ev: FocusEvent) => {
  const windowHeight = window.innerHeight
  const trgt = ev.target as HTMLElement
  const rect = trgt.getBoundingClientRect()

  if (rect.top < 100) {
    // if it's too close to the top, scroll a bit down
    document.body.scrollTo({
      top: trgt.parentElement!.offsetTop - 200,
      behavior: 'smooth'
    })
  } else if (rect.bottom > windowHeight - 100) {
    // if it's too close to the bottom, scroll a bit up
    document.body.scrollTo({
      top: trgt.parentElement!.offsetTop - windowHeight + rect.height + 150,
      behavior: 'smooth'
    })
  }
}

const GamesList = ({
  library = [],
  layout = 'grid',
  handleGameCardClick,
  isFirstLane = false,
  onlyInstalled = false,
  isRecent = false,
  isFavourite = false
}: Props): JSX.Element => {
  const { gameUpdates, allTilesInColor, titlesAlwaysVisible } =
    useContext(ContextProvider)
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement | null>(null)
  const { activeController } = useContext(ContextProvider)

  const visibleRows = useMemo(() => {
    const rows: { gameInfo: GameInfo; originalIndex: number }[] = []
    library.forEach((gameInfo, originalIndex) => {
      let is_dlc = false
      if (gameInfo.runner !== 'sideload') {
        is_dlc = gameInfo.install.is_dlc ?? false
      }
      if (is_dlc) {
        return
      }
      if (!gameInfo.is_installed && onlyInstalled) {
        return
      }
      rows.push({ gameInfo, originalIndex })
    })
    return rows
  }, [library, onlyInstalled])

  const visibleRowKeys = useMemo(
    () =>
      visibleRows.map(({ gameInfo }) =>
        libraryGameStorageKey(gameInfo.app_name, gameInfo.runner)
      ),
    [visibleRows]
  )

  const selectedKeys = useLibrarySelectionStore((s) => s.selectedKeys)
  const selectedKeySet = useMemo(
    () => new Set(selectedKeys),
    [selectedKeys]
  )
  const visibleSelectedCount = useMemo(
    () => visibleRowKeys.filter((k) => selectedKeySet.has(k)).length,
    [visibleRowKeys, selectedKeySet]
  )
  const allVisibleSelected =
    visibleRowKeys.length > 0 && visibleSelectedCount === visibleRowKeys.length
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected

  useEffect(() => {
    if (library.length) {
      const options = {
        rootMargin: '500px',
        threshold: 0
      }

      const callback: IntersectionObserverCallback = (entries, observer) => {
        const entered: string[] = []
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0) {
            // when a card is intersecting the viewport
            const appName = (entry.target as HTMLDivElement).dataset
              .appName as string

            // store this appName for later
            entered.push(appName)
            // stop observing this element
            observer.unobserve(entry.target)
          }
        })

        // dispatch an event with the newly visible cards
        // check GameCard for the other side of this detection
        window.dispatchEvent(
          new CustomEvent('visible-cards', { detail: { appNames: entered } })
        )
      }

      const observer = new IntersectionObserver(callback, options)

      document.querySelectorAll('[data-invisible]').forEach((card) => {
        observer.observe(card)
      })

      return () => {
        observer.disconnect()
      }
    }
    return () => ({})
  }, [library])

  useEffect(() => {
    if (listRef.current && activeController) {
      listRef.current.addEventListener('focus', scrollCardIntoView, {
        capture: true
      })

      return () => {
        listRef.current?.removeEventListener('focus', scrollCardIntoView, {
          capture: true
        })
      }
    }

    return () => ({})
  }, [listRef.current, activeController])

  return (
    <div
      style={!library.length ? { backgroundColor: 'transparent' } : {}}
      className={cx({
        gameList: layout === 'grid',
        gameListLayout: layout === 'list',
        firstLane: isFirstLane,
        allTilesInColor,
        titlesAlwaysVisible
      })}
      ref={listRef}
    >
      {layout === 'list' && (
        <div className="gameListHeader">
          <div
            className="gameListHeaderSelectAll"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              size="small"
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              disabled={visibleRowKeys.length === 0}
              tabIndex={0}
              inputProps={{
                'aria-label': t(
                  'library.selectAllGames',
                  'Select all games in this list'
                )
              }}
              sx={{
                padding: '4px',
                color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                '&.Mui-checked, &.MuiCheckbox-indeterminate': {
                  color: 'var(--accent, #7fdfff)'
                }
              }}
              onChange={() => {
                const store = useLibrarySelectionStore.getState()
                if (allVisibleSelected) {
                  store.clear()
                } else {
                  store.setSelectedKeys(visibleRowKeys)
                }
              }}
            />
          </div>
          <span>{t('game.title', 'Game Title')}</span>
          <span>{t('game.status', 'Status')}</span>
          <span>{t('game.store', 'Store')}</span>
          <span>{t('wine.actions', 'Action')}</span>
        </div>
      )}
      {!!library.length &&
        visibleRows.map(({ gameInfo, originalIndex }) => {
          const { app_name, is_installed, runner } = gameInfo
          const isJustPlayed =
            (isFavourite || isRecent) && originalIndex === 0

          const hasUpdate = is_installed && gameUpdates?.includes(app_name)
          return (
            <GameCard
              key={`${runner}_${app_name}${isFirstLane ? '_firstlane' : ''}`}
              hasUpdate={hasUpdate}
              handleGameCardClick={(info) => {
                if (info.runner !== 'sideload')
                  handleGameCardClick(info.app_name, info.runner, info)
              }}
              forceCard={layout === 'grid'}
              isRecent={isRecent}
              gameInfo={gameInfo}
              justPlayed={isJustPlayed}
              dataTour={
                originalIndex === 0 ? 'library-game-card' : undefined
              }
            />
          )
        })}
    </div>
  )
}

export default React.memo(GamesList)
