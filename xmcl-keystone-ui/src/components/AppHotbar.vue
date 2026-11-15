<template>
  <!-- Disco: Inventory-theme hotbar. One row of square slots pinned to the
       bottom of the window, Minecraft style. Slot count is the real target
       count (no filler slots). Keys 1-9 select a slot while no text input has
       focus; Esc is handled by AppPauseMenu. -->
  <nav
    class="hotbar"
    role="toolbar"
    :aria-label="t('setting.uiLayout.inventoryTheme')"
    data-testid="app-hotbar"
    @keydown="onKeydown"
  >
    <div class="hotbar__slots">
      <button
        v-for="(slot, index) in slots"
        :key="slot.id"
        type="button"
        class="hotbar__slot"
        :class="{
          'hotbar__slot--active': slot.id === activeSlot,
          'hotbar__slot--hidden': slot.hidden,
        }"
        :data-testid="`hotbar-slot-${slot.id}`"
        :aria-label="slot.label"
        :aria-pressed="slot.id === activeSlot"
        @click="select(slot, index)"
        @mouseenter="hovered = slot.id"
        @mouseleave="hovered = ''"
      >
        <span class="hotbar__index">{{ index + 1 }}</span>
        <span class="hotbar__icon">
          <v-icon :size="22" :icon="slot.icon" />
        </span>
        <span class="hotbar__label">{{ slot.label }}</span>
        <span
          v-if="slot.badge"
          class="hotbar__badge"
        >{{ slot.badge }}</span>
      </button>
    </div>
  </nav>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

interface HotbarSlot {
  id: string
  label: string
  icon: string
  /** Hidden slots reserve their index but render nothing (e.g. "back"). */
  hidden?: boolean
  badge?: string | number
  to?: string
}

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { state } = injection(kSettingsState)

/**
 * Slot order. The back slot only appears when the router can go back; it is
 * rendered as a regular slot so the row never shifts width.
 */
const slots = computed<HotbarSlot[]>(() => [
  { id: 'instances', label: t('home'), icon: 'apps', to: '/' },
  { id: 'store', label: t('store.name'), icon: 'storefront', to: '/store' },
  { id: 'me', label: t('myStuff'), icon: 'account_circle', to: '/me' },
  { id: 'settings', label: t('setting.name', 2), icon: 'settings', to: '/setting' },
  { id: 'menu', label: t('menuBar.files'), icon: 'menu' },
  { id: 'create', label: t('instances.add'), icon: 'add', badge: '+' },
])

const activeSlot = computed(() => {
  const path = route.path
  const found = slots.value.find(s => s.to && (s.to === path || (s.to !== '/' && path.startsWith(s.to))))
  return found?.id ?? (path === '/' ? 'instances' : '')
})

const hovered = ref('')
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

function select(slot: HotbarSlot, index: number) {
  if (slot.id === 'create') {
    showAddInstance(undefined)
    return
  }
  if (slot.id === 'menu') {
    window.dispatchEvent(new CustomEvent('hotbar-menu', { detail: { slot: index + 1 } }))
    return
  }
  if (slot.to) {
    void router.push(slot.to)
  }
}

/**
 * Number-key selection, Minecraft style. Ignored while a text field, textarea
 * or a contenteditable element has focus so typing a number still works.
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') return
  if (e.defaultPrevented) return
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
  }
  const index = Number(e.key)
  if (!Number.isInteger(index) || index < 1 || index > slots.value.length) return
  const slot = slots.value[index - 1]
  if (!slot || slot.hidden) return
  e.preventDefault()
  select(slot, index - 1)
}

// Global handler so the keys work without focusing the bar first.
// Disco: while the "Minecraft tuslari" mode is on, the number keys belong to
// the instance picker - the hotbar must stay out of the way. That mode owns
// the event already (capture phase) and marks it defaultPrevented.
function onWindowKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented) return
  if (e.key === 'Escape') return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName ?? ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
  const index = Number(e.key)
  if (!Number.isInteger(index) || index < 1 || index > slots.value.length) return
  const slot = slots.value[index - 1]
  if (!slot || slot.hidden) return
  // Never steal a plain number from a focused button (e.g. the hotbar itself
  // was clicked, the press is meant to activate it again).
  if (tag === 'BUTTON' && document.activeElement === target) return
  select(slot, index - 1)
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown))

// Exposed for the pause menu highlight.
defineExpose({ slots, activeSlot, hovered })
</script>

<style scoped>
.hotbar {
  position: relative;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding: 0 8px 8px;
  flex-shrink: 0;
  pointer-events: none;
}

.hotbar__slots {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 2px;
  pointer-events: auto;
}

/* Minecraft's hotbar slot: square, framed, selected slot draws a heavier
   border. Theme tokens only - no new colors. */
.hotbar__slot {
  position: relative;
  width: 52px;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  padding: 2px;
}

.hotbar__slot:hover {
  background: rgba(255, 255, 255, 0.14);
}

.hotbar__slot--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}

.hotbar__slot--hidden {
  visibility: hidden;
  pointer-events: none;
}

.hotbar__index {
  position: absolute;
  top: 1px;
  left: 3px;
  font-size: 9px;
  line-height: 1;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}

.hotbar__label {
  font-size: 8px;
  line-height: 1.05;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hotbar__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-radius: 0;
}
</style>
