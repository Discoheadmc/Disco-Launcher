<template>
  <!-- Disco Launcher: marks the experimental features gated by Beta Mode.
       Small, square-cornered, uppercase, thin frame, accent color. -->
  <span class="beta-badge" :class="props.class">
    <slot>{{ label }}</slot>
  </span>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** Overrides the default "Beta" label (already localized). */
  label?: string
  class?: string
}>()

const { t } = useI18n()
const label = computed(() => props.label ?? t('setting.betaBadge'))
</script>

<style scoped>
.beta-badge {
  display: inline-flex;
  align-items: center;
  margin-inline-start: 8px;
  padding: 1px 6px;
  border: 1px solid rgb(var(--v-theme-primary));
  /* Square corners on purpose: no pill rounding. */
  border-radius: 0;
  color: rgb(var(--v-theme-primary));
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.6;
  text-transform: uppercase;
  user-select: none;
  white-space: nowrap;
}
</style>