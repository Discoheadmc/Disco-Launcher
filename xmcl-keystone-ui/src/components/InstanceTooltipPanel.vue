<template>
  <!-- Disco: Inventory-theme detail panel - the tooltip-style replacement for
       the classic right panel. Dark background, one thin border, square
       corners, no elevation. It is fixed for the SELECTED instance (never
       hover-dependent), so the actions are always reachable for the instance
       the user picked; hovering a slot only previews another instance's facts
       and closes again when the pointer leaves. -->
  <div class="tooltip-panel">
    <div
      class="tooltip-panel__box"
      data-testid="instance-tooltip-panel"
    >
      <div class="tooltip-panel__head">
        <img
          class="tooltip-panel__icon"
          :src="getInstanceIcon(instance, undefined)"
          :alt="name"
          draggable="false"
        >
        <div class="tooltip-panel__title">
          <div
            class="tooltip-panel__name"
            :title="name"
          >{{ name }}</div>
          <div class="tooltip-panel__meta">
            {{ instance.runtime.minecraft || '' }}
            <template v-if="instance.runtime.forge"> · Forge {{ instance.runtime.forge }}</template>
            <template v-else-if="instance.runtime.fabricLoader"> · Fabric {{ instance.runtime.fabricLoader }}</template>
          </div>
        </div>
        <span
          v-if="previewing"
          class="tooltip-panel__preview"
          data-testid="instance-tooltip-preview"
        >{{ t('storeInstall.title') }}</span>
      </div>

      <div class="tooltip-panel__facts">
        <div class="tooltip-panel__fact">
          <v-icon size="14">schedule</v-icon>
          <span class="tooltip-panel__fact-label">{{ t('instance.playtime') }}</span>
          <span class="tooltip-panel__fact-value">{{ playTimeText }}</span>
        </div>
        <div class="tooltip-panel__fact">
          <v-icon size="14">update</v-icon>
          <span class="tooltip-panel__fact-label">{{ t('instance.lastPlayed') }}</span>
          <span class="tooltip-panel__fact-value">{{ lastPlayedText }}</span>
        </div>
      </div>

      <!-- Actions: the same shared source as the classic panel. -->
      <div class="tooltip-panel__actions">
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          class="tp-btn"
          :class="{
            'tp-btn--danger': action.danger,
            'tp-btn--primary': action.primary,
          }"
          :data-testid="action.testid"
          :aria-label="action.label"
          :disabled="action.disabled"
          @click="action.run()"
        >
          <v-icon size="16">{{ action.icon }}</v-icon>
          <span class="tp-btn__label">{{ action.label }}</span>
          <v-icon
            v-if="action.id === 'mc-settings' && favoriteOf"
            size="12"
            class="tp-btn__star"
            data-testid="panel-mc-settings-favorite"
          >star</v-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useInstanceActions } from '@/composables/instanceActions'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { instance, path, name } = injection(kInstance)
const { instances, selectedInstance } = injection(kInstances)

const { actions, favoriteOf } = useInstanceActions()

/**
 * Oynama süresi / son oynanan - the same humanized strings the classic header
 * shows, so the tooltip never invents a second format.
 */
const playTimeText = computed(() => {
  const ms = instance.value.playtime
  if (!ms) return t('instance.neverPlayed')
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return t('duration.day', { duration: days }, { plural: days }) + ' ' + t('duration.hour', { duration: hours }, { plural: hours })
  if (hours > 0) return t('duration.hour', { duration: hours }, { plural: hours }) + ' ' + t('duration.minute', { duration: minutes }, { plural: minutes })
  return t('duration.minute', { duration: minutes }, { plural: minutes })
})

const lastPlayedText = computed(() => {
  const date = instance.value.lastPlayedDate
  if (!date) return t('instance.neverPlayed')
  return new Date(date).toLocaleString()
})

/**
 * Hover preview: the panel follows the pointer while it is over a slot, but it
 * always returns to the selected instance. `previewing` only decorates the box
 * so the user knows what they see is not the selection.
 */
const previewing = ref(false)

</script>

<style scoped>
.tooltip-panel {
  width: 260px;
  flex-shrink: 0;
}

.tooltip-panel__box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 2px;
}

.tooltip-panel__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tooltip-panel__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  object-fit: contain;
  image-rendering: pixelated;
}

.tooltip-panel__title {
  min-width: 0;
  flex: 1 1 auto;
}

.tooltip-panel__name {
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tooltip-panel__meta {
  font-size: 0.7rem;
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tooltip-panel__facts {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-panel__fact {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
}

.tooltip-panel__fact-label {
  opacity: 0.6;
}

.tooltip-panel__fact-value {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.tooltip-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tp-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}

.tp-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.tp-btn--danger:hover {
  border-color: rgba(255, 82, 82, 0.6);
}

.tp-btn--primary {
  background: rgba(var(--v-theme-primary), 0.16);
  border-color: rgba(var(--v-theme-primary), 0.5);
  color: rgb(var(--v-theme-primary));
}

.tp-btn__label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tp-btn__star {
  flex-shrink: 0;
  opacity: 0.7;
}
</style>
