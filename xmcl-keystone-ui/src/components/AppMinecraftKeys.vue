<template>
  <!-- Disco: the "Minecraft tuşları" mode for the instance screen. A small
       closable hint sits in the top corner of the instance page saying that
       Enter turns the mode on; once on, 1..9 pick an instance the same way a
       hotbar slot is picked, and Esc turns the mode off again. Every entry is
       dismissed by the user, so the hint never blocks the page. -->
  <div
    v-if="showHint"
    class="mc-keys"
    data-testid="mc-keys-hint"
  >
    <div class="mc-keys__text">
      {{ t('setting.uiLayout.mcKeysHint') }}
    </div>
    <button
      type="button"
      class="mc-keys__close"
      :aria-label="t('shared.cancel')"
      data-testid="mc-keys-hint-close"
      @click="dismissHint"
    >
      <v-icon size="14">close</v-icon>
    </button>
  </div>

    <!-- Compact readout while the mode is on, so the state is always visible. -->
  <div
    v-else-if="active"
    class="mc-keys mc-keys--active"
    data-testid="mc-keys-active"
  >
    <div class="mc-keys__text">
      {{ t('setting.uiLayout.mcKeysActive') }}
    </div>
    <button
      type="button"
      class="mc-keys__close"
      :aria-label="t('shared.cancel')"
      data-testid="mc-keys-close"
      @click="active = false"
    >
      <v-icon size="14">close</v-icon>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const { instances } = injection(kInstances)
const { select } = injection(kInstance)

/** True while the number keys pick instances instead of hotbar slots. */
const active = ref(false)
/** The hint stays dismissed once the user closes it (per session). */
const dismissed = ref(false)

const onInstanceScreen = computed(() => route.path === '/')
const showHint = computed(() => onInstanceScreen.value && !active.value && !dismissed.value)

/**
 * Number of hotbar slots. Counted from the DOM so the mapping never drifts
 * when a slot is added or removed; 0 when the hotbar is not rendered (the
 * classic layout), in which case every number picks an instance.
 */
const hotbarSlotCount = ref(0)
function readHotbarSlotCount() {
  const bar = document.querySelector('[data-testid="app-hotbar"]')
  hotbarSlotCount.value = bar ? bar.querySelectorAll('.hotbar__slot').length : 0
}
watch(onInstanceScreen, () => nextTick(readHotbarSlotCount), { immediate: true })
onMounted(() => nextTick(readHotbarSlotCount))

function dismissHint() {
  dismissed.value = true
}

function toggle(next: boolean) {
  active.value = next
  if (next) {
    dismissed.value = true
  }
}

/**
 * Esc turns THIS mode off - it must not fall through to the pause menu, so the
 * event is consumed here and the pause menu additionally bails out on a
 * defaultPrevented Esc. Number keys are ignored while typing.
 *
 * While the mode is on, a number is first offered to the hotbar: the keys map
 * to its slots one-to-one (1..6 today), so the hotbar keeps working. A number
 * above the slot count picks that instance instead, which is what makes the
 * "Minecraft tuslari" list usable.
 */
function onKeydown(e: KeyboardEvent) {
  if (e.defaultPrevented) return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName ?? ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return

  if (e.key === 'Escape') {
    if (!active.value) return
    e.preventDefault()
    e.stopImmediatePropagation()
    toggle(false)
    return
  }

  if (e.key === 'Enter' && !active.value) {
    if (!onInstanceScreen.value) return
    e.preventDefault()
    toggle(true)
    return
  }

  if (!active.value) return
  const index = Number(e.key)
  if (!Number.isInteger(index) || index < 1) return
  // The hotbar owns 1..N (N = slot count). Anything above that selects the
  // instance at that offset, so pressing past the hotbar still picks a game.
  if (index <= hotbarSlotCount.value) return
  const list = instances.value
  const instanceIndex = index - hotbarSlotCount.value
  if (instanceIndex > list.length) return
  // Selecting the instance switches the detail view to it - the launch
  // decision stays with the Başlat button, so no launch logic is touched.
  select(list[instanceIndex - 1].path)
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))

// Leaving the instance screen ends the mode, so it never leaks into another page.
watch(onInstanceScreen, (onInstance) => {
  if (!onInstance && active.value) toggle(false)
})
</script>

<style scoped>
.mc-keys {
  position: absolute;
  /* Below the inventory window strip (28px) so the two never overlap. */
  top: 38px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 2px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.78rem;
  max-width: min(90%, 460px);
}

.mc-keys--active {
  border-color: rgba(var(--v-theme-primary), 0.7);
  box-shadow: none;
}

.mc-keys__text {
  line-height: 1.25;
}

.mc-keys__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: inherit;
  cursor: pointer;
  opacity: 0.8;
}

.mc-keys__close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}
</style>
