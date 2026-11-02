<template>
  <div class="absolute z-0 h-full w-full">
    <transition
      name="fade-transition"
    >
      <video
        v-if="customBackgroundVideo"
        ref="videoRef"
        :key="`custom-video-${customBackgroundVideo}`"
        class="absolute z-0 h-full w-full object-cover"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
        :src="customBackgroundVideo"
        autoplay
        loop
        playsinline
        :muted="isMuted"
      />
      <Particles
        v-else-if="backgroundType === BackgroundType.PARTICLE"
        color="#dedede"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)` }"
        :click-mode="particleMode"
      />
      <Halo
        v-else-if="backgroundType === BackgroundType.HALO"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)` }"
      />
      <img
        v-else-if="backgroundImage?.type === 'image' && backgroundType === BackgroundType.IMAGE"
        :key="backgroundImage.url"
        :src="backgroundImage.url"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
      >
      <video
        v-else-if="backgroundImage?.type === 'video' && backgroundType === BackgroundType.VIDEO"
        ref="videoRef"
        :key="`video-${backgroundImage.url}`"
        class="absolute z-0 h-full w-full object-cover"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
        :src="backgroundImage.url"
        autoplay
        loop
        playsinline
        :muted="isMuted"
      />
    </transition>

    <transition
      name="fade-transition"
    >
      <div
        v-if="((backgroundColorOverlay && !isHome) || backgroundType === BackgroundType.NONE) && !customBackgroundVideo"
        class="z-3 absolute h-full w-full"
        :style="{ 'background': backgroundColor }"
      />
    </transition>
  </div>
</template>
<script lang="ts" setup>
import { injection } from '@/util/inject'
import { kTheme, BackgroundType } from '@/composables/theme'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kCustomCss } from '@/composables/customCss'
import { defineAsyncComponent, inject } from 'vue'

// Disco (memory): Halo pulls in `three` (~0.5 MB of JS plus its WebGL
// runtime and shader programs) and Particles pulls in the particle canvas
// engine. Both are only ever needed when the user actually picks that
// background, so keep them out of the initial bundle - the chunk is fetched
// the first time that background type is selected, not on every launch.
const Halo = defineAsyncComponent(() => import('@/components/Halo.vue'))
const Particles = defineAsyncComponent(() => import('@/components/Particles.vue'))

const customCss = inject(kCustomCss)
const customBackgroundVideo = computed(() => customCss?.customBackgroundVideo.value || '')

const { sideBarColor, backgroundColorOverlay, backgroundColor, blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume } = injection(kTheme)
const videoRef = ref(null as null | HTMLVideoElement)
const isMuted = computed(() => volume.value <= 0)

const route = useRoute()
const isHome = computed(() => route.path === '/')

watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume
  }
})

const { gameProcesses } = injection(kInstanceLaunch)

watch(computed(() => gameProcesses.value.length), (cur, last) => {
  if (cur > 0 && last === 0) {
    videoRef.value?.pause()
  } else if (cur === 0 && last > 0) {
    videoRef.value?.play()
  }
})

watch(videoRef, (v) => {
  if (v) {
    v.volume = volume.value
  }
})

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }
})

// Disco (memory): this watcher only existed to log the background switches to
// the console. Debug logging here runs on every background change and keeps
// the previous media URL referenced, so drop it entirely.


</script>
<style scoped>
.img-container {
  background: radial-gradient(ellipse at top right, transparent, v-bind(sideBarColor) 72%);
  position: absolute;
  min-width: 100%;
  min-height: 100%;
  z-index: 4;
}
</style>
