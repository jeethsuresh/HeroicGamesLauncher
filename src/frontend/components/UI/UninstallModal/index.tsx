import './index.scss'
import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader
} from 'frontend/components/UI/Dialog'
import { useTranslation } from 'react-i18next'
import { Runner } from 'common/types'
import ToggleSwitch from '../ToggleSwitch'
import { useNavigate, useLocation } from 'react-router-dom'
import ContextProvider from 'frontend/state/ContextProvider'

export type UninstallModalGame = {
  appName: string
  runner: Runner
  isDlc: boolean
}

interface UninstallModalProps {
  games: UninstallModalGame[]
  onClose: () => void
}

const UninstallModal: React.FC<UninstallModalProps> = function ({
  games,
  onClose
}) {
  const primary = games[0]!
  const { appName, runner, isDlc: primaryIsDlc } = primary

  const [isNative, setIsNative] = useState(true)
  const [winePrefix, setWinePrefix] = useState('')
  const [deletePrefixChecked, setDeletePrefixChecked] = useState(false)
  const [deleteSettingsChecked, setDeleteSettingsChecked] = useState(false)
  const [disableDeleteWine, setDisableDeleteWine] = useState(false)
  const { t } = useTranslation('gamepage')
  const [showUninstallModal, setShowUninstallModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { installingEpicGame, libraryStatus } = useContext(ContextProvider)
  const [gameTitle, setGameTitle] = useState('')
  const isBulk = games.length > 1

  const anyLegendary = useMemo(
    () => games.some((g) => g.runner === 'legendary'),
    [games]
  )

  const isGameRunning = useMemo(
    () =>
      games.some((g) =>
        libraryStatus.find(
          (st) =>
            st.appName === g.appName &&
            st.runner === g.runner &&
            st.status === 'playing'
        )
      ),
    [games, libraryStatus]
  )

  const checkIfIsNative = async () => {
    setShowUninstallModal(true)

    if (isBulk) {
      const titles = await Promise.all(
        games.map(async (g) => {
          const gameInfo = await window.api.getGameInfo(g.appName, g.runner)
          return gameInfo?.title ?? g.appName
        })
      )
      setGameTitle(titles.join(', '))
      setIsNative(true)
      return
    }

    const gameInfo = await window.api.getGameInfo(appName, runner)

    const native = await window.api.isNative({
      runner,
      appName
    })
    setIsNative(native)

    if (primaryIsDlc) {
      return
    }

    if (!gameInfo) {
      return
    }

    setGameTitle(gameInfo.overrides?.title || gameInfo.title)

    const { install } = gameInfo
    if (install.platform?.toLowerCase() !== 'windows') {
      return
    }

    const gameSettings = await window.api.getGameSettings(appName, runner)
    if (!gameSettings) {
      return
    }

    const defaultSettings = await window.api.requestGameSettings('default')

    setWinePrefix(gameSettings.winePrefix)
    setDisableDeleteWine(gameSettings.winePrefix === defaultSettings.winePrefix)
  }

  useEffect(() => {
    void checkIfIsNative()
  }, [])

  const storage: Storage = window.localStorage
  const uninstallGame = async () => {
    const allowPrefix =
      !isBulk && !primaryIsDlc && deletePrefixChecked && !isNative

    let didNavigateFromSideload = false
    for (const g of games) {
      await window.api.uninstall(
        g.appName,
        g.runner,
        g.isDlc ? false : allowPrefix,
        deleteSettingsChecked
      )
      if (
        g.runner === 'sideload' &&
        location.pathname.match(/gamepage/) &&
        !didNavigateFromSideload
      ) {
        navigate('/#library')
        didNavigateFromSideload = true
      }
      storage.removeItem(g.appName)
    }
    onClose()
  }

  const showWineCheckbox = !isBulk && !isNative && !primaryIsDlc

  if (installingEpicGame && anyLegendary) {
    return (
      <>
        {showUninstallModal && (
          <Dialog onClose={onClose} showCloseButton className="uninstall-modal">
            <DialogHeader onClose={onClose}>
              {t('gamepage:box.uninstall.title')}
            </DialogHeader>
            <DialogContent>
              {t(
                'gamepage:box.uninstall.cannotUninstallEpic',
                'Epic games cannot be uninstalled while another Epic game is being installed.'
              )}
            </DialogContent>
            <DialogFooter>
              <button onClick={onClose} className={`button outline`}>
                {t('box.close', 'Close')}
              </button>
            </DialogFooter>
          </Dialog>
        )}
      </>
    )
  }

  if (isGameRunning) {
    return (
      <>
        {showUninstallModal && (
          <Dialog onClose={onClose} showCloseButton className="uninstall-modal">
            <DialogHeader onClose={onClose}>
              {t('gamepage:box.uninstall.title')}
            </DialogHeader>
            <DialogContent>
              {t('gamepage:box.uninstall.gameIsRunning', {
                defaultValue:
                  '{{title}} is running. Close the game to uninstall it.',
                title: gameTitle
              })}
            </DialogContent>
            <DialogFooter>
              <button onClick={onClose} className={`button outline`}>
                {t('box.close', 'Close')}
              </button>
            </DialogFooter>
          </Dialog>
        )}
      </>
    )
  }

  return (
    <>
      {showUninstallModal && (
        <Dialog onClose={onClose} showCloseButton className="uninstall-modal">
          <DialogHeader onClose={onClose}>
            {t('gamepage:box.uninstall.title')}
          </DialogHeader>
          <DialogContent>
            <div className="uninstallModalMessage">
              {isBulk
                ? t('box.uninstall.messageBulk', {
                    count: games.length,
                    titles: gameTitle
                  })
                : primaryIsDlc
                  ? t('gamepage:box.uninstall.dlc', {
                      defaultValue:
                        'Do you want to uninstall "{{title}}" (DLC)?',
                      title: gameTitle
                    })
                  : t('gamepage:box.uninstall.message', {
                      defaultValue: 'Do you want to uninstall "{{title}}"?',
                      title: gameTitle
                    })}
            </div>
            {showWineCheckbox && (
              <ToggleSwitch
                htmlId="uninstallCheckbox"
                value={deletePrefixChecked}
                title={t('gamepage:box.uninstall.checkbox', {
                  defaultValue:
                    "Remove prefix: {{prefix}}{{newLine}}Note: This can't be undone and will also remove not backed up save files.",
                  prefix: winePrefix,
                  newLine: '\n'
                })}
                disabled={disableDeleteWine}
                handleChange={() => {
                  setDeletePrefixChecked(!deletePrefixChecked)
                }}
              />
            )}
            {disableDeleteWine && (
              <p className="default-wine-warning">
                {t(
                  'gamepage:box.uninstall.prefix_warning',
                  'The Wine prefix for this game is the default prefix. If you really want to delete it, you have to do it manually.'
                )}
              </p>
            )}
            {games.some((g) => !g.isDlc) && (
              <ToggleSwitch
                htmlId="uninstallsettingCheckbox"
                value={deleteSettingsChecked}
                title={t('gamepage:box.uninstall.settingcheckbox', {
                  defaultValue:
                    "Erase settings and remove log{{newLine}}Note: This can't be undone. Any modified settings will be forgotten and log will be deleted.",
                  newLine: '\n'
                })}
                handleChange={() => {
                  setDeleteSettingsChecked(!deleteSettingsChecked)
                }}
              />
            )}
          </DialogContent>
          <DialogFooter>
            <button
              onClick={uninstallGame}
              className={`button is-secondary outline`}
            >
              {t('box.yes')}
            </button>
            <button onClick={onClose} className={`button is-secondary outline`}>
              {t('box.no')}
            </button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  )
}

export default UninstallModal
