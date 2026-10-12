import { describe, expect, it } from 'vitest'
import { compareMinecraftVersion, isMinecraftUpdateAvailable, isModdedInstance } from './minecraftUpdate'

describe('compareMinecraftVersion', () => {
  it('orders releases numerically, not lexically', () => {
    // The whole point: "1.9" > "1.10" as a string, but is an older release.
    expect(compareMinecraftVersion('1.9', '1.10')).toBe(-1)
    expect(compareMinecraftVersion('1.10', '1.9')).toBe(1)
  })

  it('orders patch versions', () => {
    expect(compareMinecraftVersion('1.21.4', '1.21.5')).toBe(-1)
    expect(compareMinecraftVersion('1.21.5', '1.21.4')).toBe(1)
    expect(compareMinecraftVersion('1.21.10', '1.21.9')).toBe(1)
  })

  it('treats missing segments as zero', () => {
    expect(compareMinecraftVersion('1.21', '1.21.0')).toBe(0)
    expect(compareMinecraftVersion('1.21', '1.21.1')).toBe(-1)
  })

  it('is not comparable across major versions by string length', () => {
    expect(compareMinecraftVersion('1.8.9', '1.21.5')).toBe(-1)
    expect(compareMinecraftVersion('1.21.5', '1.8.9')).toBe(1)
  })

  it('refuses to order snapshots and pre-releases', () => {
    expect(compareMinecraftVersion('25w31a', '1.21.5')).toBe(0)
    expect(compareMinecraftVersion('1.21.5-pre1', '1.21.5')).toBe(0)
    expect(compareMinecraftVersion('1.21.5', '1.21.5-pre1')).toBe(0)
  })

  it('returns 0 for identical versions', () => {
    expect(compareMinecraftVersion('1.21.5', '1.21.5')).toBe(0)
  })
})

describe('isMinecraftUpdateAvailable', () => {
  it('is true only when the latest is strictly newer', () => {
    expect(isMinecraftUpdateAvailable('1.21.5', '1.21.4')).toBe(true)
    expect(isMinecraftUpdateAvailable('1.21.4', '1.21.5')).toBe(false)
    expect(isMinecraftUpdateAvailable('1.21.5', '1.21.5')).toBe(false)
  })

  it('never nags a snapshot instance into a release', () => {
    expect(isMinecraftUpdateAvailable('1.21.5', '25w31a')).toBe(false)
  })

  it('needs both sides', () => {
    expect(isMinecraftUpdateAvailable(undefined, '1.21.4')).toBe(false)
    expect(isMinecraftUpdateAvailable('1.21.5', undefined)).toBe(false)
  })
})

describe('isModdedInstance', () => {
  it('detects every supported loader', () => {
    expect(isModdedInstance({ runtime: { fabricLoader: '0.15.0' } } as any)).toBe(true)
    expect(isModdedInstance({ runtime: { forge: '51.0.33' } } as any)).toBe(true)
    expect(isModdedInstance({ runtime: { quiltLoader: '0.20.0' } } as any)).toBe(true)
    expect(isModdedInstance({ runtime: { neoForged: '21.1.0' } } as any)).toBe(true)
  })

  it('is false for vanilla and for a missing instance', () => {
    expect(isModdedInstance({ runtime: { minecraft: '1.21.5' } } as any)).toBe(false)
    expect(isModdedInstance(undefined)).toBe(false)
  })
})
