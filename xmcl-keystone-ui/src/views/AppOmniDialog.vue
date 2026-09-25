<template>
  <v-dialog
    v-model="shown"
    width="800"
    max-width="95vw"
    scrollable
    transition="dialog-top-transition"
  >
    <div class="omni-surface omni-surface--command">
      <div class="omni-input-card">
        <v-textarea
          ref="inputRef"
          v-model="commandInput"
          data-testid="command-palette-input"
          :placeholder="t('commandPalette.placeholder')"
          :readonly="inputReadonly"
          variant="plain"
          density="comfortable"
          hide-details
          auto-grow
          rows="1"
          max-rows="1"
          class="omni-input"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @keydown="onInputKeydown"
        />
        <v-divider />
        <div class="omni-mode-controls">
          <div id="omni-mode-specific-controls" class="omni-mode-specific-controls" />
        </div>
      </div>
      <AppCommandPalette
        ref="commandPanel"
        v-show="shown"
      />
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useOmniDialog } from '@/composables/omniDialog'
import AppCommandPalette from '@/views/AppCommandPalette.vue'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// Disco Launcher: the agent chat mode was removed with the agent backend.
// This surface now hosts only the command palette.
const { t } = useI18n()
const { shown, commandInput, close } = useOmniDialog()
const commandPanel = ref<InstanceType<typeof AppCommandPalette> | null>(null)
const inputRef = ref<{ $el: HTMLElement } | null>(null)
const composing = ref(false)

const inputReadonly = computed(() => (commandPanel.value?.inputReadonly ?? false))

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    commandPanel.value?.moveSelection(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'ArrowRight') {
    commandPanel.value?.onArrowForward(event)
  } else if (event.key === 'ArrowLeft') {
    commandPanel.value?.onArrowBack(event)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    commandPanel.value?.invokeSelected()
  }
}

watch(shown, async (visible) => {
  if (!visible) return
  await nextTick()
  requestAnimationFrame(() => {
    inputRef.value?.$el.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden="true"])')?.focus()
  })
})
</script>

<style scoped>
.omni-surface {
  display: flex;
  width: 100%;
  height: 85vh;
  max-height: 85vh;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  --surface-blur: 0px;
  --surface-border: none;
  --surface-shadow: none;
  --surface-bg: transparent;
  --surface-dialog-radius: 0px;
  --omni-content-width: 720px;
  transform: translateY(clamp(24px, 5vh, 48px));
  background: transparent !important;
}

.omni-input-card {
  width: var(--omni-content-width);
  max-width: 100%;
  flex: 0 0 auto;
  align-self: center;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.22);
}

.omni-input {
  padding: 6px 10px 3px;
}

.omni-input :deep(textarea) {
  font-size: 13px;
  line-height: 1.45;
}

.omni-mode-controls {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.omni-mode-specific-controls {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
}

@media (max-width: 700px) {
  .omni-surface {
    width: 100%;
    max-width: 100%;
  }
}
</style>
