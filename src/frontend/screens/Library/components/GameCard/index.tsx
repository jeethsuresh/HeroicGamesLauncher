import './index.css'

import {
  useContext,
  CSSProperties,
  useMemo,
  useState,
  useEffect,
  useCallback
} from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRepeat, faBan } from '@fortawesome/free-solid-svg-icons'

import DownIcon from 'frontend/assets/down-icon.svg?react'
import { FavouriteGame, GameInfo, HiddenGame, Runner } from 'common/types'
import { Link, useNavigate } from 'react-router-dom'
import PlayIcon from 'frontend/assets/play-icon.svg?react'
import SettingsIcon from 'frontend/assets/settings_icon_alt.svg?react'
import StopIcon from 'frontend/assets/stop-icon.svg?react'
import StopIconAlt from 'frontend/assets/stop-icon-alt.svg?react'
import {
  getGameInfo,
  getProgress,
  getStoreName,
  sendKill
} from 'frontend/helpers'
import { install, launch, updateGame } from 'frontend/helpers/library'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import { CachedImage, SvgButton } from 'frontend/components/UI'
import ContextMenu, { Item } from '../ContextMenu'
import { hasProgress } from 'frontend/hooks/hasProgress'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'

import classNames from 'classnames'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import UninstallModal, {
  type UninstallModalGame
} from 'frontend/components/UI/UninstallModal'
import { getCardStatus, getImageFormatting } from './constants'
import { hasStatus } from 'frontend/hooks/hasStatus'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import Checkbox from '@mui/material/Checkbox'
import LibraryContext from '../../LibraryContext'
import {
  gamesForLibraryDrag,
  HEROIC_LIBRARY_GAMES_DRAG_MIME,
  libraryBulkGameTargets,
  libraryGameStorageKey,
  type LibraryGameDragGame
} from 'frontend/constants/libraryDnD'
import {
  getLibrarySelectionKeys,
  useLibrarySelectionStore
} from 'frontend/state/librarySelectionStore'
import {
  openInstallGameModal,
  useInstallGameModal
} from 'frontend/state/InstallGameModal'
import useGlobalState from 'frontend/state/GlobalStateV2'
import {
  Cancel,
  DeleteForever,
  Description,
  Download,
  Edit,
  Favorite,
  FavoriteBorder,
  List,
  OpenInNew,
  PlayArrow,
  PlaylistRemove,
  Settings,
  Upgrade,
  Visibility,
  VisibilityOff
} from '@mui/icons-material'
import EditGameDialog from 'frontend/components/UI/EditGameDialog'

interface Card {
  handleGameCardClick: (gameInfo: GameInfo) => void
  hasUpdate: boolean
  isRecent: boolean
  justPlayed: boolean
  gameInfo: GameInfo
  forceCard?: boolean
  dataTour?: string
}

const storage: Storage = window.localStorage

const GameCard = ({
  hasUpdate,
  handleGameCardClick,
  forceCard,
  isRecent = false,
  justPlayed = false,
  gameInfo: gameInfoFromProps,
  dataTour
}: Card) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // render an empty div until the card enters the viewport
    // check GameList for the other side of this detection
    const callback = (e: CustomEvent<{ appNames: string[] }>) => {
      if (e.detail.appNames.includes(gameInfoFromProps.app_name)) {
        setVisible(true)
      }
    }

    window.addEventListener('visible-cards', callback)

    return () => {
      window.removeEventListener('visible-cards', callback)
    }
  }, [])

  const [gameInfo, setGameInfo] = useState<GameInfo>(gameInfoFromProps)
  const [uninstallModalGames, setUninstallModalGames] = useState<
    UninstallModalGame[] | null
  >(null)
  const [isLaunching, setIsLaunching] = useState(false)

  const { t } = useTranslation('gamepage')
  const { t: t2 } = useTranslation()

  const navigate = useNavigate()

  const {
    hiddenGames,
    favouriteGames,
    showDialogModal,
    activeController,
    connectivity,
    libraryStatus,
    gameUpdates
  } = useContext(ContextProvider)
  const { openGameSettingsModal, openGameLogsModal, openGameCategoriesModal } =
    useGlobalState.keys(
      'openGameSettingsModal',
      'openGameLogsModal',
      'openGameCategoriesModal'
    )

  const { layout, selectLibraryGamesWithShift } = useContext(LibraryContext)

  const {
    art_logo: logo = undefined,
    app_name: appName,
    runner,
    is_installed: isInstalled,
    install: gameInstallInfo
  } = { ...gameInfoFromProps }
  const title = gameInfoFromProps.overrides?.title || gameInfoFromProps.title
  const art_cover =
    gameInfoFromProps.overrides?.art_cover || gameInfoFromProps.art_cover
  const cover =
    gameInfoFromProps.overrides?.art_square || gameInfoFromProps.art_square

  const gameStorageKey = useMemo(
    () => libraryGameStorageKey(appName, runner),
    [appName, runner]
  )

  /** Zustand: stable selector ref when `gameStorageKey` is unchanged (see zustand docs / “unstable selector”). */
  const libraryGameSelected = useLibrarySelectionStore(
    useCallback(
      (state) => state.selectedKeys.includes(gameStorageKey),
      [gameStorageKey]
    )
  )

  const toggleLibraryGameInSelection = useCallback(() => {
    useLibrarySelectionStore.getState().toggle(appName, runner)
  }, [appName, runner])

  const clearLibrarySelection = useCallback(() => {
    useLibrarySelectionStore.getState().clear()
  }, [])

  /** Snapshot selection once; after clear(), live keys are empty and bulk would collapse to one game. */
  const getBulkTargets = useCallback((): LibraryGameDragGame[] => {
    return libraryBulkGameTargets(appName, runner, [
      ...getLibrarySelectionKeys()
    ])
  }, [appName, runner])

  const gameInfoForTarget = useCallback(
    async (t: { appName: string; runner: Runner }) => {
      if (t.appName === appName && t.runner === runner) {
        return gameInfo
      }
      return getGameInfo(t.appName, t.runner)
    },
    [appName, runner, gameInfo]
  )

  const openCategoriesForSelection = useCallback(() => {
    const targets = getBulkTargets()
    const bulkKeys =
      targets.length > 1
        ? targets.map((tg) => libraryGameStorageKey(tg.appName, tg.runner))
        : undefined
    openGameCategoriesModal(gameInfo, bulkKeys)
  }, [gameInfo, getBulkTargets, openGameCategoriesModal])

  const onUninstallClick = useCallback(async () => {
    const targets = getBulkTargets()
    const games: UninstallModalGame[] = []
    for (const t of targets) {
      const info = await gameInfoForTarget(t)
      if (!info) {
        continue
      }
      const isDlc =
        info.runner !== 'sideload' ? Boolean(info.install.is_dlc) : false
      games.push({ appName: t.appName, runner: t.runner, isDlc })
    }
    if (games.length) {
      setUninstallModalGames(games)
    }
  }, [getBulkTargets, gameInfoForTarget])

  const runBulkInstallModalsInner = useCallback(async () => {
    const targets = getBulkTargets()
    const toInstall: GameInfo[] = []
    for (const t of targets) {
      const info = await gameInfoForTarget(t)
      if (
        info &&
        info.runner !== 'sideload' &&
        (info.installable === undefined || info.installable) &&
        !info.is_installed
      ) {
        toInstall.push(info)
      }
    }
    for (let i = 0; i < toInstall.length; i++) {
      handleGameCardClick(toInstall[i])
      if (i < toInstall.length - 1) {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(() => {
            unsubscribe()
            resolve()
          }, 120_000)
          let sawOpen = false
          let unsubscribe: () => void = () => {}
          unsubscribe = useInstallGameModal.subscribe((state) => {
            if (state.isOpen) {
              sawOpen = true
            } else if (sawOpen) {
              window.clearTimeout(timeout)
              unsubscribe()
              resolve()
            }
          })
        })
      }
    }
  }, [getBulkTargets, gameInfoForTarget, handleGameCardClick])

  const runBulkInstallModals = useCallback(async () => {
    await runBulkInstallModalsInner()
    clearLibrarySelection()
  }, [runBulkInstallModalsInner, clearLibrarySelection])

  const runBulkUpdate = useCallback(async () => {
    const targets = getBulkTargets()
    for (const t of targets) {
      const info = await gameInfoForTarget(t)
      if (info && info.runner !== 'sideload') {
        updateGame({ appName: t.appName, runner: t.runner, gameInfo: info })
      }
    }
    clearLibrarySelection()
  }, [getBulkTargets, gameInfoForTarget, clearLibrarySelection])

  const isInstallable =
    gameInfo.installable === undefined || gameInfo.installable // If it's undefined we assume it's installable

  const [progress, previousProgress] = hasProgress(appName, runner)
  const { install_size: size = '0' } = {
    ...gameInstallInfo
  }

  const { status, folder, label } = hasStatus(gameInfo, size)

  const isBrowserGame = gameInfo.install.platform === 'Browser'

  useEffect(() => {
    setIsLaunching(false)
    const updateGameInfo = async () => {
      const newInfo = await getGameInfo(appName, runner)
      if (newInfo) {
        setGameInfo(newInfo)
      }
    }
    updateGameInfo()
  }, [status])

  const grid = forceCard || layout === 'grid'

  const {
    isInstalling,
    notSupportedGame,
    isUninstalling,
    isQueued,
    isPlaying,
    notAvailable,
    isUpdating,
    haveStatus
  } = getCardStatus(status, isInstalled, layout)

  const installingGrayscale = isInstalling
    ? `${125 - getProgress(progress)}%`
    : '100%'

  const handleRemoveFromQueue = () => {
    const targets = getBulkTargets()
    for (const t of targets) {
      window.api.removeFromDMQueue(t.appName)
    }
    clearLibrarySelection()
  }

  const renderIcon = () => {
    if (!isInstallable) {
      return (
        <FontAwesomeIcon
          title={t(
            'label.game.not-installable-game',
            'Game is NOT Installable'
          )}
          className="downIcon"
          icon={faBan}
        />
      )
    }

    if (notSupportedGame) {
      return (
        <FontAwesomeIcon
          title={t(
            'label.game.third-party-game',
            'Third-Party Game NOT Supported'
          )}
          className="downIcon"
          icon={faBan}
        />
      )
    }
    if (isUninstalling) {
      return (
        <button className="svg-button iconDisabled">
          <svg />
        </button>
      )
    }
    if (isQueued) {
      return (
        <SvgButton
          title={t('button.queue.remove', 'Remove from Queue')}
          className="queueIcon"
          onClick={() => handleRemoveFromQueue()}
        >
          <RemoveCircleIcon />
        </SvgButton>
      )
    }
    if (isPlaying) {
      return (
        <SvgButton
          className="cancelIcon"
          onClick={async () => handlePlay(runner)}
          title={`${t('label.playing.stop')} (${title})`}
        >
          <StopIconAlt />
        </SvgButton>
      )
    }
    if (isInstalling || isQueued) {
      return (
        <SvgButton
          className="cancelIcon"
          onClick={async () => handlePlay(runner)}
          title={`${t('button.cancel')} (${title})`}
        >
          <StopIcon />
        </SvgButton>
      )
    }
    if (isInstalled) {
      const disabled =
        isLaunching ||
        ['syncing-saves', 'launching', 'winetricks', 'redist'].includes(status!)
      return (
        <SvgButton
          className={!notAvailable ? 'playIcon' : 'notAvailableIcon'}
          onClick={async () => handlePlay(runner)}
          title={`${t('label.playing.start')} (${title})`}
          disabled={disabled}
        >
          {justPlayed ? <span>{t('button.play', 'PLAY')}</span> : <PlayIcon />}
        </SvgButton>
      )
    } else {
      return (
        <SvgButton
          className="downIcon"
          onClick={() => void runBulkInstallModals()}
          title={`${t('button.install')} (${title})`}
        >
          <DownIcon />
        </SvgButton>
      )
    }
  }

  const isHiddenGame = useMemo(() => {
    return !!hiddenGames.list.find(
      (hiddenGame: HiddenGame) => hiddenGame.appName === appName
    )
  }, [hiddenGames, appName])

  const isFavouriteGame = useMemo(() => {
    return !!favouriteGames.list.find(
      (favouriteGame: FavouriteGame) => favouriteGame.appName === appName
    )
  }, [favouriteGames, appName])

  const isSideloaded = runner === 'sideload'

  const handleEdit = () => {
    if (isSideloaded) {
      openInstallGameModal({ appName, runner, gameInfo })
      return
    }

    showDialogModal({
      showDialog: true,
      title: t('edit-game.title', 'Edit Game'),
      message: (
        <EditGameDialog
          gameInfo={gameInfo}
          backdropClick={() => showDialogModal({ showDialog: false })}
        />
      )
    })
  }

  const items: Item[] = [
    {
      // remove from install queue
      label: t('button.queue.remove'),
      onclick: () => {
        const targets = getBulkTargets()
        for (const t of targets) {
          window.api.removeFromDMQueue(t.appName)
        }
        clearLibrarySelection()
      },
      show: isQueued && !isInstalling,
      icon: <Cancel />
    },
    {
      // stop if running
      label: t('label.playing.stop'),
      onclick: async () => {
        const targets = getBulkTargets()
        for (const t of targets) {
          const playing = libraryStatus.find(
            (st) =>
              st.appName === t.appName &&
              st.runner === t.runner &&
              st.status === 'playing'
          )
          if (playing) {
            await sendKill(t.appName, t.runner)
          }
        }
        clearLibrarySelection()
      },
      show: isPlaying,
      icon: <Cancel />
    },
    {
      // launch game
      label: t('label.playing.start'),
      onclick: async () => handlePlay(runner),
      show: isInstalled && !isPlaying && !isUpdating && !isQueued,
      icon: <PlayArrow />
    },
    {
      // update
      label: t('button.update', 'Update'),
      onclick: () => void runBulkUpdate(),
      show: hasUpdate && !isUpdating && !isQueued,
      icon: <Upgrade />
    },
    {
      // install
      label: t('button.install'),
      onclick: () => void runBulkInstallModals(),
      show: !isInstalled && !isQueued && isInstallable,
      icon: <Download />
    },
    {
      // cancel installation/update
      label: t('button.cancel'),
      onclick: async () => {
        const targets = getBulkTargets()
        for (const t of targets) {
          const st = libraryStatus.find(
            (s) => s.appName === t.appName && s.runner === t.runner
          )
          if (st && (st.status === 'installing' || st.status === 'updating')) {
            await sendKill(t.appName, t.runner)
          }
        }
        clearLibrarySelection()
      },
      show: isInstalling || isUpdating,
      icon: <Cancel />
    },
    {
      // open the game page
      label: t('button.details', 'Details'),
      onclick: () => {
        navigate(`/gamepage/${runner}/${appName}`, { state: { gameInfo } })
        clearLibrarySelection()
      },
      show: true,
      icon: <OpenInNew />
    },
    {
      // settings
      label: t('submenu.settings', 'Settings'),
      onclick: () => {
        openGameSettingsModal(gameInfo)
      },
      show: isInstalled && !isUninstalling && !isBrowserGame,
      icon: <Settings />
    },
    {
      label: t('submenu.logs', 'Logs'),
      onclick: () => {
        openGameLogsModal(gameInfo)
      },
      show: isInstalled && !isUninstalling && !isBrowserGame,
      icon: <Description />
    },
    {
      label: isSideloaded
        ? t('button.sideload.edit', 'Edit App/Game')
        : t('edit-game.title', 'Edit Game'),
      onclick: handleEdit,
      show: true,
      icon: <Edit />
    },
    {
      // hide
      label: t('button.hide_game', 'Hide Game'),
      onclick: () =>
        void (async () => {
          const targets = getBulkTargets()
          const alreadyHidden = new Set(
            hiddenGames.list.map((h: HiddenGame) => h.appName)
          )
          const toHide: HiddenGame[] = []
          for (const tg of targets) {
            if (alreadyHidden.has(tg.appName)) {
              continue
            }
            const info = await gameInfoForTarget(tg)
            toHide.push({
              appName: tg.appName,
              title: info?.title ?? tg.appName
            })
          }
          if (toHide.length) {
            hiddenGames.addGames(toHide)
          }
          clearLibrarySelection()
        })(),
      show: !isHiddenGame,
      icon: <VisibilityOff />
    },
    {
      // unhide
      label: t('button.unhide_game', 'Unhide Game'),
      onclick: () => {
        const targets = getBulkTargets()
        hiddenGames.removeGames(targets.map((tg) => tg.appName))
        clearLibrarySelection()
      },
      show: isHiddenGame,
      icon: <Visibility />
    },
    {
      label: t('button.add_to_favourites', 'Add To Favourites'),
      onclick: () =>
        void (async () => {
          const targets = getBulkTargets()
          const toAdd: FavouriteGame[] = []
          for (const tg of targets) {
            const info = await gameInfoForTarget(tg)
            toAdd.push({
              appName: tg.appName,
              title: info?.title ?? tg.appName
            })
          }
          if (toAdd.length) {
            favouriteGames.addGames(toAdd)
          }
          clearLibrarySelection()
        })(),
      show: !isFavouriteGame,
      icon: <Favorite />
    },
    {
      label: t('submenu.categories', 'Categories'),
      onclick: () => openCategoriesForSelection(),
      show: true,
      icon: <List />
    },
    {
      label: t('button.remove_from_favourites', 'Remove From Favourites'),
      onclick: () => {
        const targets = getBulkTargets()
        favouriteGames.removeGames(targets.map((tg) => tg.appName))
        clearLibrarySelection()
      },
      show: isFavouriteGame,
      icon: <FavoriteBorder />
    },
    {
      label: t('button.remove_from_recent', 'Remove From Recent'),
      onclick: async () => {
        const targets = getBulkTargets()
        for (const tg of targets) {
          await window.api.removeRecentGame(tg.appName)
        }
        clearLibrarySelection()
      },
      show: isRecent,
      icon: <PlaylistRemove />
    },
    {
      // uninstall
      label: t('button.uninstall'),
      onclick: onUninstallClick,
      show: isInstalled && !isUpdating && !isPlaying,
      icon: <DeleteForever />
    }
  ]

  const wrapperClasses = classNames(grid ? 'gameCard' : 'gameListItem', {
    installed: isInstalled,
    hidden: isHiddenGame,
    notAvailable: notAvailable,
    gamepad: activeController,
    justPlayed: justPlayed,
    libraryGameCardSelected: libraryGameSelected
  })

  const imgClasses = classNames('gameImg', { installed: isInstalled })
  const logoClasses = classNames('gameLogo', { installed: isInstalled })

  const showUpdateButton =
    hasUpdate && !isUpdating && !isQueued && !notAvailable

  if (!visible) {
    return (
      <div
        className={wrapperClasses}
        data-app-name={appName}
        data-invisible={true}
        data-tour={dataTour}
      ></div>
    )
  }

  const showSettingsButton = isInstalled && !isUninstalling && !isBrowserGame
  const showUpdateBadge =
    hasUpdate && !isUpdating && !isQueued && activeController

  return (
    <div>
      {uninstallModalGames && (
        <UninstallModal
          games={uninstallModalGames}
          onClose={() => {
            setUninstallModalGames(null)
            clearLibrarySelection()
          }}
        />
      )}
      <ContextMenu items={items}>
        <div
          className={wrapperClasses}
          data-app-name={appName}
          data-tour={dataTour}
          data-heroic-library-game-drag="1"
          draggable
          onClickCapture={(e) => {
            if (e.shiftKey) {
              e.preventDefault()
              e.stopPropagation()
              selectLibraryGamesWithShift(appName, runner)
              return
            }
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              e.stopPropagation()
              toggleLibraryGameInSelection()
            }
          }}
          onDragStart={(e) => {
            const games = gamesForLibraryDrag(
              appName,
              runner,
              getLibrarySelectionKeys()
            )
            e.dataTransfer.setData(
              HEROIC_LIBRARY_GAMES_DRAG_MIME,
              JSON.stringify({ games })
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
        >
          <div
            className={classNames('gameCardSelectCheckboxWrap', {
              'gameCardSelectCheckboxWrap--checked': libraryGameSelected
            })}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              size="small"
              className="gameCardSelectCheckbox"
              checked={libraryGameSelected}
              tabIndex={0}
              inputProps={{
                'aria-label': t2(
                  'library.selectGameCheckbox',
                  'Select game for categories and multi-drag'
                )
              }}
              sx={{
                padding: '4px',
                color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                '&.Mui-checked': {
                  color: 'var(--accent, #7fdfff)'
                }
              }}
              onChange={() => toggleLibraryGameInSelection()}
            />
          </div>
          {haveStatus && <span className="gameCardStatus">{label}</span>}
          {showUpdateBadge && (
            <span className="gameCardUpdateBadge">
              {t('status.hasUpdates')}
            </span>
          )}
          <Link
            to={`/gamepage/${runner}/${appName}`}
            state={{ gameInfo }}
            style={
              { '--installing-effect': installingGrayscale } as CSSProperties
            }
            onClick={() => useLibrarySelectionStore.getState().clear()}
          >
            <StoreLogos runner={runner} />
            {justPlayed ? (
              <CachedImage
                src={art_cover || fallBackImage}
                className="justPlayedImg"
                alt={title}
                draggable={false}
              />
            ) : (
              <CachedImage
                src={getImageFormatting(cover, runner)}
                className={imgClasses}
                alt="cover"
                draggable={false}
              />
            )}
            {(justPlayed || runner !== 'nile') && logo && (
              <CachedImage
                alt="logo"
                src={`${logo}?h=400&resize=1&w=300`}
                className={logoClasses}
                draggable={false}
              />
            )}
            {haveStatus && (
              <span
                className={classNames('gameListInfo', {
                  active: haveStatus,
                  installed: isInstalled
                })}
              >
                {label}
              </span>
            )}
            <span
              className={classNames('gameTitle', {
                active: haveStatus,
                installed: isInstalled
              })}
            >
              <span>{title}</span>
            </span>
            <span
              className={classNames('runner', {
                active: haveStatus,
                installed: isInstalled
              })}
            >
              {getStoreName(runner, t2('Other'))}
            </span>
          </Link>
          <>
            <span className="icons">
              {showUpdateButton && (
                <SvgButton
                  className="updateIcon"
                  title={`${t('button.update')} (${title})`}
                  onClick={() => void runBulkUpdate()}
                >
                  <FontAwesomeIcon size={'2x'} icon={faRepeat} />
                </SvgButton>
              )}
              {showSettingsButton && (
                <>
                  <SvgButton
                    title={`${t('submenu.settings')} (${title})`}
                    className="settingsIcon"
                    onClick={() => {
                      openGameSettingsModal(gameInfo)
                    }}
                  >
                    <SettingsIcon />
                  </SvgButton>
                </>
              )}
              {renderIcon()}
            </span>
          </>
        </div>
      </ContextMenu>
    </div>
  )

  async function handlePlay(runner: Runner) {
    const bulk = getBulkTargets()
    try {
      if (!isInstalled && !isQueued && gameInfo.runner !== 'sideload') {
        if (bulk.length > 1) {
          await runBulkInstallModalsInner()
          return
        }
        await install({
          gameInfo,
          installPath: folder || 'default',
          isInstalling,
          previousProgress,
          progress,
          t,
          showDialogModal
        })
        return
      }

      if (isPlaying || isUpdating) {
        if (bulk.length > 1) {
          for (const target of bulk) {
            const st = libraryStatus.find(
              (s) => s.appName === target.appName && s.runner === target.runner
            )
            if (st && (st.status === 'playing' || st.status === 'updating')) {
              await sendKill(target.appName, target.runner)
            }
          }
          return
        }
        await sendKill(appName, runner)
        return
      }

      if (isQueued) {
        if (bulk.length > 1) {
          for (const target of bulk) {
            storage.removeItem(target.appName)
            window.api.removeFromDMQueue(target.appName)
          }
          return
        }
        storage.removeItem(appName)
        window.api.removeFromDMQueue(appName)
        return
      }

      if (isInstalled) {
        setIsLaunching(true)
        try {
          const isOffline = connectivity.status !== 'online'
          if (bulk.length > 1) {
            for (const target of bulk) {
              const info = await gameInfoForTarget(target)
              if (!info?.is_installed) {
                continue
              }
              const hasUpd = Boolean(gameUpdates?.includes(target.appName))
              const notPlayableOffline = isOffline && !info.canRunOffline
              await launch({
                appName: target.appName,
                t,
                runner: target.runner,
                hasUpdate: hasUpd,
                showDialogModal,
                notPlayableOffline
              })
            }
          } else {
            const notPlayableOffline = isOffline && !gameInfo.canRunOffline
            await launch({
              appName,
              t,
              runner,
              hasUpdate,
              showDialogModal,
              notPlayableOffline
            })
          }
        } finally {
          setIsLaunching(false)
        }
      }
    } finally {
      clearLibrarySelection()
    }
  }
}

export default GameCard
