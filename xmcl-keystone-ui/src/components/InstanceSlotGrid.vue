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
    <!-- Disco: empty state with a direct "Oyun Oluştur" entry (the classic
         grid relies on the toolbar button; the inventory home has none). -->
    <div
      v-if="displayInstances.length === 0"
      class="slot-grid__empty"
      data-testid="instance-slot-grid-empty"
    >
      <v-icon size="40" class="mb-2">sports_esports</v-icon>
      <div class="text-body-2 mb-1">{{ t('homeDashboard.noneTitle') }}</div>
      <div class="text-caption mb-4">{{ t('homeDashboard.noneHint') }}</div>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="add"
        data-testid="instance-slot-grid-create"
        @click="showAddInstance(undefined)"
      >
        {{ t('instances.add') }}
      </v-btn>
    </div>
    <div
      v-for="(inst, index) in displayInstances"
      :key="inst.path"
      class="slot"
      :class="{
        'slot--selected': inst.path === selectedPath,
        'slot--incompatible': !inst.runtime.minecraft,
        'slot--dragging': dragFrom === index,
        'slot--dragover': dragOver === index,
      }"
      :title="inst.name"
      :aria-label="inst.name"
      :aria-pressed="inst.path === selectedPath"
      :data-testid="`instance-slot-${inst.name}`"
      draggable="true"
      @click="select(inst.path)"
      @contextmenu.prevent="emit('contextmenu', $event, inst)"
      @dragstart="onDragStart($event, index)"
      @dragover.prevent="onDragOver($event, index)"
      @dragleave="onDragLeave(index)"
      @drop.prevent="onDrop($event, index)"
      @dragend="onDragEnd"
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
      <span class="slot__meta">{{ inst.runtime.minecraft || '' }}<template v-if="loaderText(inst)"> · {{ loaderText(inst) }}</template></span>
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
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { computed, ref } from 'vue'

const { t } = useI18n()
const { displayInstances, selectedInstance, reorderInstance } = injection(kInstances)
const { select } = injection(kInstance)
const { isRunning } = injection(kInstanceLaunchCoordinator)
const running = isRunning as (path: string) => boolean
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

// Disco: native HTML5 drag & drop reorders the display order (session-only -
// see useInstances). No drag library, no dependency.
const dragFrom = ref(-1)
const dragOver = ref(-1)
function onDragStart(e: DragEvent, index: number) {
  dragFrom.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}
function onDragOver(e: DragEvent, index: number) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOver.value = index
}
function onDragLeave(index: number) {
  if (dragOver.value === index) dragOver.value = -1
}
function onDrop(e: DragEvent, index: number) {
  reorderInstance(dragFrom.value, index)
  dragFrom.value = -1
  dragOver.value = -1
}
function onDragEnd() {
  dragFrom.value = -1
  dragOver.value = -1
}

/** "sürüm · mod yükleyici" meta below the slot name (short loader name). */
function loaderText(inst: Instance) {
  const r = inst.runtime
  if (r.forge) return 'Forge'
  if (r.fabricLoader) return 'Fabric'
  if (r.quiltLoader) return 'Quilt'
  if (r.neoForged) return 'NeoForge'
  return ''
}

const emit = defineEmits<{
  (e: 'contextmenu', event: MouseEvent, inst: Instance): void
}>()

const gridRef = ref<HTMLElement>()
const selectedPath = selectedInstance

// Icon cache - getInstanceIcon must not run again on every render.
const instanceIconMap = computed(() => {
  const map = new Map<string, string>()
  for (const inst of displayInstances.value) {
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
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
  padding: 4px 2px 16px;
}

.slot-grid__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  opacity: 0.75;
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
  cursor: grab;
  overflow: hidden;
}

/* Drag & drop feedback: the dragged slot dims, the target slot highlights. */
.slot--dragging {
  opacity: 0.4;
}

.slot--dragover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.18);
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
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  margin-top: 6px;
}

.slot__icon img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

/* The name is always visible - at most two lines, ellipsized, with the full
   name in the slot's title tooltip. */
.slot__name {
  width: 100%;
  font-size: 0.7rem;
  line-height: 1.15;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
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
