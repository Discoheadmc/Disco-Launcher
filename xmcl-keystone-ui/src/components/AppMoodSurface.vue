<template>
  <v-sheet
    class="app-mood-surface"
    :class="{
      'app-mood-surface--fill': fill,
      'app-mood-surface--flash': flash,
    }"
    :rounded="rounded"
    :border="border"
  >
    <slot />
  </v-sheet>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  rounded?: string | boolean
  border?: string | boolean
  fill?: boolean
  flash?: boolean
}>(), {
  rounded: 'xl',
  border: true,
  fill: false,
  flash: true,
})
</script>

<style scoped>
/*
 * Prism-minimal: flat card. No rise animation, no sheen sweep,
 * no inset highlight, minimal shadow.
 */
.app-mood-surface {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.18);
}

.app-mood-surface--fill {
  min-height: calc(100% - 4px);
}

.app-mood-surface :deep(> *) {
  position: relative;
  z-index: 1;
}
</style>
