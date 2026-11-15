<template>
  <!-- Disco: the "Diger islemler" side panel of the hero card. It opens beside
       the card (same height, sharing the card's row) instead of dropping below
       it, so the "Tum oyunlar" list below never moves. The list of actions is
       the shared instance-action source, minus the primary launch/install one,
       so no action can go missing here. -->
  <aside
    v-if="open"
    ref="root"
    class="hero-side"
    data-testid="home-dashboard-action-menu"
  >
    <div class="hero-side__head">
      <span class="hero-side__title">{{ t('homeDashboard.more') }}</span>
      <button
        type="button"
        class="hero-side__close"
        :aria-label="t('shared.cancel')"
        data-testid="home-dashboard-action-close"
        @click="close"
      >
        <v-icon size="14">close</v-icon>
      </button>
    </div>

    <div
      ref="listEl"
      class="hero-side__list"
      role="menu"
    >
      <template
        v-for="(action, i) in menuActions"
        :key="action.id"
      >
        <!-- A hairline separates the destructive action from the rest. -->
        <div
          v-if="action.id === 'delete'"
          class="hero-side__sep"
        />
        <button
          ref="itemEls"
          type="button"
          class="hero-side__btn"
          :class="{ 'hero-side__btn--danger': action.danger }"
          role="menuitem"
          :data-testid="action.testid"
          :disabled="action.disabled"
          @click="run(action)"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
        >
          <v-icon size="16">{{ action.icon }}</v-icon>
          <span class="hero-side__label">{{ action.label }}</span>
        </button>
      </template>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { useInstanceActions } from '@/composables/instanceActions'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = defineModel<boolean>()

const { actions } = useInstanceActions()
const { selectedInstance } = injection(kInstances)
const { select } = injection(kInstance)

/**
 * The panel shows every action except the primary one, which is already the
 * big button on the card.
 */
const menuActions = computed(() =>
  actions.value.filter(a => a.id !== 'launch' && a.id !== 'install'),
)

const listEl = ref<HTMLElement>()
const itemEls = ref<HTMLElement[]>([])
const root = ref<HTMLElement>()

function close() {
  open.value = false
}

function run(action: { run: () => void }) {
  open.value = false
  action.run()
}

/** Arrow-key navigation, wrapping around the ends. */
function move(delta: number) {
  const items = itemEls.value.filter(Boolean)
  if (items.length === 0) return
  const current = items.findIndex(el => el === document.activeElement)
  const next = (current + delta + items.length) % items.length
  items[next]?.focus()
}

// Esc closes the panel; a click outside closes it too.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName ?? ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
  e.preventDefault()
  close()
}

function onPointerDown(e: MouseEvent) {
  const el = e.target as Node | null
  if (!el) return
  if (root.value?.contains(el)) return
  // The toggle button lives in the card; let its own handler decide.
  if ((el as HTMLElement).closest?.('[data-testid="home-dashboard-menu"]')) return
  close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('pointerdown', onPointerDown, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('pointerdown', onPointerDown, true)
})

// When the instance changes underneath, close the panel: its actions belong to
// the instance the card showed when it was opened.
watch(selectedInstance, () => { open.value = false })

// Move focus to the first entry as soon as the panel appears.
watch(open, async (shown) => {
  if (!shown) return
  await nextTick()
  itemEls.value[0]?.focus()
})
</script>

<style scoped>
/* Absolutely positioned over the card's empty right area. Taking it out of the
   flex flow is what keeps the card and the list below perfectly still when it
   opens, while letting all nine actions show at once. */
.hero-side {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  width: 236px;
  min-height: 0;
  max-height: 280px;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 2px;
  animation: hero-side-in 150ms ease-out;
}

@keyframes hero-side-in {
  from { opacity: 0; transform: translateX(6px) }
  to { opacity: 1; transform: none }
}

.hero-side__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.hero-side__title {
  flex: 1 1 auto;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  opacity: 0.65;
}

.hero-side__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
}

.hero-side__close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.hero-side__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  overflow-y: auto;
  min-height: 0;
}

.hero-side__sep {
  height: 1px;
  margin: 4px 2px;
  background: rgba(255, 255, 255, 0.12);
}

.hero-side__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.hero-side__btn:hover,
.hero-side__btn:focus-visible {
  background: rgba(255, 255, 255, 0.12);
  outline: 1px solid rgb(var(--v-theme-primary));
  outline-offset: -1px;
}

.hero-side__btn--danger {
  color: rgb(var(--v-theme-error));
}

.hero-side__btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.hero-side__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
