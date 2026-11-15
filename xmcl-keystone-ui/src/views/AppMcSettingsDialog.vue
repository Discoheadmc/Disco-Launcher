<template>
  <v-dialog
    v-model="isShown"
    :persistent="false"
    :width="760"
    max-width="94vw"
  >
    <v-card>
      <v-card-title class="d-flex align-center gap-2">
        <v-icon size="20">tune</v-icon>
        <span>{{ t('instance.mcSettings') }}</span>
        <span v-if="name" class="text-caption" style="opacity: 0.65">{{ name }}</span>
        <v-icon
          v-if="isFavoriteOfThis"
          size="18"
          class="mc-settings-favorite"
          data-testid="mc-settings-favorite-star"
        >star</v-icon>
        <v-spacer />
        <v-btn variant="text" size="small" :aria-label="t('shared.close')" @click="onCancel">
          <v-icon size="18">close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />

      <v-card-text style="max-height: 70vh; overflow-y: auto">
        <div v-if="loading" class="d-flex justify-center py-8">
          <v-progress-circular indeterminate size="28" />
        </div>

        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mc-settings-alert"
          data-testid="mc-settings-error"
        >
          {{ error }}
        </v-alert>

        <template v-else>
          <v-alert
            v-if="!editable"
            type="warning"
            variant="tonal"
            density="compact"
            class="mc-settings-alert"
            data-testid="mc-settings-running-warning"
          >
            {{ t('mcSettings.runningWarning') }}
          </v-alert>

          <div v-if="path" class="text-caption mb-3" style="opacity: 0.6">{{ path }}</div>

          <div v-if="groups.length === 0" class="text-body-2" style="opacity: 0.7">
            {{ t('mcSettings.empty') }}
          </div>

          <div
            v-for="group in groups"
            :key="group.key"
            class="mc-settings-group mb-5"
          >
            <div class="mc-settings-group__title">
              <v-icon size="18">{{ group.icon }}</v-icon>
              <span>{{ t(`mcSettings.group.${group.key}`) }}</span>
            </div>
            <v-row class="mc-settings-row">
              <v-col v-for="field in group.fields" :key="field.key" :cols="field.cols" :md="field.cols">
                <v-slider
                  v-if="field.control === 'slider'"
                  v-model="form[field.key]"
                  :label="t(`mcSettings.field.${field.key}`)"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :disabled="!editable"
                  thumb-label
                  hide-details
                  density="compact"
                  color="primary"
                />
                <v-switch
                  v-else-if="field.control === 'switch'"
                  v-model="form[field.key]"
                  :label="t(`mcSettings.field.${field.key}`)"
                  :disabled="!editable"
                  color="primary"
                  hide-details
                  density="compact"
                />
                <v-select
                  v-else-if="field.control === 'select'"
                  v-model="form[field.key]"
                  :label="t(`mcSettings.field.${field.key}`)"
                  :items="field.items"
                  item-title="title"
                  item-value="value"
                  :disabled="!editable"
                  hide-details
                  density="compact"
                  variant="outlined"
                />
                <v-text-field
                  v-else
                  v-model="form[field.key]"
                  :label="t(`mcSettings.field.${field.key}`)"
                  :disabled="!editable"
                  hide-details
                  density="compact"
                  variant="outlined"
                />
              </v-col>
            </v-row>
          </div>

          <v-expansion-panels v-if="skipped.length" variant="accordion" class="mt-2">
            <v-expansion-panel>
              <v-expansion-panel-title class="text-caption">
                {{ t('mcSettings.skipped') }} ({{ skipped.length }})
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="text-caption" style="opacity: 0.75">{{ skipped.join(', ') }}</div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-divider class="my-4" />

          <div class="d-flex align-center flex-wrap ga-2 mc-settings-actions">
            <v-btn
              v-if="isFavoriteOfThis"
              variant="text"
              size="small"
              prepend-icon="star"
              @click="onRemoveFavorite"
            >
              {{ t('mcSettings.removeFavorite') }}
            </v-btn>
            <v-btn
              v-else
              variant="text"
              size="small"
              prepend-icon="star_outline"
              :disabled="!editable"
              @click="onSaveFavorite"
            >
              {{ t('mcSettings.saveAsFavorite') }}
            </v-btn>

            <v-btn
              v-if="hasFavorite && !isFavoriteOfThis"
              variant="text"
              color="primary"
              size="small"
              prepend-icon="get_app"
              :disabled="!editable"
              data-testid="mc-settings-apply-favorite"
              @click="onApplyFavorite"
            >
              {{ t('mcSettings.applyFavorite') }}
            </v-btn>

            <v-spacer />

            <v-btn variant="text" size="small" @click="onCancel">
              {{ t('shared.cancel') }}
            </v-btn>
            <v-btn
              color="primary"
              size="small"
              :disabled="!editable || saving || !dirty"
              :loading="saving"
              data-testid="mc-settings-save"
              @click="onSave"
            >
              {{ t('shared.save') }}
            </v-btn>
          </div>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmShown" max-width="420" :persistent="true">
    <v-card data-testid="mc-settings-confirm">
      <v-card-title class="text-body-1">{{ t('mcSettings.confirmTitle') }}</v-card-title>
      <v-card-text>{{ confirmMessage }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmShown = false">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          data-testid="mc-settings-confirm-yes"
          @click="onConfirmYes"
        >
          {{ t('shared.ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useNotifier } from '@/composables/notifier'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { MC_FAVORITE_EXCLUDED_KEYS, toFavoriteSettings, useMcSettingsFavorite } from '@/composables/mcSettingsFavorite'
import { injection } from '@/util/inject'
import { EditGameSettingOptions, InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { computed, ref, watch } from 'vue'

interface FieldOption {
  value: any
  label: string
}

interface FieldDef {
  key: string
  control: 'slider' | 'switch' | 'select' | 'text'
  default: any
  cols?: number
  min?: number
  max?: number
  step?: number
  options?: FieldOption[]
  /** Legacy/removed keys that should not be offered when options.txt is absent. */
  hideWhenMissing?: boolean
}

interface GroupDef {
  key: string
  /** Material icon shown next to the group subheading. */
  icon: string
  fields: FieldDef[]
}

interface RenderedField {
  key: string
  control: FieldDef['control']
  cols: number
  min?: number
  max?: number
  step?: number
  items?: Array<{ value: any; title: string }>
}

const SOUND_KEYS: string[] = [
  'soundCategory_master',
  'soundCategory_music',
  'soundCategory_record',
  'soundCategory_weather',
  'soundCategory_block',
  'soundCategory_hostile',
  'soundCategory_neutral',
  'soundCategory_player',
  'soundCategory_ambient',
  'soundCategory_voice',
  'soundCategory_ui',
]

const CATALOG: GroupDef[] = [
  {
    key: 'video',
    icon: 'videocam',
    fields: [
      { key: 'renderDistance', control: 'slider', default: 12, min: 2, max: 32, step: 1 },
      { key: 'fov', control: 'slider', default: 70, min: 30, max: 110, step: 1 },
      {
        key: 'graphicsMode',
        control: 'select',
        default: 1,
        options: [
          { value: 0, label: 'graphics_fast' },
          { value: 1, label: 'graphics_fancy' },
          { value: 2, label: 'graphics_fabulous' },
        ],
      },
      { key: 'fancyGraphics', control: 'switch', default: true, hideWhenMissing: true },
      {
        key: 'ao',
        control: 'select',
        default: true,
      },
      {
        key: 'renderClouds',
        control: 'select',
        default: true,
      },
      {
        key: 'particles',
        control: 'select',
        default: 1,
        options: [
          { value: 0, label: 'particles_all' },
          { value: 1, label: 'particles_decreased' },
          { value: 2, label: 'particles_minimal' },
        ],
      },
      { key: 'mipmapLevels', control: 'slider', default: 4, min: 0, max: 4, step: 1 },
      { key: 'entityShadows', control: 'switch', default: true },
      { key: 'guiScale', control: 'slider', default: 0, min: 0, max: 4, step: 1 },
      { key: 'maxFps', control: 'slider', default: 120, min: 10, max: 260, step: 10 },
      { key: 'gamma', control: 'slider', default: 0, min: 0, max: 1, step: 0.01 },
      { key: 'fullscreen', control: 'switch', default: false },
      { key: 'enableVsync', control: 'switch', default: true, hideWhenMissing: true },
    ],
  },
  {
    key: 'audio',
    icon: 'volume_up',
    fields: SOUND_KEYS.map((key) => ({
      key,
      control: 'slider' as const,
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
    })),
  },
  {
    key: 'controls',
    icon: 'mouse',
    fields: [
      { key: 'mouseSensitivity', control: 'slider', default: 0.5, min: 0, max: 1, step: 0.01 },
      { key: 'invertYMouse', control: 'switch', default: false },
      { key: 'autoJump', control: 'switch', default: true },
      { key: 'touchscreen', control: 'switch', default: false },
      {
        key: 'difficulty',
        control: 'select',
        default: 2,
        options: [
          { value: 0, label: 'difficulty_peaceful' },
          { value: 1, label: 'difficulty_easy' },
          { value: 2, label: 'difficulty_normal' },
          { value: 3, label: 'difficulty_hard' },
        ],
      },
    ],
  },
  {
    key: 'language',
    icon: 'translate',
    fields: [
      { key: 'lang', control: 'text', default: 'en_us', cols: 6, hideWhenMissing: true },
      { key: 'forceUnicodeFont', control: 'switch', default: false },
    ],
  },
  {
    key: 'chat',
    icon: 'forum',
    fields: [
      {
        key: 'chatVisibility',
        control: 'select',
        default: 0,
        options: [
          { value: 0, label: 'chat_full' },
          { value: 1, label: 'chat_system' },
          { value: 2, label: 'chat_hidden' },
        ],
      },
      { key: 'chatColors', control: 'switch', default: true },
      { key: 'chatLinks', control: 'switch', default: true },
      { key: 'chatLinksPrompt', control: 'switch', default: true },
      { key: 'chatOpacity', control: 'slider', default: 1, min: 0, max: 1, step: 0.01 },
    ],
  },
]

const { t } = useI18n()
const { isShown, parameter } = useDialog<{ path: string; name: string }>('mc-settings')
const { notify } = useNotifier()
const { getGameOptions, editGameSetting } = useService(InstanceOptionsServiceKey)
const { count: runningCount } = injection(kInstanceLaunch)
const { favorite, hasFavorite, isFavoriteOf, saveFavorite, removeFavorite } = useMcSettingsFavorite()

const name = ref('')
const path = ref('')
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const missing = ref(false)
/** `fov` is stored as a normalized 0..1 factor in 1.16+ and as 30..110 degrees before that. */
const fovNormalized = ref(true)

const confirmShown = ref(false)
const confirmMessage = ref('')
let confirmAction: (() => void) | null = null

function askConfirm(message: string, action: () => void) {
  confirmMessage.value = message
  confirmAction = action
  confirmShown.value = true
}

function onConfirmYes() {
  confirmShown.value = false
  const action = confirmAction
  confirmAction = null
  action?.()
}

/** Parsed options.txt content (baseline of the file on disk). */
const settings = ref<Record<string, any>>({})
/** Editable values bound to the controls. */
const form = ref<Record<string, any>>({})
/** Snapshot of `form` that represents the last saved state. */
const baseline = ref<Record<string, any>>({})

const editable = computed(() => runningCount.value === 0)
const isFavoriteOfThis = computed(() => isFavoriteOf(path.value))

function isVisible(field: FieldDef, source: Record<string, any>, missingFile: boolean) {
  if (field.key in source) return true
  if (!missingFile) return false
  return !field.hideWhenMissing
}

function rawToDisplay(key: string, value: any) {
  if (key === 'fov' && fovNormalized.value && typeof value === 'number') {
    return Math.round(30 + value * 80)
  }
  return value
}

function displayToRaw(key: string, value: any) {
  if (key === 'fov' && fovNormalized.value && typeof value === 'number') {
    return (value - 30) / 80
  }
  return value
}

function buildForm(source: Record<string, any>, missingFile: boolean) {
  const result: Record<string, any> = {}
  for (const group of CATALOG) {
    for (const field of group.fields) {
      if (!isVisible(field, source, missingFile)) continue
      result[field.key] = field.key in source
        ? rawToDisplay(field.key, source[field.key])
        : field.default
    }
  }
  return result
}

/**
 * Build the option list for the value-shaped enums. `ao` is a boolean in
 * 1.16+ but a 0/1/2 ordinal before it; `renderClouds` is a quoted string
 * (`"true"`/`"false"`/`"fast"`) in modern files but a boolean/`fast` earlier.
 * Matching the actual stored shape keeps the write round-trip safe.
 */
function fieldItems(field: FieldDef, value: any): Array<{ value: any; title: string }> | undefined {
  if (field.key === 'ao') {
    const items: Array<{ value: any; title: string }> = typeof value === 'boolean'
      ? [
          { value: true, title: t('mcSettings.option.bool_on') },
          { value: false, title: t('mcSettings.option.bool_off') },
        ]
      : [
          { value: 0, title: t('mcSettings.option.ao_off') },
          { value: 1, title: t('mcSettings.option.ao_min') },
          { value: 2, title: t('mcSettings.option.ao_max') },
        ]
    if (!items.some((i) => i.value === value)) items.push({ value, title: String(value) })
    return items
  }
  if (field.key === 'renderClouds') {
    const quoted = typeof value === 'string' && value.startsWith('"')
    const wrap = (s: string) => (quoted ? `"${s}"` : s)
    const items: Array<{ value: any; title: string }> = [
      { value: quoted ? '"false"' : false, title: t('mcSettings.option.clouds_off') },
      { value: wrap('fast'), title: t('mcSettings.option.clouds_fast') },
      { value: quoted ? '"true"' : true, title: t('mcSettings.option.clouds_fancy') },
    ]
    if (!items.some((i) => i.value === value)) items.push({ value, title: String(value) })
    return items
  }
  if (field.options) {
    const items = field.options.map((o) => ({
      value: o.value,
      title: t(`mcSettings.option.${o.label}`),
    }))
    if (!items.some((i) => i.value === value)) items.push({ value, title: String(value) })
    return items
  }
  return undefined
}

const groups = computed(() => {
  const source = settings.value
  const missingFile = missing.value
  const result: Array<{ key: string; icon: string; fields: RenderedField[] }> = []
  for (const group of CATALOG) {
    const fields: RenderedField[] = []
    for (const field of group.fields) {
      if (!isVisible(field, source, missingFile)) continue
      const value = form.value[field.key]
      const boolAo = field.key === 'ao' && typeof value === 'boolean'
      fields.push({
        key: field.key,
        control: boolAo ? 'switch' : field.control,
        cols: field.cols ?? 6,
        min: field.min,
        max: field.max,
        step: field.step,
        items: boolAo ? undefined : fieldItems(field, value),
      })
    }
    if (fields.length) result.push({ key: group.key, icon: group.icon, fields })
  }
  return result
})

const skipped = computed(() => {
  const known = new Set<string>()
  for (const group of CATALOG) {
    for (const field of group.fields) known.add(field.key)
  }
  return Object.keys(settings.value).filter((key) =>
    !known.has(key) &&
    !key.startsWith('key_') &&
    !key.startsWith('modelPart_') &&
    !MC_FAVORITE_EXCLUDED_KEYS.includes(key),
  )
})

function computePatch() {
  const patch: Record<string, any> = {}
  for (const key of Object.keys(form.value)) {
    if (form.value[key] !== baseline.value[key]) {
      patch[key] = displayToRaw(key, form.value[key])
    }
  }
  return patch
}

const dirty = computed(() => Object.keys(computePatch()).length > 0)

async function load() {
  const param = parameter.value
  path.value = param && typeof param === 'object' && param.path ? param.path : ''
  name.value = param && typeof param === 'object' && param.name ? param.name : ''
  if (!path.value) return

  loading.value = true
  error.value = ''
  try {
    const result = await getGameOptions(path.value, { createIfMissing: false }) as Record<string, any>
    settings.value = result ?? {}
    const keys = Object.keys(settings.value)
    missing.value = keys.length === 0
    const fovRaw = settings.value.fov
    fovNormalized.value = missing.value || (typeof fovRaw === 'number' && fovRaw <= 1)
    form.value = buildForm(settings.value, missing.value)
    baseline.value = { ...form.value }
  } catch (e) {
    error.value = t('mcSettings.loadFailed')
    console.error('Failed to load game options', e)
  } finally {
    loading.value = false
  }
}

function onCancel() {
  isShown.value = false
}

async function onSave() {
  const patch = computePatch()
  if (Object.keys(patch).length === 0) {
    isShown.value = false
    return
  }
  saving.value = true
  try {
    await editGameSetting({ instancePath: path.value, ...patch } as EditGameSettingOptions)
    Object.assign(settings.value, patch)
    baseline.value = { ...form.value }
    notify({ level: 'success', title: t('mcSettings.saved') })
    isShown.value = false
  } catch (e) {
    notify({ level: 'error', title: t('mcSettings.saveFailed'), body: String((e as any)?.message ?? e) })
    console.error('Failed to save game options', e)
  } finally {
    saving.value = false
  }
}

function onSaveFavorite() {
  const capture = () => {
    saveFavorite({
      sourcePath: path.value,
      sourceName: name.value,
      settings: toFavoriteSettings(baseline.value),
    })
    notify({ level: 'success', title: t('mcSettings.favoriteSaved') })
  }
  if (hasFavorite.value) {
    askConfirm(t('mcSettings.overwriteFavorite'), capture)
  } else {
    capture()
  }
}

function onRemoveFavorite() {
  removeFavorite()
  notify({ level: 'info', title: t('mcSettings.favoriteRemoved') })
}

async function applyFavoriteSettings(
  applicableRaw: Record<string, any>,
  skippedKeys: string[],
) {
  saving.value = true
  try {
    await editGameSetting({ instancePath: path.value, ...applicableRaw } as EditGameSettingOptions)
    for (const [key, value] of Object.entries(applicableRaw)) {
      if (key in form.value) form.value[key] = rawToDisplay(key, value)
      settings.value[key] = value
    }
    baseline.value = { ...form.value }
    if (skippedKeys.length > 0) {
      notify({
        level: 'warning',
        title: t('mcSettings.applySkipped', { count: skippedKeys.length }),
        body: skippedKeys.join(', '),
      })
    } else {
      notify({ level: 'success', title: t('mcSettings.applyDone') })
    }
  } catch (e) {
    notify({ level: 'error', title: t('mcSettings.saveFailed'), body: String((e as any)?.message ?? e) })
    console.error('Failed to apply favorite settings', e)
  } finally {
    saving.value = false
  }
}

function onApplyFavorite() {
  const fav = favorite.value
  if (!fav) return

  const targetKeys = new Set(Object.keys(settings.value))
  const applicableRaw: Record<string, any> = {}
  const skippedKeys: string[] = []
  for (const [key, value] of Object.entries(fav.settings)) {
    // Never write a setting the target instance does not already know about,
    // unless the target file is missing entirely (then it is created with the
    // changes only). This keeps us from injecting keys the running version
    // would ignore or rewrite.
    if (missing.value || targetKeys.has(key)) {
      applicableRaw[key] = displayToRaw(key, value)
    } else {
      skippedKeys.push(key)
    }
  }

  const count = Object.keys(applicableRaw).length
  if (count === 0) {
    notify({ level: 'info', title: t('mcSettings.applyEmpty') })
    return
  }
  askConfirm(
    t('mcSettings.applyConfirm', { count }),
    () => applyFavoriteSettings(applicableRaw, skippedKeys),
  )
}

watch(isShown, (shown) => {
  if (shown) {
    load()
  }
}, { immediate: true })
</script>

<style scoped>
/* Sliders render 29px tall at compact density while switches, selects and
   text fields render 40px, so a mixed row looked ragged. Pin every control to
   the taller of the two. */
.mc-settings-group :deep(.v-input) {
  min-height: 40px;
}

/* `dense` collapsed the gutters; a plain row with an explicit row gap keeps
   the two columns apart and gives the stacked controls room to breathe. */
.mc-settings-row {
  row-gap: 12px;
}

/* Slightly raised above the field labels so a group reads as a heading rather
   than another setting, without introducing a new colour. */
.mc-settings-group__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: rgba(var(--v-theme-on-surface), 0.74);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.mc-settings-group__title :deep(.v-icon) {
  opacity: 0.85;
}

/* Plain favourite marker: the title already says which instance is open, so
   the star only needs to be readable, not loud. */
.mc-settings-favorite {
  opacity: 0.62;
}

.mc-settings-alert {
  margin-bottom: 12px;
}

.mc-settings-actions {
  padding-top: 4px;
}
</style>
