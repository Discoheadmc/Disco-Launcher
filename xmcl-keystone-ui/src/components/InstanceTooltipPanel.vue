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
        <div
          class="tooltip-panel__fact"
          :title="lastPlayed.full"
        >
          <v-icon size="14">schedule</v-icon>
          <span class="tooltip-panel__fact-label">{{ t('instance.playtime') }}</span>
          <span class="tooltip-panel__fact-value">{{ playTimeText }}</span>
        </div>
        <div class="tooltip-panel__fact">
          <v-icon size="14">update</v-icon>
          <span class="tooltip-panel__fact-label">{{ t('instance.lastPlayed') }}</span>
          <span
            class="tooltip-panel__fact-value"
            :title="lastPlayed.full"
          >{{ lastPlayed.text }}</span>
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
import { useInstanceFacts } from '@/composables/instanceFacts'
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
const { formatPlayTime, formatLastPlayed } = useInstanceFacts()

// Disco: the same shared formatter the dashboard hero card uses, so the two
// surfaces can never disagree about one instance's facts again.
const playTimeText = computed(() => formatPlayTime(instance.value.playtime ?? 0))
const lastPlayed = computed(() => formatLastPlayed(instance.value.lastPlayedDate ?? 0))

/**
 * Hover preview: the panel follows the pointer while it is over a slot, but it
 * always returns to the selected instance. `previewing` only decorates the box
 * so the user knows what they see is not the selection.
 */
const previewing = ref(false)

</script>

<style scoped>
/* Disco: the detail column of the inventory home - fixed width, aligned to
   the page header from the top, never taller than its own content (no
   scrollbar inside the panel). */
.tooltip-panel {
  width: 340px;
  flex-shrink: 0;
  align-self: flex-start;
  height: fit-content;
  margin: 16px 16px 0;
  position: sticky;
  top: 0;
}

/* Narrow windows: the panel drops below the slot grid instead of squeezing
   it. No horizontal overflow either. */
@media (max-width: 900px) {
  .tooltip-panel {
    width: 100%;
    margin: 16px 8px 0;
    position: static;
  }
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
