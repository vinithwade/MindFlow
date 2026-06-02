import { app, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { log } from './log'

const { autoUpdater } = electronUpdater

/**
 * Auto-update via electron-updater. Reads the feed from the `publish` config
 * baked into app-update.yml at build time (see package.json → build.publish).
 *
 * Notes:
 *  - Only runs in a packaged build (the updater can't run from `npm run dev`).
 *  - On macOS, updates require the app to be code-signed + notarized — Squirrel
 *    validates the signature. So this becomes fully functional once signing is
 *    configured (see SIGNING.md).
 */
let started = false

export function initAutoUpdater(): void {
  if (!app.isPackaged || started) return
  started = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) =>
    log.warn('[updater] error:', err == null ? 'unknown' : (err.message ?? err))
  )
  autoUpdater.on('checking-for-update', () => log.info('[updater] checking…'))
  autoUpdater.on('update-available', (info) =>
    log.info('[updater] update available:', info.version)
  )
  autoUpdater.on('update-not-available', () => log.info('[updater] up to date'))
  autoUpdater.on('download-progress', (p) =>
    log.info(`[updater] downloading ${Math.round(p.percent)}%`)
  )
  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update ready',
        message: `Voice Reply Assistant ${info.version} is ready to install.`,
        detail: 'Restart the app to finish updating.'
      })
      .then((res) => {
        if (res.response === 0) autoUpdater.quitAndInstall()
      })
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch((e) => log.warn('[updater] check failed:', e?.message))
  }

  // Check shortly after launch, then every 6 hours.
  setTimeout(check, 10_000)
  setInterval(check, 6 * 60 * 60 * 1000)
}
