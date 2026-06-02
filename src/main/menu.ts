import { Menu, MenuItemConstructorOptions } from 'electron'

/**
 * A standard macOS app menu. Importantly this guarantees the Edit menu
 * (Copy/Paste/Select All + their shortcuts) works in text fields like the
 * API-key inputs.
 */
export function setAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
