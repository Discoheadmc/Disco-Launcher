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
          :title="t('menuBar.github')"
          prepend-icon="code"
          href="https://github.com/Discoheadmc/Disco-Launcher"
          target="browser"
          data-testid="menu-github"
        />
        <v-list-item
          role="menuitem"
          :title="t('menuBar.reportIssue')"
          prepend-icon="bug_report"
          href="https://github.com/Discoheadmc/Disco-Launcher/issues"
          target="browser"
          data-testid="menu-report-issue"
        />
        <v-list-item
          role="menuitem"
          :title="t('menuBar.releases')"
          prepend-icon="download"
          href="https://github.com/Discoheadmc/Disco-Launcher/releases"
          target="browser"
          data-testid="menu-releases"
        />
        <v-divider class="my-1" />
        <v-list-item
          role="menuitem"
          :title="t('feedback.name')"
          prepend-icon="feedback"
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
import { kTheme } from '@/composables/theme'
import { kUserContext } from '@/composables/user'
import { join } from '@/util/basename'
import { getInstanceIcon, toPngIconUrl } from '@/util/favicon'
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
  await createLaunchShortcut({
    instancePath: path.value,
    destination: filePath,
    userId: userProfile.value.id,
    icon: await toPngIconUrl(getInstanceIcon(instance.value, undefined)),
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
