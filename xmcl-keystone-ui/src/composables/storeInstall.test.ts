import type { File, FileModLoaderType } from '@xmcl/curseforge'
import type { ProjectVersion } from '@xmcl/modrinth'
import { describe, expect, it } from 'vitest'
import { pickCurseforgeFile, pickModrinthVersion } from './storeInstall'

function modrinthVersion(id: string, gameVersions: string[], loaders: string[]): ProjectVersion {
  return {
    id,
    name: `v${id}`,
    game_versions: gameVersions,
    loaders,
  } as unknown as ProjectVersion
}

describe('pickModrinthVersion', () => {
  const versions = [
    modrinthVersion('1', ['1.21.1'], ['neoforge']),
    modrinthVersion('2', ['1.21.1'], ['fabric', 'quilt']),
    modrinthVersion('3', ['1.20.1'], ['fabric']),
  ]

  it('picks the newest version matching both the game version and the loader', () => {
    const pick = pickModrinthVersion(versions, '1.21.1', ['fabric'], 'mod')
    expect(pick.status).toBe('ok')
    if (pick.status === 'ok') {
      expect(pick.target.id).toBe('2')
    }
  })

  it('reports no-version when nothing supports the game version', () => {
    expect(pickModrinthVersion(versions, '1.12.2', ['fabric'], 'mod')).toEqual({ status: 'no-version' })
  })

  it('reports loader-mismatch when only the loader is wrong', () => {
    expect(pickModrinthVersion(versions, '1.20.1', ['forge'], 'mod')).toEqual({ status: 'loader-mismatch' })
  })

  it('treats a loader-less instance as a loader mismatch for mods', () => {
    expect(pickModrinthVersion(versions, '1.21.1', [], 'mod')).toEqual({ status: 'loader-mismatch' })
  })

  it('ignores the loader for resource packs', () => {
    const pick = pickModrinthVersion(versions, '1.21.1', [], 'resourcepack')
    expect(pick.status).toBe('ok')
    if (pick.status === 'ok') {
      expect(pick.target.id).toBe('1')
    }
  })

  it('skips the game version filter for an instance without a version', () => {
    const pick = pickModrinthVersion(versions, '', ['fabric'], 'mod')
    expect(pick.status).toBe('ok')
  })

  it('reports no-version for an empty version list', () => {
    expect(pickModrinthVersion([], '1.21.1', ['fabric'], 'mod')).toEqual({ status: 'no-version' })
  })
})

describe('pickCurseforgeFile', () => {
  const files = [
    { id: 1, gameVersions: ['1.21.1'], sortableGameVersions: [{ gameVersionName: 'NeoForge' }] },
    { id: 2, gameVersions: ['1.21.1'], sortableGameVersions: [{ gameVersionName: 'Fabric' }] },
  ] as unknown as File[]

  const typesOf = (file: File) => {
    const set = new Set<FileModLoaderType>()
    for (const ver of file.sortableGameVersions ?? []) {
      if (ver.gameVersionName === 'Fabric') set.add(4 as FileModLoaderType)
      if (ver.gameVersionName === 'NeoForge') set.add(6 as FileModLoaderType)
    }
    return set
  }

  it('picks the first file matching the loader', () => {
    const pick = pickCurseforgeFile(files, 4 as FileModLoaderType, 'mod', typesOf)
    expect(pick.status).toBe('ok')
    if (pick.status === 'ok') {
      expect(pick.target.id).toBe(2)
    }
  })

  it('reports loader-mismatch for a loader-less instance (mods)', () => {
    expect(pickCurseforgeFile(files, undefined, 'mod', typesOf)).toEqual({ status: 'loader-mismatch' })
  })

  it('ignores the loader for resource packs', () => {
    const pick = pickCurseforgeFile(files, undefined, 'resourcepack', typesOf)
    expect(pick.status).toBe('ok')
    if (pick.status === 'ok') {
      expect(pick.target.id).toBe(1)
    }
  })

  it('reports no-version for an empty file list', () => {
    expect(pickCurseforgeFile([], 4 as FileModLoaderType, 'mod', typesOf)).toEqual({ status: 'no-version' })
  })
})
