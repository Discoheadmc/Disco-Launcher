<template>
  <v-menu
    :close-on-content-click="false"
    location="bottom"
    :offset="8"
  >
    <template #activator="{ props: activatorProps }">
      <div
        v-shared-tooltip="() => text"
        class="color-button min-w-5 max-w-5 dark:border-light-50 rounded-full border-2 p-5 transition-all"
        v-bind="activatorProps"
        :style="shadowColor"
      />
    </template>
    <v-card class="color-picker-card overflow-hidden">
      <v-color-picker
        :model-value="modelValue"
        dot-size="25"
        canvas-height="110"
        show-swatches
        swatches-max-height="170"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <template v-if="hasBlur">
        <v-list-subheader>
          {{ t('setting.backdropBlur') }}
        </v-list-subheader>
        <v-slider
          class="mx-2"
          :model-value="blur"
          :min="0"
          :max="30"
          density="compact"
          hide-details
          @update:model-value="emit('update:blur', $event)"
        />
      </template>
    </v-card>
  </v-menu>
</template>
<script lang="ts" setup>
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const props = defineProps<{
  modelValue: string
  text: string
  blur?: number
  hasBlur?: boolean
}>()

const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:blur', value: number): void
}>()

const { isDark } = injection(kTheme)

const shadowColor = computed(() => ({
  '--shadow-color': isDark.value ? '255 255 255' : '0 0 0',
  'background-color': props.modelValue,
}))

</script>
<style scoped>

.color-button {
  box-shadow: 0 3px 5px -1px rgb(var(--shadow-color) / 20%), 0 5px 8px 0 rgb(var(--shadow-color) / 14%), 0 1px 14px 0 rgb(var(--shadow-color) / 12%);
}
.color-button:hover {
  box-shadow: 0 3px 5px -1px rgb(var(--shadow-color) / 20%), 0 5px 8px 0 rgb(var(--shadow-color) / 14%), 0 1px 14px 0 rgb(var(--shadow-color) / 12%);
}
.color-button:active {
  box-shadow: 0 8px 9px -5px rgb(var(--shadow-color) / 20%), 0 15px 22px 2px rgb(var(--shadow-color) / 14%), 0 6px 28px 5px rgb(var(--shadow-color) / 12%);
}

/* Disco: horizontal (landscape) picker layout — canvas + sliders on the
   left column, the swatch palette on the right. VPicker nests all content
   inside .v-picker__body, so the two-column grid targets that wrapper.
   Keeps the popup compact (~260px tall) so it opens BELOW the swatch dot
   without flipping. */
.color-picker-card {
  min-width: 460px;
}

/* Vuetify hardcodes .v-color-picker { width: 300px } — fill the card instead. */
.color-picker-card :deep(.v-color-picker) {
  width: 100%;
}

.color-picker-card :deep(.v-picker__body) {
  display: grid;
  grid-template-columns: minmax(220px, auto) minmax(130px, 160px);
  gap: 0 12px;
  align-items: start;
  padding: 10px;
}

.color-picker-card :deep(.v-color-picker-canvas),
.color-picker-card :deep(.v-color-picker__controls) {
  grid-column: 1;
}

.color-picker-card :deep(.v-color-picker__controls) {
  grid-row: 2;
  margin-top: 8px;
}

.color-picker-card :deep(.v-color-picker-swatches) {
  grid-column: 2;
  grid-row: 1 / span 2;
  height: 100%;
  max-height: none;
}

</style>
