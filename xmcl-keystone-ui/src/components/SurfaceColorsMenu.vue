<template>
  <div>
    <v-dialog
      v-model="open"
      width="720"
      max-width="94vw"
    >
      <v-card
        class="surface-colors-menu"
        data-testid="surface-colors-menu"
        @keydown.enter="onEnterKey"
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
            icon="close"
            :aria-label="t('shared.cancel')"
            data-testid="surface-colors-close"
            @click="onCancel"
          />
        </div>
        <v-divider />

        <div class="scm-body">
          <!-- Rows -->
          <div
            class="scm-rows"
            role="listbox"
            :aria-label="t('setting.surfaceColors.name')"
          >
            <div
              v-for="(item, index) in items"
              :key="item.key"
              class="scm-row"
              :class="{ 'scm-row--selected': selectedKey === item.key }"
              role="option"
              :aria-selected="selectedKey === item.key"
              :data-testid="`surface-colors-row-${item.key}`"
              :tabindex="selectedKey === item.key ? 0 : -1"
              @click="selectRow(item.key)"
              @keydown.arrow-down.prevent="moveSelection(1)"
              @keydown.arrow-up.prevent="moveSelection(-1)"
              @keydown.home.prevent="selectIndex(0)"
              @keydown.end.prevent="selectIndex(items.length - 1)"
            >
              <span
                class="scm-row__swatch"
                :style="{ backgroundColor: draft[item.key] }"
                :data-testid="`surface-colors-swatch-${item.key}`"
              />
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
              <span
                v-if="item.changed"
                class="scm-row__changed"
                :data-testid="`surface-colors-changed-${item.key}`"
              ></span>
              <span class="scm-row__hex">{{ draft[item.key] }}</span>
              <v-btn
                variant="text"
                size="x-small"
                icon="restart_alt"
                class="scm-row__reset"
                :aria-label="t('setting.surfaceColors.resetRow')"
                :data-testid="`surface-colors-reset-row-${item.key}`"
                @click.stop="resetRow(item.key)"
              />
            </div>
          </div>

          <!-- Picker for the selected row, inside the window -->
          <div class="scm-picker">
            <v-color-picker
              :model-value="draft[selectedKey]"
              :aria-label="selectedLabel"
              canvas-height="180"
              hide-inputs
              dot-size="16"
              :data-testid="`surface-colors-picker-${selectedKey}`"
              @update:model-value="onColor(selectedKey, $event)"
            />

            <div class="scm-picker__hex">
              <v-text-field
                :model-value="hexInput"
                :label="t('setting.surfaceColors.hexLabel')"
                :error="!!hexError"
                :error-messages="hexError"
                density="compact"
                variant="outlined"
                maxlength="9"
                class="scm-hex-input"
                data-testid="surface-colors-hex-input"
                @update:model-value="onHexInput"
                @blur="commitHex"
                @keydown.enter.prevent="commitHex"
              />
              <v-btn
                v-if="eyeDropperSupported"
                variant="outlined"
                size="small"
                icon="colorize"
                :aria-label="t('setting.surfaceColors.eyeDropper')"
                data-testid="surface-colors-eye-dropper"
                @click="pickWithEyeDropper"
              />
            </div>

            <div class="scm-swatches">
              <div class="scm-swatches__title text-caption">
                {{ t('setting.surfaceColors.presets') }}
              </div>
              <div class="scm-swatches__row">
                <button
                  v-for="color in presets"
                  :key="color"
                  type="button"
                  class="scm-swatches__chip"
                  :style="{ backgroundColor: color }"
                  :aria-label="color"
                  :data-testid="`surface-colors-preset-${color.slice(1)}`"
                  @click="applyHex(color)"
                />
              </div>
            </div>

            <div v-if="recents.length" class="scm-swatches">
              <div class="scm-swatches__title text-caption">
                {{ t('setting.surfaceColors.recents') }}
              </div>
              <div class="scm-swatches__row">
                <button
                  v-for="color in recents"
                  :key="color"
                  type="button"
                  class="scm-swatches__chip"
                  :style="{ backgroundColor: color }"
                  :aria-label="color"
                  @click="applyHex(color)"
                />
              </div>
            </div>

            <!-- Preview: the four surfaces together -->
            <div class="scm-preview" data-testid="surface-colors-preview">
              <div class="scm-preview__label text-caption">{{ t('setting.surfaceColors.preview') }}</div>
              <div class="scm-preview__bg" :style="{ backgroundColor: draft.background, borderColor: draft.border }">
                <div class="scm-preview__card" :style="{ backgroundColor: draft.card, borderColor: draft.border }">
                  <div class="scm-preview__row"></div>
                  <div class="scm-preview__row scm-preview__row--short"></div>
                  <div class="scm-preview__input" :style="{ backgroundColor: draft.input, borderColor: draft.border }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <v-divider />
        <div class="scm-actions">
          <v-btn
            variant="text"
            data-testid="surface-colors-reset"
            @click="onResetAll"
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

    <!-- Reset-all confirmation: a sibling dialog so it layers above the
         editor without covering the picker or the hex value. -->
    <v-dialog v-model="resetAllShown" max-width="380" :persistent="true">
      <v-card data-testid="surface-colors-reset-confirm">
        <v-card-title class="text-body-1">{{ t('setting.surfaceColors.resetConfirmTitle') }}</v-card-title>
        <v-card-text>{{ t('setting.surfaceColors.resetConfirm') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="resetAllShown = false">{{ t('shared.cancel') }}</v-btn>
          <v-btn color="primary" data-testid="surface-colors-reset-confirm-yes" @click="doResetAll">
            {{ t('setting.surfaceColors.reset') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import {
  DEFAULT_SURFACE_COLORS,
  PRESET_SURFACE_COLORS,
  applySurfaceColors,
  readRecentColors,
  rememberRecentColor,
  surfaceContrastRatio,
  toSurfaceHex,
} from '@/composables/surfaceColors'
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { kTheme } from '@/composables/theme'
import type { SurfaceColorSet, UIThemeDataV1 } from '@/composables/theme'
import { injection } from '@/util/inject'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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

type SurfaceKey = 'background' | 'card' | 'input' | 'border'
const ROW_ORDER: SurfaceKey[] = ['background', 'card', 'input', 'border']

const draft = reactive({
  background: '',
  card: '',
  input: '',
  border: '',
} as Record<SurfaceKey, string>)

/** Theme data as it was when the menu opened — Cancel restores exactly this. */
const snapshot = shallowRef<SurfaceColorSet>({})
/** The theme's own background colors when the menu opened (Cancel restores). */
const snapshotBackground = shallowRef({ dark: '', light: '' })

const selectedKey = ref<SurfaceKey>('background')
const hexInput = ref('')
const hexError = ref('')
const recents = ref<string[]>(readRecentColors())
const resetAllShown = ref(false)
const eyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window
/** Set while Save/Cancel close the dialog, so the watcher does not restore twice. */
let closingByAction = false
/**
 * Set while the dialog is being closed or restored. The hex field fires
 * `blur` when the dialog content unmounts, and blur would re-apply the
 * draft that Cancel is throwing away — so writes are ignored while this is
 * on. Cleared when the dialog opens again.
 */
let discarding = false

const items = computed(() => {
  const entries: Array<{ key: SurfaceKey; label: string }> = [
    { key: 'background', label: t('setting.surfaceColors.background') },
    { key: 'card', label: t('setting.surfaceColors.card') },
    { key: 'input', label: t('setting.surfaceColors.input') },
    { key: 'border', label: t('setting.surfaceColors.border') },
  ]
  const opened = openedValues()
  return entries.map(e => ({
    ...e,
    changed: draft[e.key] !== opened[e.key],
    lowContrast: (surfaceContrastRatio(draft[e.key], isDark.value) ?? 4) < 3,
  }))
})

const selectedLabel = computed(() => items.value.find(i => i.key === selectedKey.value)?.label ?? '')
const presets = computed(() => (isDark.value ? PRESET_SURFACE_COLORS.dark : PRESET_SURFACE_COLORS.light))

function defaults(): Record<SurfaceKey, string> {
  return isDark.value ? { ...DEFAULT_SURFACE_COLORS.dark } : { ...DEFAULT_SURFACE_COLORS.light }
}

function draftSet(): SurfaceColorSet {
  return {
    background: draft.background,
    card: draft.card,
    input: draft.input,
    border: draft.border,
  }
}

function themeBackgroundKey() {
  return isDark.value ? 'darkBackground' : 'lightBackground'
}

function snapshotBackgroundValue() {
  return snapshotBackground.value[isDark.value ? 'dark' : 'light']
}

/** The effective value each row had when the dialog opened. */
function openedValues(): Record<SurfaceKey, string> {
  const d = defaults()
  const set = snapshot.value
  return {
    background: set.background || toSurfaceHex(props.theme.colors[themeBackgroundKey()]) || d.background,
    card: set.card || d.card,
    input: set.input || d.input,
    border: set.border || d.border,
  }
}

function fillDraft(set: SurfaceColorSet | undefined) {
  const d = defaults()
  const opened = openedValues()
  for (const key of ROW_ORDER) {
    draft[key] = set?.[key] || d[key]
  }
  // The background comes from the theme's own color (which may carry an alpha
  // byte the editor does not show); normalize it to #RRGGBB.
  draft.background = toSurfaceHex(set?.background) || opened.background
}

function applyDraft(set: SurfaceColorSet | undefined, backgroundWithoutOverride?: string) {
  applySurfaceColors(set, isDark.value, tokens, props.theme, backgroundWithoutOverride)
}

watch(open, (shown) => {
  if (!shown) {
    // Esc / scrim / any path that skipped Cancel must restore the snapshot.
    if (!closingByAction) restoreSnapshot()
    return
  }
  const set = props.theme.surfaceColors?.[isDark.value ? 'dark' : 'light']
  snapshot.value = { ...set }
  snapshotBackground.value = {
    dark: props.theme.colors.darkBackground,
    light: props.theme.colors.lightBackground,
  }
  selectedKey.value = 'background'
  discarding = false
  fillDraft(set)
  hexInput.value = draft.background
  hexError.value = ''
  recents.value = readRecentColors()
  applyDraft(draftSet())
}, { immediate: true })

// ── Row selection ────────────────────────────────────────────────────────

function selectRow(key: SurfaceKey) {
  selectedKey.value = key
  hexInput.value = draft[key]
  hexError.value = ''
}

function moveSelection(delta: number) {
  const index = ROW_ORDER.indexOf(selectedKey.value)
  const next = Math.min(ROW_ORDER.length - 1, Math.max(0, index + delta))
  if (next !== index) selectIndex(next)
}

function selectIndex(index: number) {
  const key = ROW_ORDER[index]
  if (!key) return
  selectRow(key)
  nextTick(() => {
    document.querySelector<HTMLElement>(`[data-testid="surface-colors-row-${key}"]`)?.focus()
  })
}

// ── Color entry ──────────────────────────────────────────────────────────

function onHexInput(value: string) {
  hexInput.value = value
  const hex = toSurfaceHex(value)
  if (hex) {
    hexError.value = ''
    setDraftColor(selectedKey.value, hex)
  } else {
    hexError.value = t('setting.surfaceColors.hexInvalid')
  }
}

function commitHex() {
  const hex = toSurfaceHex(hexInput.value)
  if (hex) {
    hexError.value = ''
    setDraftColor(selectedKey.value, hex)
    hexInput.value = hex
    return
  }
  // Invalid input: revert to the current value and clear the red frame.
  hexInput.value = draft[selectedKey.value]
  hexError.value = ''
}

function onColor(key: SurfaceKey, value: any) {
  const hex = toSurfaceHex(value)
  if (!hex) return
  setDraftColor(key, hex)
  if (selectedKey.value === key) hexInput.value = hex
}

function applyHex(hex: string) {
  onColor(selectedKey.value, hex)
  hexInput.value = draft[selectedKey.value]
  hexError.value = ''
}

function setDraftColor(key: SurfaceKey, hex: string) {
  // A blur that fires while the dialog is being discarded must not re-apply
  // the value Cancel is restoring from.
  if (discarding) return
  draft[key] = hex
  // Live preview only; nothing persists until Save.
  applyDraft(draftSet())
}

async function pickWithEyeDropper() {
  const ctor = (window as any).EyeDropper
  if (!ctor) return
  try {
    const result = await new ctor().open()
    const hex = toSurfaceHex(result?.sRGBHex)
    if (hex) applyHex(hex)
  } catch {
    // The user dismissed the picker; nothing to do.
  }
}

function resetRow(key: SurfaceKey) {
  if (key === 'background') {
    draft.background = snapshotBackgroundValue() || defaults().background
  } else {
    draft[key] = defaults()[key]
  }
  applyDraft(draftSet(), snapshotBackgroundValue())
  if (selectedKey.value === key) {
    hexInput.value = draft[key]
    hexError.value = ''
  }
}

// ── Save / Cancel / Reset ────────────────────────────────────────────────

function restoreSnapshot() {
  discarding = true
  applyDraft(snapshot.value, snapshotBackgroundValue())
}

function onSave() {
  const mode = isDark.value ? 'dark' : 'light'
  props.theme.surfaceColors = props.theme.surfaceColors ?? {}
  props.theme.surfaceColors[mode] = draftSet()
  for (const key of ROW_ORDER) {
    recents.value = rememberRecentColor(draft[key])
  }
  closingByAction = true
  emit('save')
  open.value = false
}

function onCancel() {
  restoreSnapshot()
  closingByAction = true
  open.value = false
}

function onResetAll() {
  resetAllShown.value = true
}

/**
 * Enter saves — unless the focus sits in a text field, where Enter commits
 * the typed value instead (handled by the field's own keydown).
 */
function onEnterKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  event.preventDefault()
  onSave()
}

function doResetAll() {
  resetAllShown.value = false
  const opened = openedValues()
  draft.background = opened.background
  draft.card = defaults().card
  draft.input = defaults().input
  draft.border = defaults().border
  applyDraft(undefined, snapshotBackgroundValue())
  selectedKey.value = 'background'
  hexInput.value = draft.background
  hexError.value = ''
}
</script>

<style scoped>
.surface-colors-menu {
  border-radius: var(--surface-dialog-radius, 6px);
  /* Keep the dialog inside a short window (800x400 minimum): the body
     scrolls, the action bar stays put. */
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  align-items: flex-start;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* Left column: the four rows. */
.scm-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 300px;
  flex: 0 0 auto;
}

.scm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--card-item-radius, 3px);
  cursor: pointer;
}

.scm-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.scm-row--selected {
  background: rgba(var(--v-theme-on-surface), 0.07);
  border-color: rgba(var(--v-theme-primary), 0.55);
}

.scm-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.scm-row__swatch {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.35);
  border-radius: 2px;
  flex-shrink: 0;
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

.scm-row__changed {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.scm-row__hex {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.75rem;
  font-family: monospace;
  flex-shrink: 0;
}

.scm-row__reset {
  flex-shrink: 0;
  opacity: 0.6;
}

.scm-row__reset:hover {
  opacity: 1;
}

/* Right column: picker for the selected row, inside the window. */
.scm-picker {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scm-picker__hex {
  display: flex;
  align-items: start;
  gap: 8px;
}

.scm-hex-input {
  flex: 1 1 auto;
  min-width: 0;
}

.scm-swatches__title {
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 4px;
}

.scm-swatches__row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.scm-swatches__chip {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.35);
  border-radius: 2px;
  padding: 0;
  cursor: pointer;
}

.scm-swatches__chip:hover {
  border-color: rgb(var(--v-theme-primary));
}

.scm-swatches__chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

/* Preview: background + card + input + border together. */
.scm-preview {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding-top: 10px;
}

.scm-preview__label {
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 6px;
}

.scm-preview__bg {
  border: 1px solid;
  padding: 10px;
}

.scm-preview__card {
  border: 1px solid;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scm-preview__row {
  height: 8px;
  background-color: rgba(var(--v-theme-on-surface), 0.22);
}

.scm-preview__row--short {
  width: 60%;
}

.scm-preview__input {
  height: 24px;
  border: 1px solid;
}

.scm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
}

@media (max-width: 760px) {
  .scm-body {
    flex-direction: column;
  }

  .scm-rows {
    width: 100%;
  }
}
</style>