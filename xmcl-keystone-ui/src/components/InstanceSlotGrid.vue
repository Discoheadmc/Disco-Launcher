<template>
  <!-- Disco: Inventory-theme instance slots. One square slot per instance, the
       icon centered, the name always shown underneath (it never vanishes, so
       the grid stays readable even with long names). Small badges carry the
       running / needs-install state. Hover shows the full name as a tooltip
       when the label is truncated. -->
  <div
    ref="gridRef"
    class="slot-grid"
    data-testid="instance-slot-grid"
  >
    <div
      v-for="(inst, index) in instances"
      :key="inst.path"
      class="slot"
      :class="{
        'slot--selected': inst.path === selectedPath,
        'slot--incompatible': !inst.runtime.minecraft,
      }"
      :title="inst.name"
      :aria-label="inst.name"
      :aria-pressed="inst.path === selectedPath"
      :data-testid="`instance-slot-${inst.name}`"
      @click="select(inst.path)"
      @contextmenu.prevent="emit('contextmenu', $event, inst)"
    >
      <span
        v-if="typeof index === 'number' && index < 9"
        class="slot__index"
      >{{ index + 1 }}</span>
      <span class="slot__icon">
        <img
          :src="instanceIconMap.get(inst.path)"
          :alt="inst.name"
          draggable="false"
          loading="lazy"
        >
      </span>
      <span class="slot__name">{{ inst.name }}</span>
      <span class="slot__meta">{{ inst.runtime.minecraft || '' }}</span>
      <span
        v-if="running(inst.path)"
        class="slot__badge slot__badge--running"
        :data-testid="`instance-slot-running-${inst.name}`"
      >{{ t('launch.running') }}</span>
      <span
        v-else-if="!inst.runtime.minecraft"
        class="slot__badge slot__badge--warn"
      >{{ t('instance.noVersion') }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Instance } from '@xmcl/instance'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { computed, ref } from 'vue'

const { t } = useI18n()
const { instances, selectedInstance } = injection(kInstances)
const { select } = injection(kInstance)
const { isRunning } = injection(kInstanceLaunchCoordinator)
const running = isRunning as (path: string) => boolean

const emit = defineEmits<{
  (e: 'contextmenu', event: MouseEvent, inst: Instance): void
}>()

const gridRef = ref<HTMLElement>()
const selectedPath = selectedInstance

// Icon cache - getInstanceIcon must not run again on every render.
const instanceIconMap = computed(() => {
  const map = new Map<string, string>()
  for (const inst of instances.value) {
    map.set(inst.path, getInstanceIcon(inst, undefined))
  }
  return map
})
</script>

<style scoped>
.slot-grid {
  display: grid;
  /* Responsive square slots: the 1fr columns keep every slot square because the
     aspect ratio is fixed below, so the grid scrolls instead of stretching. */
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 6px;
  padding: 4px 2px 16px;
}

/* Minecraft-style slot: square, framed, thick border when selected. */
.slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 3px;
  aspect-ratio: 1 / 1;
  padding: 6px 4px 5px;
  background: rgba(255, 255, 255, 0.07);
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  overflow: hidden;
}

.slot:hover {
  background: rgba(255, 255, 255, 0.14);
}

.slot--selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}

.slot--incompatible .slot__icon {
  opacity: 0.45;
}

.slot__index {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 9px;
  line-height: 1;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}

.slot__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  margin-top: 6px;
}

.slot__icon img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

/* The name is always visible - it may ellipsize, never disappear. */
.slot__name {
  width: 100%;
  font-size: 0.66rem;
  line-height: 1.15;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot__meta {
  font-size: 0.58rem;
  opacity: 0.6;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot__badge {
  position: absolute;
  bottom: 3px;
  right: 3px;
  padding: 1px 3px;
  font-size: 8px;
  line-height: 1.2;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.6);
}

.slot__badge--running {
  color: rgb(var(--v-theme-primary));
}

.slot__badge--warn {
  color: rgb(var(--v-theme-warning));
}
</style>
