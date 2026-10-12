<template>
  <SettingCard id="version-card" :title="t('version.name', 2)" icon="layers">
    <template #header-action>
      <v-btn
        :disabled="!versionHeader || isModified"
        size="small"
        variant="text"
        @click="onFix"
      >
        <v-icon start>build</v-icon>
        {{ t('version.checkIntegrity') }}
      </v-btn>
    </template>

    <div
      v-if="hasUpdate"
      class="mc-update-row"
      data-testid="minecraft-update-row"
    >
      <v-icon size="18">system_update_alt</v-icon>
      <div class="mc-update-row__text">
        <div class="mc-update-row__title">
          {{ t('minecraftUpdate.available', { version: latest }) }}
        </div>
        <div class="mc-update-row__hint">
          {{ isModded ? t('minecraftUpdate.modHint') : t('minecraftUpdate.hint') }}
        </div>
      </div>
      <v-btn
        size="small"
        color="primary"
        variant="flat"
        :loading="applying"
        data-testid="minecraft-update-apply"
        @click="onApplyUpdate"
      >
        {{ t('minecraftUpdate.apply') }}
      </v-btn>
    </div>

    <ModloaderSelector
      :data="data"
      :versions="versions"
      :local-placeholder="versionHeader ? versionHeader.id : undefined"
    />

    <SimpleDialog
      v-model="modWarningDialogModel"
      :width="420"
      :title="t('minecraftUpdate.modWarningTitle')"
      confirm-icon="update"
      color="orange en-1"
      :confirm="t('minecraftUpdate.apply')"
      @cancel="modWarningDialog.cancel"
      @confirm="modWarningDialog.confirm"
    >
      {{ t('minecraftUpdate.modWarningDescription', { version: latest }) }}
    </SimpleDialog>

    <SimpleDialog
      v-model="reinstallDialogModel"
      :width="390"
      :title="t('localVersion.reinstallTitle', { version: reinstallDialog.target.value })"
      :confirm-icon="'build'"
      :color="'orange en-1'"
      :confirm="t('shared.yes')"
      @cancel="reinstallDialog.cancel"
      @confirm="reinstallDialog.confirm"
    >
      {{ t('localVersion.reinstallDescription') }}
    </SimpleDialog>
  </SettingCard>
</template>

<script lang="ts" setup>
import ModloaderSelector from '@/components/ModloaderSelector.vue'
import SettingCard from '@/components/SettingCard.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { VersionInstallServiceKey } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import { kInstance } from '@/composables/instance'
import { useInstanceMinecraftUpdate } from '@/composables/minecraftUpdate'

const { data, isModified } = injection(InstanceEditInjectionKey)
const { versions } = injection(kLocalVersions)
const { instance } = injection(kInstance)
const { latest, hasUpdate, isModded, applyUpdate } = useInstanceMinecraftUpdate(() => instance.value)

const { versionHeader } = injection(kInstanceVersion)
function onFix() {
  if (versionHeader.value) {
    reinstallDialog.show(versionHeader.value.id)
  }
}

const { install } = useService(VersionInstallServiceKey)
const reinstallDialog = useSimpleDialog<string>((v) => {
  if (!v) return
  install({
    type: 'reinstall',
    version: v,
    side: 'client',
  })
})
const reinstallDialogModel = reinstallDialog.model

// Disco: applying a newer Minecraft release. A modded instance can break on a
// version bump, so confirm before touching it — vanilla applies straight away.
const modWarningDialog = useSimpleDialog<boolean>((v) => {
  if (v) onApplyUpdate()
})
const modWarningDialogModel = modWarningDialog.model
const applying = ref(false)

async function onApplyUpdate() {
  if (!hasUpdate.value || applying.value) return
  if (isModded.value) {
    modWarningDialog.show(true)
    return
  }
  applying.value = true
  try {
    await applyUpdate()
  } finally {
    applying.value = false
  }
}

const { t } = useI18n()
</script>

<style scoped>
.mc-update-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--card-item-radius, 3px);
  background: rgba(33, 150, 243, 0.1);
}
.mc-update-row__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mc-update-row__title {
  font-size: 0.875rem;
  font-weight: 500;
}
.mc-update-row__hint {
  color: rgba(var(--v-theme-on-surface), 0.65);
  font-size: 0.75rem;
}
</style>
