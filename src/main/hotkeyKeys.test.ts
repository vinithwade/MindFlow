import { describe, it, expect } from 'vitest'
import { orderKeys, labelFor, isSuppressible } from './hotkeyKeys'

describe('orderKeys', () => {
  it('puts modifiers/Fn before regular keys', () => {
    expect(orderKeys(['A', 'LEFT META'])).toEqual(['LEFT META', 'A'])
    expect(orderKeys(['SPACE', 'LEFT CTRL', 'LEFT SHIFT'])).toEqual([
      'LEFT CTRL',
      'LEFT SHIFT',
      'SPACE'
    ])
  })
})

// labelFor is platform-aware (mac glyphs vs Windows words) — always pin the
// platform in tests so they pass on any CI runner.
describe('labelFor', () => {
  it('labels Fn as "Fn"', () => expect(labelFor(['FN'], 'darwin')).toBe('Fn'))
  it('labels a mac combo with glyphs, modifier first', () =>
    expect(labelFor(['SPACE', 'LEFT META'], 'darwin')).toBe('⌘ + Space'))
  it('labels a Windows combo with words, modifier first', () =>
    expect(labelFor(['SPACE', 'LEFT META'], 'win32')).toBe('Win + Space'))
  it('keeps left/right distinct on Windows', () =>
    expect(labelFor(['RIGHT ALT'], 'win32')).toBe('Right Alt'))
  it('uppercases a single letter', () => expect(labelFor(['a'], 'darwin')).toBe('A'))
})

describe('isSuppressible', () => {
  it('is true for Fn and function keys only', () => {
    expect(isSuppressible('FN')).toBe(true)
    expect(isSuppressible('F5')).toBe(true)
    expect(isSuppressible('F13')).toBe(true)
    expect(isSuppressible('F24')).toBe(true)
  })
  it('is false for modifiers and letters', () => {
    expect(isSuppressible('LEFT META')).toBe(false)
    expect(isSuppressible('A')).toBe(false)
    expect(isSuppressible('SPACE')).toBe(false)
    expect(isSuppressible('F25')).toBe(false)
  })
})
