<template>
  <div
    class="app-menu-bar moveable flex items-center gap-1 px-2 select-none"
    :style="{ backgroundColor: appBarColor }"
  >
    <!-- Add profile: straight to the account setup -->
    <v-btn
      v-shared-tooltip.bottom="() => t('userAccount.add')"
      variant="text"
      size="small"
      class="menu-btn non-moveable"
      data-testid="menu-add-profile"
      :aria-label="t('userAccount.add')"
      @click="goMe"
    >
      <v-icon size="18" class="mr-1">person_add</v-icon>
      {{ t('userAccount.add') }}
    </v-btn>

    <!-- Files dropdown -->
    <v-menu>
      <template #activator="{ props: activatorProps }">
        <v-btn
          v-bind="activatorProps"
          variant="text"
          size="small"
          class="menu-btn non-moveable"
          data-testid="menu-files"
          :aria-label="t('menuBar.files')"
        >
          <v-icon size="18" class="mr-1">folder</v-icon>
          {{ t('menuBar.files') }}
          <v-icon size="16" class="ml-1">arrow_drop_down</v-icon>
        </v-btn>
      </template>
      <v-list density="compact" role="menu">
        <v-list-item
          role="menuitem"
          :title="t('instance.showInstance')"
          prepend-icon="folder_open"
          @click="openInstanceFolder"
        />
        <v-list-item
          role="menuitem"
          :title="t('menuBar.gameDataFolder')"
          prepend-icon="storage"
          data-testid="menu-game-data-folder"
          @click="openGameDataFolder"
        />
        <v-list-item
          v-if="env && env.os !== 'osx'"
          role="menuitem"
          :title="t('launch.createShortcut')"
          prepend-icon="rocket_launch"
          @click="onCreateShortcut"
        />
      </v-list>
    </v-menu>

    <!-- Settings -->
    <v-btn
      variant="text"
      size="small"
      class="menu-btn non-moveable"
      data-testid="menu-settings"
      to="/setting"
      :aria-label="t('setting.name', 2)"
    >
      <v-icon size="18" class="mr-1">settings</v-icon>
      {{ t('setting.name', 1) }}
    </v-btn>

    <!-- Help dropdown -->
    <v-menu>
      <template #activator="{ props: activatorProps }">
        <v-btn
          v-bind="activatorProps"
          variant="text"
          size="small"
          class="menu-btn non-moveable"
          data-testid="menu-help"
          :aria-label="t('help')"
        >
          <v-icon size="18" class="mr-1">help</v-icon>
          {{ t('help') }}
          <v-icon size="16" class="ml-1">arrow_drop_down</v-icon>
        </v-btn>
      </template>
      <v-list density="compact" role="menu">
        <v-list-item
          role="menuitem"
          :title="t('feedback.name')"
          prepend-icon="bug_report"
          @click="showFeedbackDialog()"
        />
        <v-list-item
          role="menuitem"
          :title="t('menuBar.about')"
          prepend-icon="info"
          to="/setting?target=about"
          data-testid="menu-about"
        />
      </v-list>
    </v-menu>

    <div class="flex-grow" />

    <!-- Update -->
    <v-btn
      variant="text"
      size="small"
      class="menu-btn non-moveable"
      data-testid="menu-update"
      :loading="checkingUpdate"
      :aria-label="t('setting.checkUpdate')"
      @click="checkUpdate"
    >
      <v-icon size="18" class="mr-1">autorenew</v-icon>
      {{ t('setting.checkUpdate') }}
    </v-btn>

    <div class="flex-grow-0 flex items-center pl-2">
      <AppMenuBarUserButton />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kUpdateSettings } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kUserContext } from '@/composables/user'
import { join } from '@/util/basename'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { BaseServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import AppMenuBarUserButton from './AppMenuBarUserButton.vue'

const { appBarColor } = injection(kTheme)
const { gameProfile, userProfile } = injection(kUserContext)
const { path, name, instance } = injection(kInstance)
const env = injection(kEnvironment)

const { t } = useI18n()
const router = useRouter()

const { openDirectory, getDesktopDirectory, getGameDataDirectory } = useService(BaseServiceKey)
const { createLaunchShortcut } = useService(LaunchServiceKey)
const { show: showFeedbackDialog } = useDialog('feedback')
const { checkUpdate, checkingUpdate } = injection(kUpdateSettings)

function goMe() {
  router.push('/me')
}

function openInstanceFolder() {
  openDirectory(path.value)
}

async function openGameDataFolder() {
  const dir = await getGameDataDirectory()
  openDirectory(dir)
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
  let icon = getInstanceIcon(instance.value, undefined)
  if (icon.endsWith('.webp')) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.src = icon
    await new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)
        resolve(true)
      }
    })
    icon = canvas.toDataURL('image/png')
  }
  await createLaunchShortcut({
    instancePath: path.value,
    destination: filePath,
    userId: userProfile.value.id,
    icon,
  })
}
</script>

<style scoped>
.app-menu-bar {
  min-height: 36px;
  z-index: 20;
}

.menu-btn {
  text-transform: none;
  font-size: 0.875rem;
  letter-spacing: normal;
}
</style>
