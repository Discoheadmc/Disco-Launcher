<template>
  <div class="instance-grid">
    <div class="instance-grid__group-header" @click="collapsed = !collapsed">
      <v-icon size="20" class="mr-1">
        {{ collapsed ? 'chevron_right' : 'expand_more' }}
      </v-icon>
      <span class="text-subtitle-2">{{ t('instance.gridUngrouped') }}</span>
      <v-divider class="ml-3" />
    </div>

    <div v-if="!collapsed" class="instance-grid__cards">
      <button
        v-for="inst in instances"
        :key="inst.path"
        type="button"
        class="instance-card"
        :class="{ 'instance-card--selected': inst.path === selectedPath }"
        :aria-label="inst.name"
        :aria-pressed="inst.path === selectedPath"
        @click="select(inst.path)"
        @contextmenu.prevent="emit('contextmenu', $event, inst)"
      >
        <img
          class="instance-card__icon"
          :src="getInstanceIcon(inst, undefined)"
          :alt="inst.name"
          draggable="false"
        >
        <span class="instance-card__name">{{ inst.name }}</span>
        <span class="instance-card__meta">{{ inst.runtime.minecraft || '' }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Instance } from '@xmcl/instance'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'

const { t } = useI18n()

const { instances, selectedInstance } = injection(kInstances)
const { select } = injection(kInstance)

const collapsed = ref(false)
const selectedPath = selectedInstance

const emit = defineEmits<{
  (e: 'contextmenu', event: MouseEvent, inst: Instance): void
}>()
</script>

<style scoped>
.instance-grid {
  padding: 0 4px;
}

.instance-grid__group-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  opacity: 0.85;
  padding: 4px 4px 8px;
  user-select: none;
}

.instance-grid__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, 120px);
  gap: 12px;
  padding: 4px;
}

.instance-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: inherit;
  text-align: center;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.instance-card:hover {
  background: rgba(255, 255, 255, 0.06);
}

.instance-card--selected {
  border-color: #96db59;
  background: rgba(150, 219, 89, 0.08);
}

.instance-card__icon {
  width: 88px;
  height: 88px;
  border-radius: 4px;
  image-rendering: pixelated;
  object-fit: cover;
}

.instance-card__name {
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.instance-card__meta {
  font-size: 0.75rem;
  opacity: 0.65;
}
</style>
