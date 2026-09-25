<template>
  <div class="instance-actions-panel">
    <div class="instance-actions-panel__header">
      <img
        class="instance-actions-panel__icon"
        :src="getInstanceIcon(instance, undefined)"
        :alt="name"
        draggable="false"
      >
      <div class="instance-actions-panel__title">
        <div class="instance-actions-panel__name">{{ name }}</div>
        <div class="instance-actions-panel__meta">
          {{ instance.runtime.minecraft || '' }}
          <template v-if="instance.runtime.forge"> · Forge {{ instance.runtime.forge }}</template>
          <template v-else-if="instance.runtime.fabricLoader"> · Fabric {{ instance.runtime.fabricLoader }}</template>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="action-btn action-btn--primary"
      data-testid="panel-launch"
      :aria-label="t('launch.launch')"
      @click="onLaunch"
    >
      <v-icon size="18">play_arrow</v-icon>
      {{ t('launch.launch') }}
    </button>
    <button
      type="button"
      class="action-btn action-btn--danger"
      data-testid="panel-kill"
      :disabled="count === 0"
      :aria-label="t('launch.kill')"
      @click="kill('client')"
    >
      <v-icon size="18">cancel</v-icon>
      {{ t('launch.kill') }}
    </button>

    <div class="instance-actions-panel__divider" />

    <button
      type="button"
      class="action-btn"
      data-testid="panel-edit"
      :aria-label="t('shared.manage')"
      @click="router.push('/base-setting')"
    >
      <v-icon size="18">edit</v-icon>
      {{ t('shared.manage') }}
    </button>
    <button
      type="button"
      class="action-btn"
      data-testid="panel-folder"
      :aria-label="t('instance.showInstance')"
      @click="openFolder"
    >
      <v-icon size="18">folder</v-icon>
      {{ t('instance.showInstance') }}
    </button>
    <button
      type="button"
      class="action-btn"
      data-testid="panel-export"
      :aria-label="t('modpack.export')"
      @click="router.push('/base-setting?target=modpack')"
    >
      <v-icon size="18">ios_share</v-icon>
      {{ t('modpack.export') }}
    </button>
    <button
      type="button"
      class="action-btn"
      data-testid="panel-duplicate"
      :aria-label="t('instance.duplicate')"
      @click="onDuplicate"
    >
      <v-icon size="18">file_copy</v-icon>
      {{ t('instance.duplicate') }}
    </button>

    <div class="instance-actions-panel__divider" />

    <button
      type="button"
      class="action-btn action-btn--danger"
      data-testid="panel-delete"
      :aria-label="t('instance.delete')"
      @click="showDeleteDialog({ name, path })"
    >
      <v-icon size="18">delete</v-icon>
      {{ t('instance.delete') }}
    </button>
    <button
      type="button"
      class="action-btn"
      data-testid="panel-shortcut"
      :aria-label="t('launch.createShortcut')"
      @click="onCreateShortcut"
    >
      <v-icon size="18">rocket_launch</v-icon>
      {{ t('launch.createShortcut') }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kUserContext } from '@/composables/user'
import { useLaunchButton } from '@/composables/launchButton'
import { join } from '@/util/basename'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()
const router = useRouter()

const { instance, path, name } = injection(kInstance)
const { kill, count } = injection(kInstanceLaunch)
const { onClick: onLaunch } = useLaunchButton()
const { duplicateInstance } = useService(InstanceServiceKey)
const { openDirectory, getDesktopDirectory } = useService(BaseServiceKey)
const { createLaunchShortcut } = useService(LaunchServiceKey)
const { userProfile } = injection(kUserContext)
const env = injection(kEnvironment)
const { show: showDeleteDialog } = useDialog('delete-instance')

function openFolder() {
  openDirectory(path.value)
}

async function onDuplicate() {
  await duplicateInstance(path.value)
}

const onCreateShortcut = async () => {
  const dir = await getDesktopDirectory()
  const { filePath } = await windowController.showSaveDialog({
    defaultPath: join(dir, name.value),
    filters: env.value?.os === 'windows'
      ? [{ name: 'Shortcut', extensions: ['lnk'] }]
      : [{ name: 'Shortcut', extensions: ['desktop'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  })
  if (!filePath) return
  await createLaunchShortcut({
    instancePath: path.value,
    destination: filePath,
    userId: userProfile.value.id,
    icon: getInstanceIcon(instance.value, undefined),
  })
}
</script>

<style scoped>
.instance-actions-panel {
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  gap: 2px;
  overflow-y: auto;
}

.instance-actions-panel__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  text-align: center;
}

.instance-actions-panel__icon {
  width: 96px;
  height: 96px;
  border-radius: 6px;
  image-rendering: pixelated;
  object-fit: cover;
}

.instance-actions-panel__name {
  font-size: 1rem;
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.instance-actions-panel__meta {
  font-size: 0.75rem;
  opacity: 0.65;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.action-btn--primary {
  background: rgba(150, 219, 89, 0.15);
}

.action-btn--primary:hover {
  background: rgba(150, 219, 89, 0.25) !important;
}

.action-btn--danger:hover:not(:disabled) {
  background: rgba(255, 82, 82, 0.15);
}

.instance-actions-panel__divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 6px 4px;
}
</style>
