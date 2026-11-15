<template>
  <SettingCard>
    <!-- Group: Download Source & Connection -->
    <div class="setting-group" data-testid="setting-group-connection">
      <div class="setting-group__header">
        <v-icon size="16">public</v-icon>
        <span>{{ t('setting.groupConnection') }}</span>
      </div>
      <div class="setting-group__body">
        <!-- Download Source -->
        <SettingItemSelect
          v-model="apiSetsPreference"
          :title="''"
          :description="t('setting.useBmclAPIDescription')"
          :items="apiSetItems"
        >
          <template #title>
            {{ t('setting.useBmclAPI') }}
            <a
              class="primary ml-1 underline"
              target="browser"
              href="https://bmclapidoc.bangbang93.com/"
            >
              <v-icon size="small">
                question_mark
              </v-icon>
            </a>
          </template>
        </SettingItemSelect>

        <!-- Proxy Settings -->
        <SettingItemCheckbox
          :title="t('setting.useProxy')"
          :description="t('setting.useProxyDescription')"
          v-model="httpProxyEnabled"
        />
        <v-expand-transition>
          <div v-if="httpProxyEnabled" class="px-4 py-2">
            <div class="d-flex gap-4">
              <v-text-field
                v-model="proxy.host"
                data-testid="settings-proxy-host"
                variant="filled"
                density="compact"
                hide-details
                :label="t('proxy.host')"
                prepend-inner-icon="dns"
                class="flex-grow-1"
              />
              <v-text-field
                v-model="proxy.port"
                class="w-24 flex-grow-0"
                variant="filled"
                density="compact"
                hide-details
                type="number"
                :label="t('proxy.port')"
                prepend-inner-icon="numbers"
              />
            </div>
          </div>
        </v-expand-transition>        <SettingItem :title="t('setting.maxSocketsTitle')" :description="t('setting.maxSocketsDescription')">
          <template #action>
            <v-text-field
              v-model="maxSockets"
              class="w-32"
              variant="filled"
              density="compact"
              hide-details
              type="number"
              :label="t('setting.maxSockets')"
              prepend-inner-icon="speed"
            />

          </template>
        </SettingItem>
      </div>
    </div>

    <!-- Group: API Keys -->
    <div class="setting-group" data-testid="setting-group-api-keys">
      <div class="setting-group__header">
        <v-icon size="16">vpn_key</v-icon>
        <span>{{ t('setting.apiKeys.name') }}</span>
      </div>
      <div class="setting-group__body">
        <SettingItem
          :title="t('setting.apiKeys.curseforge')"
          :description="t('setting.apiKeys.curseforgeDescription')"
          long-action
        >
          <template #action>
            <div class="flex items-center gap-2 w-full max-w-[420px]">
              <v-text-field
                :model-value="curseforgeApiKey"
                data-testid="settings-curseforge-api-key"
                variant="filled"
                density="compact"
                hide-details
                :type="showCurseforgeKey ? 'text' : 'password'"
                :label="t('setting.apiKeys.curseforgeLabel')"
                prepend-inner-icon="key"
                :append-inner-icon="showCurseforgeKey ? 'visibility_off' : 'visibility'"
                @click:append-inner="showCurseforgeKey = !showCurseforgeKey"
                @update:model-value="onCurseforgeKeyInput"
              />
              <v-btn
                variant="outlined"
                size="small"
                :disabled="!curseforgeKeyDirty"
                @click="saveCurseforgeKey"
              >
                {{ t('setting.apiKeys.save') }}
              </v-btn>
            </div>
          </template>
        </SettingItem>
        <div class="px-4 pb-3 text-caption" style="color: rgba(var(--v-theme-on-surface), 0.55);">
          {{ t('setting.apiKeys.curseforgeHint') }}
          <a class="primary underline" target="browser" href="https://console.curseforge.com/">
            {{ t('setting.apiKeys.curseforgeConsole') }}
          </a>
        </div>
      </div>
    </div>
  </SettingCard>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useDialog } from '../composables/dialog'
import { useSettings, kSettingsState } from '../composables/setting'
import { injection } from '@/util/inject'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'

const {
  proxy, httpProxyEnabled, apiSets,
  apiSetsPreference,
  maxSockets,
} = useSettings()
const { t } = useI18n()

// Disco: user-provided CurseForge API key (Settings > Network > API Keys).
// Edited locally and committed with an explicit Save so accidental typing
// does not spam the settings file; applied live through the settings state.
const { state: settingsState } = injection(kSettingsState)
const showCurseforgeKey = ref(false)
const curseforgeKeyDraft = ref(settingsState.value?.curseforgeApiKey ?? '')
const curseforgeApiKey = computed(() => settingsState.value?.curseforgeApiKey ?? '')
const curseforgeKeyDirty = computed(() => curseforgeKeyDraft.value.trim() !== curseforgeApiKey.value)
function onCurseforgeKeyInput(v: string) {
  curseforgeKeyDraft.value = v
}
function saveCurseforgeKey() {
  settingsState.value?.curseforgeApiKeySet(curseforgeKeyDraft.value.trim())
}
const apiSetItems = computed(() =>
  [
    {
      text: t('setting.apiSets.auto'),
      value: '',
    },
    {
      text: t('setting.apiSets.official'),
      value: 'mojang',
    },
  ].concat(
    apiSets.value.map((v) => {
      return {
        text: v.name.toString().toUpperCase(),
        value: v.name,
      }
    })))
const { show } = useDialog('migration')
</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-card {
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.gap-4 {
  gap: 16px;
}

/* Grouped sections: subtle tinted blocks with icon subtitles.
   Uses only existing theme tokens (on-surface alphas). */
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
