<template>
  <SettingCard>
    <!-- Group: Language & Data Location -->
    <div class="setting-group" data-testid="setting-group-app">
      <div class="setting-group__header">
        <v-icon size="16">language</v-icon>
        <span>{{ t('setting.groupApp') }}</span>
      </div>
      <div class="setting-group__body">
        <SettingItemSelect
          v-model="selectedLocale"
          icon="language"
          :title="t('setting.language')"
          :description="t('setting.languageDescription')"
          :items="locales"
        />

        <SettingItem :description="errorText || root" :title-class="`${errorText ? 'error--text' : ''}`" long-action>
          <template #title>
            <v-icon start size="small" :color="errorText ? 'error' : 'primary'">folder</v-icon>
            {{ t("setting.location") }}
          </template>
          <template #action>
            <div class="flex gap-2 justify-end">
              <v-btn color="primary" @click="onMigrateFromOther">
                <v-icon start size="small">local_shipping</v-icon>
                {{ t("setting.migrateFromOther") }}
              </v-btn>
              <v-btn color="primary" @click="browseRootDir">
                <v-icon start size="small">edit</v-icon>
                {{ t("setting.browseRoot") }}
              </v-btn>
              <v-btn color="primary" @click="showGameDirectory()">
                <v-icon start size="small">folder_open</v-icon>
                {{ t("setting.showRoot") }}
              </v-btn>
            </div>
          </template>
        </SettingItem>
      </div>
    </div>

    <!-- Group: Privacy, Presence & Advanced Behavior -->
    <div class="setting-group" data-testid="setting-group-privacy">
      <div class="setting-group__header">
        <v-icon size="16">privacy_tip</v-icon>
        <span>{{ t('setting.groupPrivacy') }}</span>
      </div>
      <div class="setting-group__body">
        <SettingItemSwitcher
          v-model="disableTelemetry"
          :title="t('setting.disableTelemetry')"
          :description="t('setting.disableTelemetryDescription')"
          icon="privacy_tip"
        />

        <template v-if="env?.os === 'linux' || env?.os === 'windows'">
          <SettingItemSwitcher
            v-model="enableDedicatedGPUOptimization"
            :title="t('setting.enableDedicatedGPUOptimization')"
            :description="t('setting.enableDedicatedGPUOptimizationDescription')"
            icon="memory"
          />
        </template>

        <SettingItemSwitcher
          v-model="enableDiscord"
          :title="t('setting.enableDiscord')"
          :description="t('setting.enableDiscordDescription')"
          icon="discord"
        />

        <SettingItemSwitcher
          v-model="developerMode"
          data-testid="developer-mode"
          :title="t('setting.developerMode')"
          :description="t('setting.developerModeDescription')"
          icon="code"
        >
          <v-chip v-if="developerMode" size="x-small" color="warning" class="ml-2">{{ t('setting.devModeLabel') }}</v-chip>
        </SettingItemSwitcher>

        <SettingItemSwitcher
          v-model="streamerMode"
          :title="t('setting.streamerMode')"
          :description="t('setting.streamerModeDescription')"
          icon="videocam"
        />

        <SettingItemHotkey
          v-model="quickActionShortcut"
          :title="t('commandPalette.open')"
          :description="quickActionShortcutHint"
          icon="search"
        />

        <SettingItemSelect
          :model-value="replaceNative === false ? '' : replaceNative"
          icon="swap_horiz"
          :title="t('setting.replaceNative')"
          :description="t('setting.replaceNativeDescription')"
          :items="replaceNativeItems"
          @update:model-value="replaceNative = !$event ? false : $event"
        />
      </div>
    </div>
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'
import SettingItemHotkey from '@/components/SettingItemHotkey.vue'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import { formatShortcutDisplay } from '@/util/shortcut'
import { useDialog } from '../composables/dialog'
import { useGameDirectory, useSettings } from '../composables/setting'

const { isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus)
const getDirErroText = useGetDataDirErrorText()
const errorText = computed(() => isNoEmptySpace.value ? t('errors.DiskIsFull') : invalidGameDataPath.value ? getDirErroText(invalidGameDataPath.value) : undefined)
const env = injection(kEnvironment)
const {
  streamerMode,
  developerMode,
  selectedLocale,
  replaceNative,
  disableTelemetry,
  enableDiscord,
  quickActionShortcut,
  locales: rawLocales,
  enableDedicatedGPUOptimization,
} = useSettings()
const { t } = useI18n()
const quickActionShortcutHint = computed(() => t('commandPalette.openHint', { shortcut: formatShortcutDisplay(quickActionShortcut.value || '') }))
const locales = computed(() => rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale })))
const replaceNativeItems = computed(() => [
  {
    text: t('shared.disable'),
    value: '',
  },
  {
    text: t('setting.replaceNatives.legacy'),
    value: 'legacy-only',
  },
  {
    text: t('setting.replaceNatives.all'),
    value: 'all',
  },
])
const { show } = useDialog('migration')
const { root, showGameDirectory } = useGameDirectory()
async function browseRootDir() {
  show()
}

const { show: onMigrateFromOther } = useDialog('migrate-wizard')

</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-list-item {
  min-height: 64px;
}

.v-list-item__action {
  align-self: center;
}

.setting-item-input {
  min-width: 320px;
  max-width: 460px;
}

/* Grouped sections: subtle tinted blocks with icon subtitles.
   Uses only existing theme tokens (on-surface alphas). */
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-group + .setting-group {
  margin-top: 20px;
}

.setting-group__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 2px;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  user-select: none;
}

.setting-group__body {
  border-radius: var(--card-subsection-radius, 3px);
  background: rgba(var(--v-theme-on-surface), 0.03);
  padding: 4px 0;
}

.setting-group__body > :deep(*) + :deep(*) {
  position: relative;
}

.setting-group__body > :deep(*) + :deep(*)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: rgba(var(--v-theme-on-surface), 0.07);
  pointer-events: none;
}
</style>
