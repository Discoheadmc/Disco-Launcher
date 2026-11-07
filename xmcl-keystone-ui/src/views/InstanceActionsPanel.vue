<template>
  <div class="instance-actions-panel">
    <div class="instance-actions-panel__header">
      <img
        class="instance-actions-panel__icon"
        :src="getInstanceIcon(instance, undefined)"
        :alt="name"
        draggable="false"
      >
      <div class="instance-actions-panel__title">
        <div class="instance-actions-panel__name">{{ name }}</div>
        <div class="instance-actions-panel__meta">
          {{ instance.runtime.minecraft || '' }}
          <template v-if="instance.runtime.forge"> · Forge {{ instance.runtime.forge }}</template>
          <template v-else-if="instance.runtime.fabricLoader"> · Fabric {{ instance.runtime.fabricLoader }}</template>
        </div>
      </div>
    </div>

    <!-- Disco: the actions come from the shared source (useInstanceActions), so
         the classic panel, the tooltip panel and the home card all offer the
         same list in the same order with the same state rules. -->
    <template
      v-for="action in actions"
      :key="action.id"
    >
      <div
        v-if="action.id === 'kill'"
        :key="'divider-before-' + action.id"
        class="instance-actions-panel__divider"
      />
      <button
        type="button"
        class="action-btn"
        :class="{
          'action-btn--danger': action.danger,
          'action-btn--primary': action.primary,
          'action-btn--primary--custom': action.primary && !!launchButtonColor,
        }"
        :style="action.style"
        :data-testid="action.testid"
        :aria-label="action.label"
        :disabled="action.disabled"
        @click="action.run()"
      >
        <v-icon size="18">{{ action.icon }}</v-icon>
        {{ action.label }}
        <v-icon
          v-if="action.id === 'mc-settings' && favoriteOf"
          size="14"
          class="ml-auto panel-favorite-star"
          data-testid="panel-mc-settings-favorite"
        >star</v-icon>
      </button>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kTheme } from '@/composables/theme'
import { useInstanceActions } from '@/composables/instanceActions'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'

// Disco: optional theme color dedicated to the launch button. Empty = the
// button keeps its built-in hardcoded styling (default behavior preserved).
// Bound directly (not via a global CSS variable) so it never depends on a
// style tag that only exists while the settings page is mounted. The local
// custom property also drives the hover tint in the scoped CSS below.
const { launchButtonColor } = injection(kTheme)
const launchBtnStyle = computed(() =>
  launchButtonColor.value
    ? { background: launchButtonColor.value, '--launch-btn-custom-bg': launchButtonColor.value }
    : undefined,
)

const { instance, path, name } = injection(kInstance)
const { actions, favoriteOf } = useInstanceActions()

// The install action must never be tinted by the custom launch color.
const coloredActions = computed(() =>
  actions.value.map(a => (a.id === 'install' ? a : { ...a, style: launchBtnStyle.value })),
)
</script>

<style scoped>
.instance-actions-panel {
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  gap: 2px;
  overflow-y: auto;
}

.instance-actions-panel__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  text-align: center;
}

.instance-actions-panel__icon {
  width: 96px;
  height: 96px;
  border-radius: 6px;
  image-rendering: pixelated;
  object-fit: cover;
}

.instance-actions-panel__name {
  font-size: 1rem;
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.instance-actions-panel__meta {
  font-size: 0.75rem;
  opacity: 0.65;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.action-btn--primary {
  background: rgba(150, 219, 89, 0.15);
}

.action-btn--primary:hover {
  background: rgba(150, 219, 89, 0.25) !important;
}

/* Disco: fixed blue for the "İndir" (repair/install) state — intentionally
   independent from the user-configurable launch-button color. */
.action-btn--install {
  background: rgba(33, 150, 243, 0.18);
}

.action-btn--install:hover:not(:disabled) {
  background: rgba(33, 150, 243, 0.3) !important;
}

/* Disco: when a dedicated launch-button color is customized in the theme,
   the inline background wins and the hover state derives a slightly
   stronger tint from the same custom color. */
.action-btn--primary--custom:hover {
  background: color-mix(in srgb, var(--launch-btn-custom-bg) 85%, white) !important;
}

.action-btn--danger:hover:not(:disabled) {
  background: rgba(255, 82, 82, 0.15);
}

/* Plain favourite marker, matching the one in the MC settings dialog. */
.panel-favorite-star {
  opacity: 0.62;
}

.instance-actions-panel__divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 6px 4px;
}
</style>
