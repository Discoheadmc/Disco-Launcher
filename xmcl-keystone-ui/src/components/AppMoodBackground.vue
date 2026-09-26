<template>
  <div
    class="app-mood-background"
    :class="[`app-mood-background--${variant}`, { 'app-mood-background--static': !animated }]"
  >
    <div class="app-mood-background__content">
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  variant?: 'ambient' | 'pixel' | 'voxel'
  animated?: boolean
}>(), {
  variant: 'ambient',
  animated: true,
})
</script>

<style scoped>
/*
 * Prism-minimal: flat, opaque, neutral surface.
 * No gradients, no drifting grid, no light sweep, no keyframes —
 * the setup wizard renders on a plain solid background.
 */
.app-mood-background {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.app-mood-background__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
