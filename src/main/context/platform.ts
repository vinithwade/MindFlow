import * as mac from './macos'
import * as win from './windows'

/**
 * Platform dispatch for the context/automation primitives. Both impls export
 * identical signatures; everything outside this folder imports from here so
 * pipeline/insert/ocr stay platform-agnostic. Non-win32 falls back to the mac
 * impl (its helpers fail soft into empty results on unsupported platforms).
 */
const impl = process.platform === 'win32' ? win : mac

export const getFrontApp = impl.getFrontApp
export const getSelectedText = impl.getSelectedText
export const getAccessibilityText = impl.getAccessibilityText
export const sendPaste = impl.sendPaste
export const sendEnter = impl.sendEnter
export const activateProcess = impl.activateProcess
export const screenshotToFile = impl.screenshotToFile
