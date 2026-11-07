<template>
  <!-- Disco: the window strip of the inventory layout. The classic layout
       gets its drag area and window buttons from AppSystemBar, which the
       inventory shell hides - without this strip the window can no longer be
       moved, minimized, maximized or closed. The empty middle is the drag
       region, the three buttons are the usual window controls. -->
  <div
    class="inv-titlebar"
    data-testid="app-inventory-titlebar"
  >
    <div class="inv-titlebar__drag moveable" />
    <div class="inv-titlebar__buttons non-moveable">
      <button
        type="button"
        class="inv-titlebar__btn"
        :aria-label="minimizeAriaLabel"
        data-testid="inv-titlebar-minimize"
        @click="minimize"
      >
        <DiscoIcon name="minimize" :size="12" />
      </button>
      <button
        type="button"
        class="inv-titlebar__btn"
        :aria-label="maximizeAriaLabel"
        data-testid="inv-titlebar-maximize"
        @click="toggleMaximize"
      >
        <DiscoIcon :name="maximized ? 'restore' : 'maximize'" :size="12" />
      </button>
      <button
        type="button"
        class="inv-titlebar__btn inv-titlebar__btn--close"
        :aria-label="closeAriaLabel"
        data-testid="inv-titlebar-close"
        @click="close"
      >
        <DiscoIcon name="close" :size="12" />
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import DiscoIcon, { type DiscoIconName } from '@/components/DiscoIcon.vue'
import { computed, ref } from 'vue'

const { maximize, minimize, close } = windowController

const maximized = ref(false)

function toggleMaximize() {
  maximize()
  // The controller has no "isMaximized" query; the icon only matters as a
  // hint, so track the last action instead of guessing the real state.
  maximized.value = !maximized.value
}

const minimizeAriaLabel = 'Minimize'
const maximizeAriaLabel = computed(() => (maximized.value ? 'Restore' : 'Maximize'))
const closeAriaLabel = 'Close'
</script>

<style scoped>
.inv-titlebar {
  position: relative;
  z-index: 4000;
  display: flex;
  align-items: stretch;
  height: 28px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.55);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* The drag area: everything except the buttons on the right. */
.inv-titlebar__drag {
  flex: 1 1 auto;
  min-width: 0;
}

.inv-titlebar__buttons {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
}

.inv-titlebar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  appearance: none;
}

.inv-titlebar__btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.inv-titlebar__btn--close:hover {
  background: rgb(209, 12, 12);
  color: #fff;
}
</style>
