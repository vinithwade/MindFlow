/**
 * Pure helpers for turning node-global-key-listener key names into a stable
 * order + a human label, and deciding which keys are safe to fully intercept.
 * Kept free of Electron imports so it's unit-testable.
 */

const SYMBOLS: Record<string, string> = {
  FN: 'Fn',
  SPACE: 'Space',
  RETURN: '⏎',
  TAB: '⇥',
  'LEFT META': '⌘',
  'RIGHT META': '⌘',
  'LEFT CTRL': '⌃',
  'RIGHT CTRL': '⌃',
  'LEFT ALT': '⌥',
  'RIGHT ALT': '⌥',
  'LEFT SHIFT': '⇧',
  'RIGHT SHIFT': '⇧'
}

// Windows users expect words, not mac glyphs. Everything else falls back to
// titleCase ("Right Ctrl", "Left Shift"), which keeps left/right distinct —
// the listener matches exact key names, so the label should too.
const WIN_SYMBOLS: Record<string, string> = {
  RETURN: 'Enter',
  TAB: 'Tab',
  'LEFT META': 'Win',
  'RIGHT META': 'Win'
}

// Modifiers/Fn read first, like a normal shortcut.
const PRIORITY = [
  'FN',
  'LEFT CTRL',
  'RIGHT CTRL',
  'LEFT ALT',
  'RIGHT ALT',
  'LEFT SHIFT',
  'RIGHT SHIFT',
  'LEFT META',
  'RIGHT META'
]

export function orderKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = PRIORITY.indexOf(a)
    const ib = PRIORITY.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

function titleCase(k: string): string {
  if (k.length === 1) return k.toUpperCase()
  return k
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function labelFor(keys: string[], platform: string = process.platform): string {
  const symbols = platform === 'win32' ? WIN_SYMBOLS : SYMBOLS
  return orderKeys(keys)
    .map((k) => symbols[k] ?? titleCase(k))
    .join(' + ')
}

/** Keys safe to fully intercept (no typing/modifier side effects). */
export function isSuppressible(name: string): boolean {
  return name === 'FN' || /^F([1-9]|1[0-9]|2[0-4])$/.test(name)
}
