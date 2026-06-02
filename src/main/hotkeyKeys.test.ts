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

describe('labelFor', () => {
  it('labels Fn as "Fn"', () => expect(labelFor(['FN'])).toBe('Fn'))
  it('labels a combo with symbols, modifier first', () =>
    expect(labelFor(['SPACE', 'LEFT META'])).toBe('⌘ + Space'))
  it('uppercases a single letter', () => expect(labelFor(['a'])).toBe('A'))
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
