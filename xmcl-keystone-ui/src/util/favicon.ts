import { ServerStatus } from '@xmcl/runtime-api'
import { BuiltinImages } from '@/constant'
import { InstanceData } from '@xmcl/instance'

export function getInstanceIcon(instance: InstanceData, status: ServerStatus | undefined) {
  if (status?.favicon && status?.favicon !== BuiltinImages.unknownServer) {
    return status?.favicon
  } else if (instance.server) {
    return BuiltinImages.unknownServer
  }
  if (!instance.icon) {
    if (instance.edition === 'bedrock') {
      return BuiltinImages.bedrock
    }
    if (instance.runtime.forge) {
      return BuiltinImages.forge
    } else if (instance.runtime.neoForged) {
      return BuiltinImages.neoForged
    } else if (instance.runtime.labyMod) {
      return BuiltinImages.labyMod
    } else if (instance.runtime.fabricLoader) {
      return BuiltinImages.fabric
    } else if (instance.runtime.quiltLoader) {
      return BuiltinImages.quilt
    } else if (instance.runtime.optifine) {
      return BuiltinImages.optifine
    } else if (instance.runtime.minecraft) {
      return BuiltinImages.minecraft
    } else {
      return BuiltinImages.craftingTable
    }
  }
  return instance.icon
}

/**
 * Convert an instance icon URL to a PNG data URL.
 *
 * `LaunchService.createLaunchShortcut` pipes the fetched bytes straight into
 * `png2icons.createICO`, which returns `null` for anything that is not a PNG.
 * When that happens the raw source bytes (the builtin icons are `.webp`) get
 * written to the instance `icon.ico`, permanently corrupting it. Callers must
 * therefore normalize to PNG before handing the icon to the main process.
 *
 * Returns the input unchanged when it is not webp or when the image cannot be
 * decoded, so a broken favicon degrades to a plain icon instead of hanging.
 */
export async function toPngIconUrl(icon: string): Promise<string> {
  if (!icon.endsWith('.webp')) {
    return icon
  }
  const decoded = await new Promise<HTMLImageElement | undefined>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined)
    img.src = icon
  })
  if (!decoded) {
    return icon
  }
  const canvas = document.createElement('canvas')
  canvas.width = decoded.width
  canvas.height = decoded.height
  canvas.getContext('2d')?.drawImage(decoded, 0, 0)
  return canvas.toDataURL('image/png')
}
