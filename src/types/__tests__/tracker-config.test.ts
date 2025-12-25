import { describe, it, expect } from 'vitest'
import { createIntensityLabelFn, createIntensityColorFn } from '../tracker-config'

describe('Intensity helpers', () => {
  it('createIntensityLabelFn returns correct labels for thresholds', () => {
    const labels: [string, string, string, string, string] = ['A','B','C','D','E']
    const fn = createIntensityLabelFn(labels)

    expect(fn(0)).toBe('A')
    expect(fn(2)).toBe('A')
    expect(fn(3)).toBe('B')
    expect(fn(5)).toBe('C')
    expect(fn(7)).toBe('D')
    expect(fn(9)).toBe('E')
    expect(fn(10)).toBe('E')
  })

  it('createIntensityColorFn returns correct color from palette', () => {
    const colors: [string,string,string,string,string] = ['c0','c1','c2','c3','c4']
    const fn = createIntensityColorFn(colors)

    expect(fn(1)).toBe('c0')
    expect(fn(2)).toBe('c0')
    expect(fn(3)).toBe('c1')
    expect(fn(6)).toBe('c2')
    expect(fn(8)).toBe('c3')
    expect(fn(10)).toBe('c4')
  })
})