<template>
  <canvas
    ref="canvasRef"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event)"
  />
</template>

<script lang="ts" setup>
// G2: skinview3d'yi ihtiyaç anında yükle — dynamic import (bundle splitting)
let skinview3dModule: typeof import('skinview3d') | undefined
async function getSkinview3d() {
  if (!skinview3dModule) skinview3dModule = await import('skinview3d')
  return skinview3dModule
}

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  cape?: string
  skin?: string
  slim?: boolean
  name?: string
  animation?: 'walking' | 'none' | 'idle' | 'running'
  paused?: boolean
}>(), {
  width: 210,
  height: 400,
  slim: undefined,
  cape: undefined,
  name: 'Steve',
  skin: '',
  animation: 'idle',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const data = { disposed: false }
// G2: Animasyon constructor'ı yalnızca viewer yüklenince oluşturulur.
// Dış computed'ı sync tutuyoruz; animation değişimi watcher'la yapılır.
const animationObject = ref<any>(null)

onUnmounted(() => {
  data.disposed = true
  if (skinview3dModule) {
    if (viewer) viewer.dispose()
  }
})

const emit = defineEmits(['model', 'dragover', 'drop', 'error'])

let viewer: import('skinview3d').SkinViewer | undefined
let lastLoad = Promise.resolve()
let lastCapeLoad = Promise.resolve()

function createAnimation(x: 'walking' | 'none' | 'idle' | 'running') {
  const mod = skinview3dModule
  if (!mod) return null
  switch (x) {
    case 'walking': return new (mod as any).WalkingAnimation()
    case 'idle': return new (mod as any).IdleAnimation()
    case 'running': return new (mod as any).RunningAnimation()
    default: return null
  }
}

async function loadSkin() {
  const skinview3d = await getSkinview3d()
  const activeViewer = viewer
  if (!activeViewer || data.disposed) return
  const url = props.skin

  await lastLoad.catch(() => undefined)
  const load = (activeViewer as any).loadSkin(url, {
    model: typeof props.slim === 'undefined' ? 'auto-detect' : props.slim ? 'slim' : 'default',
  })
  lastLoad = load
  try {
    await load
    if (viewer === activeViewer && !data.disposed) {
      emit('model', (activeViewer as any).playerObject.skin.modelType)
    }
  } catch (e) {
    if (e instanceof Error && /^Bad skin size: \d+x\d+$/.test(e.message)) {
      emit('error', 'invalid-skin-size')
      return
    }
    emit('error', 'load-failed')
  }
}

onMounted(async () => {
  if (!canvasRef.value) return
  const mod = await getSkinview3d()
  if (data.disposed) return

  viewer = new mod.SkinViewer({
    canvas: canvasRef.value!,
    width: props.width,
    height: props.height,
    nameTag: props.name || undefined,
    fov: 45,
    zoom: 0.5,
  })

  viewer.animation = animationObject.value // Still null on first mount, set below
  viewer.renderPaused = props.paused ?? false
  viewer.animation = createAnimation(props.animation) ?? null

  loadSkin()
  if (props.cape) {
    lastCapeLoad = (viewer as any).loadCape(props.cape).catch((e: any) => {
      console.warn('[SkinView] Failed to load cape texture:', e)
    })
  }
})

watch(animationObject, (v) => { if (viewer) viewer.animation = v })
watch(() => props.skin, loadSkin)
watch(() => props.slim, loadSkin)
watch(() => props.cape, (v) => {
  const activeViewer = viewer
  if (!activeViewer) return
  if (v) {
    lastCapeLoad = lastCapeLoad.finally(() => (activeViewer as any).loadCape(v).catch((e: any) => {
      console.warn('[SkinView] Failed to load cape texture:', e)
    }))
  } else {
    (activeViewer as any).resetCape()
  }
})
watch(() => props.name, (v) => { if (viewer) viewer.nameTag = v || null })
watch(() => props.paused, (paused) => {
  if (!viewer) return
  viewer.renderPaused = paused ?? false
})
</script>