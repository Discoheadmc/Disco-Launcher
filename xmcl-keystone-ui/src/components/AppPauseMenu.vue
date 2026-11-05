<template>
  <!-- Disco: the Minecraft-style pause menu. In the inventory theme the top
       menu bar and the left icon bar are hidden, so everything they carried is
       reachable from here. Opened with Esc (and from the hotbar "menu" slot);
       closed with Esc again or the "back to game" button, exactly like
       Minecraft's pause screen. Every entry mirrors an entry of AppMenuBar, so
       no function is lost when the menu bar is hidden. -->
  <v-dialog
    v-model="open"
    max-width="420px"
    transition="fade-transition"
    content-class="pause-menu-dialog"
  >
    <div class="pause-menu" data-testid="app-pause-menu">
      <div class="pause-menu__title">
        {{ t('menuBar.files') }}
      </div>

      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-add-profile"
        @click="goMe"
      >
        <v-icon size="18" class="mr-2">person_add</v-icon>
        {{ t('userAccount.add') }}
      </button>

      <!-- Files: the exact three entries of the classic "Dosyalar" menu. -->
      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-instance-folder"
        @click="openInstanceFolder"
      >
        <v-icon size="18" class="mr-2">folder_open</v-icon>
        {{ t('instance.showInstance') }}
      </button>
      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-game-data-folder"
        @click="openGameDataFolder"
      >
        <v-icon size="18" class="mr-2">storage</v-icon>
        {{ t('menuBar.gameDataFolder') }}
      </button>
      <button
        v-if="env && env.os !== 'osx'"
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-create-shortcut"
        @click="onCreateShortcut"
      >
        <v-icon size="18" class="mr-2">rocket_launch</v-icon>
        {{ t('launch.createShortcut') }}
      </button>

      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-settings"
        @click="goSettings"
      >
        <v-icon size="18" class="mr-2">settings</v-icon>
        {{ t('setting.name', 1) }}
      </button>

      <div class="pause-menu__spacer" />

      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-github"
        @click="openLink('https://github.com/Discoheadmc/Disco-Launcher')"
      >
        <v-icon size="18" class="mr-2">code</v-icon>
        {{ t('menuBar.github') }}
      </button>
      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-report-issue"
        @click="openLink('https://github.com/Discoheadmc/Disco-Launcher/issues')"
      >
        <v-icon size="18" class="mr-2">bug_report</v-icon>
        {{ t('menuBar.reportIssue') }}
      </button>
      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-releases"
        @click="openLink('https://github.com/Discoheadmc/Disco-Launcher/releases')"
      >
        <v-icon size="18" class="mr-2">download</v-icon>
        {{ t('menuBar.releases') }}
      </button>
      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-feedback"
        @click="showFeedbackDialog"
      >
        <v-icon size="18" class="mr-2">feedback</v-icon>
        {{ t('feedback.name') }}
      </button>
      <button
        type="button"
        class="pause-menu__btn"
        data-testid="pause-menu-about"
        @click="goAbout"
      >
        <v-icon size="18" class="mr-2">info</v-icon>
        {{ t('menuBar.about') }}
      </button>

      <div class="pause-menu__spacer" />

      <button
        type="button"
        class="pause-menu__btn pause-menu__btn--primary"
        data-testid="pause-menu-close"
        @click="open = false"
      >
        <v-icon size="18" class="mr-2">arrow_back</v-icon>
        {{ t('shared.back') }}
      </button>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kUserContext } from '@/composables/user'
import { join } from '@/util/basename'
import { getInstanceIcon, toPngIconUrl } from '@/util/favicon'
import { injection } from '@/util/inject'
import { BaseServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

const open = ref(false)
const { show: showFeedbackDialog } = useDialog('feedback')

const { openDirectory, getDesktopDirectory, getGameDataDirectory } = useService(BaseServiceKey)
const { createLaunchShortcut } = useService(LaunchServiceKey)
const { path, name, instance } = injection(kInstance)
const { userProfile } = injection(kUserContext)
const env = injection(kEnvironment)

function toggle() {
  open.value = !open.value
}

/**
 * Esc anywhere opens/closes the menu, like Minecraft's pause screen. Ignored
 * while typing so the key keeps working inside text inputs.
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
  }
  e.preventDefault()
  toggle()
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))

// The hotbar "menu" slot asks for the menu through a custom event, so the two
// components stay decoupled.
function onHotbarMenu() {
  open.value = true
}
onMounted(() => window.addEventListener('hotbar-menu', onHotbarMenu))
onBeforeUnmount(() => window.removeEventListener('hotbar-menu', onHotbarMenu))

// --- Actions (mirrors of AppMenuBar) ---

function goMe() {
  open.value = false
  void router.push('/me')
}

function openInstanceFolder() {
  openDirectory(path.value)
}

async function openGameDataFolder() {
  const dir = await getGameDataDirectory()
  openDirectory(dir)
}

async function onCreateShortcut() {
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

function goSettings() {
  open.value = false
  void router.push('/setting')
}

function goAbout() {
  open.value = false
  void router.push('/setting?target=about')
}

function openLink(url: string) {
  window.open(url, 'browser')
}
</script>

<style scoped>
.pause-menu {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 2px;
}

.pause-menu__title {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  padding: 2px 4px 6px;
}

.pause-menu__spacer {
  height: 8px;
}

.pause-menu__btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
}

.pause-menu__btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(var(--v-theme-primary), 0.6);
}

.pause-menu__btn--primary {
  background: rgba(var(--v-theme-primary), 0.16);
  border-color: rgba(var(--v-theme-primary), 0.5);
  color: rgb(var(--v-theme-primary));
}
</style>
