<template>
  <v-dialog
    v-model="open"
    max-width="520px"
  >
    <v-card
      class="surface-colors-menu"
      data-testid="surface-colors-menu"
    >
      <div class="scm-header">
        <div class="scm-header__text">
          <div class="text-subtitle-1 font-weight-medium">
            {{ t('setting.surfaceColors.name') }}
          </div>
          <div class="text-caption scm-header__subtitle">
            {{ t('setting.surfaceColors.description') }}
          </div>
          <div class="text-caption scm-header__mode">
            {{ isDark ? t('setting.surfaceColors.editingDark') : t('setting.surfaceColors.editingLight') }}
          </div>
        </div>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          :aria-label="t('shared.cancel')"
          data-testid="surface-colors-close"
          @click="onCancel"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </div>
      <v-divider />

      <div class="scm-body">
        <div
          v-for="item in items"
          :key="item.key"
          class="scm-row"
        >
          <div class="scm-row__text">
            <div class="scm-row__label">{{ item.label }}</div>
            <div
              v-if="item.lowContrast"
              class="scm-row__warning"
              :data-testid="`surface-colors-warning-${item.key}`"
            >
              <v-icon size="13">visibility_off</v-icon>
              {{ t('setting.surfaceColors.lowContrast') }}
            </div>
          </div>
          <span class="scm-row__hex">{{ draft[item.key] }}</span>
          <v-menu
            :close-on-content-click="false"
            location="bottom"
            :offset="6"
          >
            <template #activator="{ props: activatorProps }">
              <button
                type="button"
                class="scm-swatch"
                :aria-label="item.label"
                :data-testid="`surface-colors-swatch-${item.key}`"
                :style="{ backgroundColor: draft[item.key] }"
                v-bind="activatorProps"
              />
            </template>
            <v-card class="scm-picker-card">
              <v-color-picker
                :model-value="draft[item.key]"
                dot-size="18"
                canvas-height="100"
                hide-inputs
                @update:model-value="v => onColor(item.key, v)"
              />
            </v-card>
          </v-menu>
        </div>
      </div>

      <v-divider />
      <div class="scm-actions">
        <v-btn
          variant="text"
          data-testid="surface-colors-reset"
          @click="onReset"
        >
          {{ t('setting.surfaceColors.reset') }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          data-testid="surface-colors-cancel"
          @click="onCancel"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          data-testid="surface-colors-save"
          @click="onSave"
        >
          {{ t('setting.surfaceColors.save') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { DEFAULT_SURFACE_COLORS, applySurfaceColors, surfaceContrastRatio, toSurfaceHex, VuetifyThemeInstance } from '@/composables/surfaceColors'
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { kTheme } from '@/composables/theme'
import type { SurfaceColorSet, UIThemeDataV1 } from '@/composables/theme'
import { injection } from '@/util/inject'
import { useTheme as useVuetifyTheme } from 'vuetify'
import { reactive, shallowRef, watch } from 'vue'

const props = defineProps<{
  /** The global theme object being edited (mutated on save). */
  theme: UIThemeDataV1
}>()

const emit = defineEmits<{
  (e: 'save'): void
}>()

const { t } = useI18n()
const open = defineModel<boolean>()
const { isDark } = injection(kTheme)
const tokens = injection(kSurfaceTokens)
// Capture during setup — Vuetify's useTheme cannot inject from the watcher
// callbacks that call applySurfaceColors later.
const framework: VuetifyThemeInstance = useVuetifyTheme()

type SurfaceKey = 'background' | 'card' | 'input' | 'border'

const draft = reactive({
  background: '',
  card: '',
  input: '',
  border: '',
} as Record<SurfaceKey, string>)

/** Theme data as it was when the menu opened — Cancel restores exactly this. */
const snapshot = shallowRef<SurfaceColorSet>({})

const items = computed(() => {
  const entries: Array<{ key: SurfaceKey; label: string }> = [
    { key: 'background', label: t('setting.surfaceColors.background') },
    { key: 'card', label: t('setting.surfaceColors.card') },
    { key: 'input', label: t('setting.surfaceColors.input') },
    { key: 'border', label: t('setting.surfaceColors.border') },
  ]
  return entries.map(e => ({
    ...e,
    lowContrast: (surfaceContrastRatio(draft[e.key], isDark.value) ?? 4) < 3,
  }))
})

watch(open, (shown) => {
  if (!shown) return
  const set = props.theme.surfaceColors?.[isDark.value ? 'dark' : 'light']
  snapshot.value = { ...set }
  fillDraft(set)
  applySurfaceColors(draft, isDark.value, tokens, framework)
}, { immediate: true })

function defaults(): Record<SurfaceKey, string> {
  return isDark.value ? { ...DEFAULT_SURFACE_COLORS.dark } : { ...DEFAULT_SURFACE_COLORS.light }
}

function fillDraft(set: SurfaceColorSet | undefined) {
  const d = defaults()
  for (const key of Object.keys(draft) as SurfaceKey[]) {
    draft[key] = set?.[key] || d[key]
  }
}

function onColor(key: SurfaceKey, value: any) {
  const hex = toSurfaceHex(value)
  if (!hex) return
  draft[key] = hex
  // Live preview only; nothing persists until Save.
  applySurfaceColors(draft, isDark.value, tokens, framework)
}

function onSave() {
  const mode = isDark.value ? 'dark' : 'light'
  props.theme.surfaceColors = props.theme.surfaceColors ?? {}
  props.theme.surfaceColors[mode] = {
    background: draft.background,
    card: draft.card,
    input: draft.input,
    border: draft.border,
  }
  emit('save')
  open.value = false
}

function onCancel() {
  // Re-apply the colors as they were at open — the theme data was never
  // touched, so restoring the live state is all Cancel needs.
  applySurfaceColors(snapshot.value, isDark.value, tokens, framework)
  open.value = false
}

function onReset() {
  fillDraft(undefined)
  applySurfaceColors(undefined, isDark.value, tokens, framework)
}
</script>

<style scoped>
.surface-colors-menu {
  border-radius: var(--surface-dialog-radius, 6px);
}

.scm-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px 10px;
}

.scm-header__text {
  min-width: 0;
}

.scm-header__subtitle {
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.scm-header__mode {
  color: rgba(var(--v-theme-primary), 0.9);
  font-weight: 600;
  margin-top: 2px;
}

.scm-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--card-item-radius, 3px);
}

.scm-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.scm-row__text {
  flex: 1 1 auto;
  min-width: 0;
}

.scm-row__label {
  font-size: 0.9rem;
  font-weight: 500;
}

.scm-row__warning {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(var(--v-theme-warning), 0.9);
  font-size: 0.72rem;
}

.scm-row__hex {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.75rem;
  font-family: monospace;
  flex-shrink: 0;
}

/* Square color sample — prism-flat, no glow. */
.scm-swatch {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.35);
  border-radius: 2px;
  flex-shrink: 0;
  cursor: pointer;
}

.scm-swatch:hover {
  border-color: rgba(var(--v-theme-primary), 0.7);
}

.scm-picker-card {
  /* Compact picker: Vuetify's own .v-color-picker width is 300px, which
     overhangs the 520px dialog when opened from the right-side swatches.
     Narrow it and tighten Vuetify's VPicker paddings so the popup hugs the
     swatch instead of covering the menu. */
  width: 236px;
}

.scm-picker-card :deep(.v-color-picker) {
  width: 100% !important;
}

.scm-picker-card :deep(.v-picker__body) {
  padding: 8px;
}

.scm-picker-card :deep(.v-color-picker-canvas) {
  max-width: 100%;
}

.scm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
}
</style>
