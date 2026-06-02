import { Tray, Menu, nativeImage, app } from 'electron'
import { getMainWindow, createMainWindow } from './windows'
import { log } from './log'

// Monochrome waveform template icon (renders correctly in light/dark menu bars).
const TRAY_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABmJLR0QA/wD/AP+gvaeTAAAAsUlEQVQ4je2TzQkCMRCFP1TUCixDTyJ4sINtQsFaLEKtwwYEwQa8edcG1pNe3mEZkuxEInjYDx6ZkLzHkB/o+CdWUnFukotey3oFzFSPpCLUwEn1XQLYAeeU0XY8ATZAX/NYlwtgGfEEg9fAHpinuvF4bPDYjB6CnrbL+xobXJvRQ9AzMJuOwBO4ZgQHPTb4ARwa85dkuQDDiMdFBUxVN99xUbK+tD2KFFvgnd1Ox8/4AKGaHyuRg9/aAAAAAElFTkSuQmCC'

let tray: Tray | null = null

function openMain(): void {
  const mw = getMainWindow() ?? createMainWindow()
  mw.show()
  mw.focus()
}

/** Menu-bar tray icon with quick actions (best-effort — never blocks startup). */
export function createTray(): void {
  if (tray) return
  try {
    const img = nativeImage.createFromDataURL(TRAY_ICON)
    img.setTemplateImage(true)
    tray = new Tray(img)
    tray.setToolTip('Voice Reply Assistant')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Voice Reply', click: openMain },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
    )
    tray.on('click', openMain)
  } catch (e) {
    log.warn('[tray] could not create tray:', (e as Error).message)
  }
}
