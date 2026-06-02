import { systemPreferences, shell } from 'electron'
import { PermissionKind, PermissionState, PermissionStatus } from '../shared/types'

/**
 * macOS privacy permissions the app needs:
 *  - microphone   → to hear you (required)
 *  - accessibility → global hold-to-talk hook + sending copy/paste keystrokes (required)
 *  - screen       → OCR fallback only (optional)
 */

function mediaToState(
  status: 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
): PermissionState {
  if (status === 'granted') return 'granted'
  if (status === 'denied' || status === 'restricted') return 'denied'
  return 'unknown'
}

export function getPermissionStatus(): PermissionStatus {
  if (process.platform !== 'darwin') {
    return { microphone: 'granted', accessibility: 'granted', screen: 'granted' }
  }
  return {
    microphone: mediaToState(systemPreferences.getMediaAccessStatus('microphone')),
    accessibility: systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'unknown',
    screen: mediaToState(systemPreferences.getMediaAccessStatus('screen'))
  }
}

/**
 * Trigger the right consent flow per permission. Mic shows the native prompt;
 * accessibility/screen can't be granted programmatically, so we prompt once
 * (accessibility) and/or open the relevant System Settings pane.
 */
export async function requestPermission(kind: PermissionKind): Promise<void> {
  if (process.platform !== 'darwin') return
  switch (kind) {
    case 'microphone':
      await systemPreferences.askForMediaAccess('microphone').catch(() => undefined)
      break
    case 'accessibility':
      // Passing `true` surfaces the system prompt to add the app.
      systemPreferences.isTrustedAccessibilityClient(true)
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      )
      break
    case 'screen':
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      )
      break
  }
}
