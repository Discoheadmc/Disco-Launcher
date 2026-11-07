<template>
  <!-- Disco: minimal pixel icons, drawn as inline SVG on a 16x16 grid. No new
       dependency, no external font - each icon is a list of 2px blocks, the way
       a Minecraft item icon is a list of pixels. `shape-rendering: crispEdges`
       keeps the blocks hard-edged at any size instead of blurring them. -->
  <svg
    class="disco-icon"
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="currentColor"
    shape-rendering="crispEdges"
    role="presentation"
    :aria-hidden="true"
    focusable="false"
  >
    <rect
      v-for="(b, i) in blocks"
      :key="i"
      :x="b[0]"
      :y="b[1]"
      :width="b[2]"
      :height="b[3]"
    />
  </svg>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

export type DiscoIconName =
  | 'close'
  | 'add'
  | 'folder'
  | 'folder-open'
  | 'check'
  | 'refresh'
  | 'delete'
  | 'play'
  | 'stop'
  | 'apps'
  | 'store'
  | 'account'
  | 'settings'
  | 'menu'
  | 'back'
  | 'info'
  | 'download'
  | 'clock'
  | 'history'
  | 'search'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'more'
  | 'star'

/**
 * Every icon is a list of [x, y, w, h] blocks on the 16x16 grid. The blocks are
 * intentionally chunky (mostly 2px) so the icon reads as pixel art at the sizes
 * the shell uses (14-22px).
 */
const ICONS: Record<DiscoIconName, number[][]> = {
  close: [
    [2, 2, 2, 2], [4, 4, 2, 2], [6, 6, 2, 2], [8, 8, 2, 2], [10, 10, 2, 2], [12, 12, 2, 2],
    [12, 2, 2, 2], [10, 4, 2, 2], [8, 6, 2, 2], [6, 8, 2, 2], [4, 10, 2, 2], [2, 12, 2, 2],
  ],
  add: [
    [7, 2, 2, 12],
    [2, 7, 12, 2],
  ],
  check: [
    [3, 9, 2, 2], [5, 11, 2, 2], [7, 12, 2, 2], [9, 10, 2, 2], [11, 8, 2, 2], [13, 6, 2, 2],
  ],
  folder: [
    [2, 3, 5, 2], [7, 3, 7, 2],
    [2, 5, 12, 8],
    [4, 7, 2, 4], [8, 7, 2, 4], [12, 7, 2, 4],
  ],
  'folder-open': [
    [2, 3, 5, 2], [7, 3, 7, 2],
    [2, 5, 12, 8],
    [4, 7, 2, 4], [8, 7, 2, 4], [12, 7, 2, 4],
    [4, 11, 8, 2],
  ],
  refresh: [
    [3, 3, 2, 2], [5, 2, 4, 2], [9, 3, 2, 2],
    [11, 5, 2, 4], [10, 9, 2, 2],
    [8, 11, 4, 2], [4, 10, 2, 2],
    [3, 6, 2, 4], [2, 8, 4, 2],
  ],
  delete: [
    [6, 2, 4, 2], [5, 4, 6, 2],
    [4, 6, 8, 8],
    [7, 8, 2, 4], [11, 8, 2, 4], [7, 11, 6, 2],
  ],
  play: [
    [5, 3, 2, 10], [7, 4, 2, 8], [9, 5, 2, 6], [11, 6, 2, 4],
  ],
  stop: [
    [4, 4, 8, 8],
  ],
  apps: [
    [2, 2, 5, 5], [9, 2, 5, 5], [2, 9, 5, 5], [9, 9, 5, 5],
  ],
  store: [
    [2, 3, 12, 2], [4, 5, 2, 2], [8, 5, 2, 2], [12, 5, 2, 2],
    [3, 7, 10, 6],
    [6, 9, 4, 4],
  ],
  account: [
    [6, 3, 4, 4], [4, 8, 8, 2], [3, 10, 10, 3],
  ],
  settings: [
    [6, 2, 4, 3], [6, 11, 4, 3],
    [2, 6, 3, 4], [11, 6, 3, 4],
    [5, 5, 6, 6], [7, 7, 2, 2],
  ],
  menu: [
    [2, 4, 12, 2], [2, 7, 12, 2], [2, 10, 12, 2],
  ],
  back: [
    [3, 7, 8, 2],
    [5, 5, 2, 2], [5, 9, 2, 2], [3, 7, 2, 2],
  ],
  info: [
    [7, 4, 2, 2], [7, 7, 2, 5], [7, 12, 2, 2],
  ],
  download: [
    [7, 3, 2, 7], [5, 9, 4, 2], [3, 11, 4, 2],
    [2, 13, 12, 2],
  ],
  clock: [
    [3, 3, 10, 10], [5, 5, 6, 6], [7, 7, 2, 2], [7, 7, 2, 4],
  ],
  history: [
    [3, 3, 2, 2], [5, 2, 4, 2], [9, 3, 2, 2],
    [11, 5, 2, 4], [10, 9, 2, 2],
    [8, 11, 4, 2], [4, 10, 2, 2],
    [2, 6, 2, 4],
  ],
  search: [
    [3, 3, 7, 2], [2, 5, 2, 6], [3, 11, 7, 2], [10, 10, 2, 2], [12, 12, 2, 2],
  ],
  minimize: [
    [4, 11, 8, 2],
  ],
  maximize: [
    [3, 3, 10, 2], [3, 11, 10, 2], [3, 5, 2, 6], [11, 5, 2, 6],
  ],
  restore: [
    [5, 2, 7, 2], [5, 4, 2, 3], [12, 4, 2, 3], [10, 10, 4, 2],
  ],
  more: [
    [3, 7, 2, 2], [7, 7, 2, 2], [11, 7, 2, 2],
  ],
  star: [
    [7, 2, 2, 2], [5, 4, 2, 2], [9, 4, 2, 2], [3, 6, 2, 2], [11, 6, 2, 2],
    [2, 8, 12, 2], [4, 10, 2, 2], [7, 10, 2, 2], [10, 10, 2, 2], [6, 12, 4, 2],
  ],
}

const props = withDefaults(defineProps<{
  name: DiscoIconName
  size?: number | string
}>(), { size: 20 })

const blocks = computed(() => ICONS[props.name] ?? [])
</script>

<style scoped>
.disco-icon {
  display: block;
  flex-shrink: 0;
}
</style>
