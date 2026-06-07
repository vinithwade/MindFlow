/** Renderer-side platform flags (from the preload bridge). */
export const IS_WIN = window.api.platform === 'win32'
export const IS_MAC = !IS_WIN

/** Label for the "regenerate" shortcut, matching the ⌘/Ctrl handler. */
export const REGEN_KEY_LABEL = IS_WIN ? 'Ctrl R' : '⌘R'
