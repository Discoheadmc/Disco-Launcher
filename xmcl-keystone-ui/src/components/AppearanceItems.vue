<template>
    <SettingItemSelect
      v-model="darkModel"
      :title="t('setting.darkTheme')"
      :description="t('setting.darkThemeDescription')"
      :items="themes"
    />
    <!-- Disco (task 5, restored): free-form per-surface color customization
         is back. Blur sliders stay removed (minimal theme decision from G5).
         All colors are stored in the theme object, so they flow through the
         existing export/import/persist theme pipeline untouched. -->
    <div class="color-theme-row">
      <div class="color-theme-row__reset">
        <v-tooltip color="warning" location="end">
          <template #activator="{ props: tooltipProps }">
            <v-btn icon variant="text" v-bind="tooltipProps" @click="resetToDefault">
              <v-icon> restore </v-icon>
            </v-btn>
          </template>
          {{ t('setting.resetToDefault') }}
        </v-tooltip>
      </div>

      <div class="color-theme-row__text">
        <div class="color-theme-row__title">
          {{ t('setting.colorTheme.name') }}
        </div>
        <div class="color-theme-row__subtitle">
          {{ t('setting.colorTheme.description') }}
        </div>
      </div>

      <div class="color-theme-row__colors">
        <SettingAppearanceColor
          v-model="appBarColor"
          :text="t('setting.colorTheme.appBarColor')"
        />
        <SettingAppearanceColor
          v-model="sideBarColor"
          :text="t('setting.colorTheme.sideBarColor')"
        />
        <SettingAppearanceColor
          v-model="primaryColor"
          :text="t('setting.colorTheme.primaryColor')"
        />
        <SettingAppearanceColor
          v-model="cardColor"
          :text="t('setting.colorTheme.cardColor')"
        />
        <SettingAppearanceColor
          v-model="backgroundColor"
          :text="t('setting.colorTheme.backgroundColor')"
        />
        <SettingAppearanceColor
          v-model="warningColor"
          :text="t('setting.colorTheme.warningColor')"
        />
        <SettingAppearanceColor v-model="errorColor" :text="t('setting.colorTheme.errorColor')" />
        <!-- Disco: dedicated color for the instance "launch" button, independent
             from the accent/primary color. Empty = built-in green style. -->
        <SettingAppearanceColor
          v-model="launchButtonColor"
          :text="t('setting.colorTheme.launchButtonColor')"
        />
      </div>
    </div>
    <SettingItemSelect
      v-model="backgroundType"
      :title="t('setting.backgroundType')"
      :description="t('setting.backgroundTypeDescription')"
      :items="backgroundTypes"
    />
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItemCheckbox
      v-model="backgroundColorOverlay"
      :title="t('setting.backgroundColorAbove')"
      :description="t('setting.backgroundColorAboveDescription')"
    />
    <!-- Disco (task 5): particle/halo/video backgrounds and background
         music were removed (minimal theme, low resource usage). Only
         None and Image remain. -->
    <SettingItem
      v-if="backgroundType === 'image'"
      :title="t('setting.backgroundImage')"
      :description="t('setting.backgroundImageDescription')"
      long-action
    >
      <template #action>
        <v-btn
          v-shared-tooltip="() => t('setting.useDesktopBackground')"
          icon
          variant="text"
          class="mr-2"
          :loading="settingDesktopBackground"
          @click="applyDesktopBackground"
        >
          <v-icon>wallpaper</v-icon>
        </v-btn>
        <v-select
          v-model="backgroundImageFit"
          class="mr-4 w-40"
          variant="outlined"
          density="compact"
          hide-details
          item-title="text"
          item-value="value"
          :label="t('setting.backgroundImageFit.name')"
          :items="backgroundImageFits"
        />
        <v-btn variant="outlined" class="mr-2" :disabled="!backgroundImage" @click="clearImage">
          {{ t('setting.backgroundImageClear') }}
        </v-btn>
        <v-menu open-on-hover close-delay="100">
          <template #activator="{ props: activatorProps }">
            <v-btn variant="outlined" v-bind="activatorProps" @click="selectImage">
              {{ t('setting.select') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item @click="showImageUrlDialog = true">
              <template #prepend>
                <v-icon>link</v-icon>
              </template>
              <v-list-item-title>{{ t('setting.enterUrl') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </SettingItem>
    <!-- Disco (task 5): background music was removed together with the
         particle/halo/video backgrounds. -->
    <v-divider v-if="!props.dense && backgroundType === 'image'" class="my-3" />
    <!-- Disco (task 5): the font size controls were removed — typography is
         fixed in the minimal theme. Font family selection remains. -->
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem
      :title="t('setting.themeFont')"
      :description="t('setting.themeFontDescription')"
      long-action
    >
      <template #action>
        <v-menu open-on-hover close-delay="100">
          <template #activator="{ props: activatorProps }">
            <v-btn variant="outlined" class="mr-2" v-bind="activatorProps" @click="onSelectFont">
              {{ t('setting.themeSelectFont') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item @click="showFontUrlDialog = true">
              <template #prepend>
                <v-icon>link</v-icon>
              </template>
              <v-list-item-title>{{ t('setting.enterUrl') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn variant="outlined" @click="onRevertFont">
          {{ t('setting.themeResetFont') }}
        </v-btn>
      </template>
    </SettingItem>
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem
      :title="t('setting.customCss.title')"
      :description="t('setting.customCss.advancedDescription')"
    >
      <template #action>
        <v-switch
          :model-value="cssEnabled"
          color="primary"
          hide-details
          density="compact"
          :aria-label="t('setting.customCss.title')"
          data-testid="custom-css-global-toggle"
          @update:model-value="onToggleCss"
        />
      </template>
    </SettingItem>
    <CustomCssEditor
      v-if="cssEnabled"
      :css="cssContent"
      @update:css="saveCss"
    />
    <v-divider v-if="!props.dense" class="my-3" />
    <SettingItem :title="t('setting.themeShare')" :description="t('setting.themeShareDescription')">
      <template #action>
        <v-btn variant="outlined" class="mr-2" @click="onExportTheme">
          {{ t('setting.themeExport') }}
        </v-btn>
        <v-btn variant="outlined" @click="onImportTheme">
          {{ t('setting.themeImport') }}
        </v-btn>
      </template>
    </SettingItem>

    <!-- Image URL Dialog -->
    <v-dialog v-model="showImageUrlDialog" max-width="500">
      <v-card :title="t('setting.backgroundImageUrl')">
        <v-card-text>
          <v-text-field
            v-model="imageUrlInput"
            autofocus
            variant="filled"
            :label="t('setting.backgroundImageUrlPlaceholder')"
            @keydown.enter="applyImageUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showImageUrlDialog = false" variant="outlined">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!imageUrlInput"
            @click="applyImageUrl"
            variant="outlined"
          >
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Disco (task 5): the video/music URL dialogs were removed with the
         video background and background music settings. -->

    <!-- Font URL Dialog -->
    <v-dialog v-model="showFontUrlDialog" max-width="500">
      <v-card :title="t('setting.themeFontUrl')">
        <v-card-text>
          <v-text-field
            v-model="fontUrlInput"
            autofocus
            variant="filled"
            :label="t('setting.themeFontUrlPlaceholder')"
            @keydown.enter="applyFontUrl"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFontUrlDialog = false" variant="outlined">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!fontUrlInput" @click="applyFontUrl" variant="outlined">
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</template>
<script lang="ts" setup>
import CustomCssEditor from '@/components/CustomCssEditor.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingAppearanceColor from '@/components/SettingAppearanceColor.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { kCustomCss } from '@/composables/customCss'
import { kEnvironment } from '@/composables/environment'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { kSettingsState } from '@/composables/setting'
import { BackgroundType, UIThemeDataV1, useThemeWritter } from '@/composables/theme'
import { injection } from '@/util/inject'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{
  theme: UIThemeDataV1
  /**
   * If provided, media files will be stored under the instance's theme folder.
   * This keeps instance theme media separate from global theme media.
   */
  instancePath?: string

  dense?: boolean
}>()
const { showOpenDialog, showSaveDialog } = windowController
const { t } = useI18n()
const env = injection(kEnvironment)

// Default folder to open in the font picker: the OS system font directory.
const defaultFontFolder = computed(() => {
  switch (env.value?.os) {
    case 'windows':
      return 'C:\\Windows\\Fonts'
    case 'osx':
      return '/System/Library/Fonts'
    case 'linux':
      return '/usr/share/fonts'
    default:
      return undefined
  }
})

const emit = defineEmits<{
  (e: 'save'): void
}>()
const {
  backgroundImage,
  setBackgroundImage,
  setBackgroundImageUrl,
  setBackgroundToDesktop,
  clearBackgroundImage,
  exportTheme,
  importTheme,
  resetToDefault,
  setFont,
  setFontUrl,
  resetFont,
  backgroundColorOverlay,
  backgroundType,
  backgroundImageFit,
  appBarColor,
  sideBarColor,
  primaryColor,
  cardColor,
  backgroundColor,
  warningColor,
  errorColor,
  launchButtonColor,
  dark,
} = useThemeWritter(
  computed(() => props.theme),
  () => emit('save'),
  { instancePath: props.instancePath },
)

// When switching to an image background, enable the color overlay and
// cap the background color's alpha at 75% so the media stays visible underneath.
watch(backgroundType, (type) => {
  if (type !== BackgroundType.IMAGE) return
  if (!backgroundColorOverlay.value) {
    backgroundColorOverlay.value = true
  }
  // When the user first switches to an image background and nothing has been
  // set before, default to the current OS desktop wallpaper.
  if (type === BackgroundType.IMAGE && !backgroundImage.value) {
    applyDesktopBackground()
  }
})

// ── Custom CSS ─────────────────────────────────────────────────
// Scoped to the instance when `instancePath` is set, otherwise the global theme.
const globalCustomCss = injection(kCustomCss)
const instanceThemeCtx = injection(kInstanceTheme)
const { state: settingsState } = injection(kSettingsState)

const isInstance = computed(() => !!props.instancePath)
const cssEnabled = computed(() => props.theme.customCssEnabled ?? false)
const cssContent = computed(() => (isInstance.value ? instanceThemeCtx.customCss.value : globalCustomCss.css.value))
function saveCss(value: string) {
  if (isInstance.value) {
    instanceThemeCtx.setCustomCss(value)
  } else {
    globalCustomCss.save(value)
  }
}
function onToggleCss(value: boolean | null) {
  props.theme.customCssEnabled = value ?? false
  emit('save')
}

// URL input refs
const imageUrlInput = ref('')
const fontUrlInput = ref('')

// Dialog show states
const showImageUrlDialog = ref(false)
const showFontUrlDialog = ref(false)

// URL apply functions
function isValidHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

async function applyImageUrl() {
  if (imageUrlInput.value && isValidHttpUrl(imageUrlInput.value)) {
    await setBackgroundImageUrl(imageUrlInput.value, 'image')
    imageUrlInput.value = ''
    showImageUrlDialog.value = false
  }
}

async function applyFontUrl() {
  if (fontUrlInput.value && isValidHttpUrl(fontUrlInput.value)) {
    await setFontUrl(fontUrlInput.value)
    fontUrlInput.value = ''
    showFontUrlDialog.value = false
  }
}

const darkModel = computed({
  get: () => (dark.value === 'system' ? 'system' : dark.value ? 'dark' : 'light'),
  set: (v) => {
    if (v === 'dark') {
      dark.value = true
    } else if (v === 'light') {
      dark.value = false
    } else {
      dark.value = 'system'
    }
  },
})

const themes = computed(() => [
  {
    text: t('setting.theme.dark'),
    value: 'dark',
  },
  {
    text: t('setting.theme.light'),
    value: 'light',
  },
  {
    text: t('setting.theme.system'),
    value: 'system',
  },
])

const backgroundImageFits = computed(() => [
  { value: 'cover', text: t('setting.backgroundImageFit.cover') },
  { value: 'contain', text: t('setting.backgroundImageFit.contain') },
])
const backgroundTypes = computed(() => [
  { value: BackgroundType.NONE, text: t('setting.backgroundTypes.none') },
  { value: BackgroundType.IMAGE, text: t('setting.backgroundTypes.image') },
])
function selectImage() {
  showOpenDialog({
    title: t('theme.selectImage'),
    properties: ['openFile'],
    filters: [
      {
        name: 'image',
        extensions: ['png', 'jpg', 'gif', 'webp'],
      },
    ],
  }).then((v) => {
    const imagePath = v.filePaths[0]
    if (imagePath) {
      setBackgroundImage(imagePath)
    }
  })
}
const settingDesktopBackground = ref(false)
async function applyDesktopBackground() {
  if (settingDesktopBackground.value) return
  settingDesktopBackground.value = true
  try {
    await setBackgroundToDesktop()
  } finally {
    settingDesktopBackground.value = false
  }
}
function clearImage() {
  clearBackgroundImage()
}

function onExportTheme() {
  showSaveDialog({
    title: t('setting.themeExport'),
    filters: [
      {
        name: 'xtheme',
        extensions: ['xtheme'],
      },
    ],
  }).then((v) => {
    if (v.filePath) {
      exportTheme(v.filePath)
    }
  })
}

function onImportTheme() {
  showOpenDialog({
    title: t('setting.themeImport'),
    properties: ['openFile'],
    filters: [
      {
        name: 'xtheme',
        extensions: ['xtheme'],
      },
    ],
  }).then((v) => {
    if (v.filePaths[0]) {
      importTheme(v.filePaths[0])
    }
  })
}

function onSelectFont() {
  showOpenDialog({
    title: t('setting.themeSelectFont'),
    defaultPath: defaultFontFolder.value,
    properties: ['openFile'],
    filters: [
      {
        name: 'font',
        extensions: ['ttf', 'otf', 'woff', 'woff2'],
      },
    ],
  }).then((v) => {
    if (v.filePaths[0]) {
      setFont(v.filePaths[0])
    }
  })
}

function onRevertFont() {
  resetFont()
}
</script>

<style scoped>
.color-theme-row {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  min-height: 56px;
}

.color-theme-row__reset {
  display: flex;
  align-items: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.color-theme-row__text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.color-theme-row__title {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
}

.color-theme-row__subtitle {
  font-size: 0.875rem;
  opacity: 0.7;
  line-height: 1.4;
}

.color-theme-row__colors {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-left: 16px;
}
</style>
