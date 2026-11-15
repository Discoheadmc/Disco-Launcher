<template>
  <v-app v-if="!showSetup" class="h-full max-h-screen overflow-hidden select-none" :class="{ 'dark': isDark }">
    <AppBackground />
    <div
      v-if="!inventoryTheme"
      class="w-full h-full absolute left-0 header-overlay"
      :style="{
        height: headerHeight + 70 + 'px',
        'background-image': `linear-gradient(${appBarColor} 0%, color-mix(in srgb, ${appBarColor}, transparent) 65%, transparent 100%)`
      }"
    >
    </div>
    <!-- Disco: the shell is chosen by the "Envanter Temasi" setting.
         The classic branch is the original layout. The inventory branch
         renders no top bar, no menu bar and no left icon bar; the
         functions those carried are reached through the hotbar menu slot
         and the Esc pause menu. Everything below the shell - dialogs,
         notifier, context menu, task dialog - is shared, so both layouts
         keep every feature. -->
    <template v-if="!inventoryTheme">
    <AppSystemBar :back="false" />
    <AppMenuBar />
    <div
      class="app-layout flex-grow relative flex overflow-auto"
      :class="[layoutClasses, { 'workspace-side-panel-attached': hasAttachedWorkspacePanel }]"
    >
      <!-- Disco (task 4): the sidebar renders in the Classic style only.
           The conditional Notch render was removed with the "Sidebar Style"
           setting. The Notch implementation itself is kept untouched:
           <AppSideBarClassic v-if="sidebarStyle === 'classic'" />
           <AppSideBarNotch v-else />
      -->
      <AppSideBarClassic />
      <main class="relative flex max-h-full flex-1 flex-col overflow-auto" :class="mainClasses">
        <router-view v-slot="{ Component }">
          <transition name="fade-transition" mode="out-in">
            <component :is="Component" class="z-2" />
          </transition>
        </router-view>
      </main>
    </div>
    </template>
    <template v-else>
      <div class="inventory-shell">
        <!-- The window strip replaces the drag area and window buttons that
             AppSystemBar carries in the classic layout. -->
        <AppInventoryTitleBar />
        <main class="inventory-shell__main">
          <router-view v-slot="{ Component }">
            <transition name="fade-transition" mode="out-in">
              <component :is="Component" class="z-2" />
            </transition>
          </router-view>
        </main>
        <AppHotbar />
        <!-- Order matters: AppMinecraftKeys is mounted first so its capture
             phase window listener is registered before the pause menu's. While
             the Minecraft-keys mode is on, Esc closes that mode and the event
             is consumed there; the pause menu then never sees it. -->
        <AppMinecraftKeys />
        <AppPauseMenu />
      </div>
    </template>
    <AppContextMenu />
    <AppNotifier />
    <AppOmniDialog />
    <AppAddInstanceDialog />
    <AppGameExitDialog />
    <AppUnauthenticatedWarningDialog />
    <AppImageDialog />
    <AppSharedTooltip />
    <UserProfileDialog :value="userProfileDialogShown" @input="userProfileDialogShown = $event" />
    <component :is="lazyDialogComponent" v-if="lazyDialogComponent" />
    <AppSideBarGroupSettingDialog :default-color="defaultColor" />
    <AppGamepadPrompt />
  </v-app>
  <v-app v-else class="h-full max-h-screen overflow-hidden" :class="{ 'dark': isDark }">
    <AppSystemBar no-user no-task />
    <div class="app-layout relative flex min-h-0 flex-1 overflow-hidden">
      <Setup @ready="onReady" />
    </div>
    <UserProfileDialog :value="userProfileDialogShown" @input="userProfileDialogShown = $event" />
    <component :is="lazyDialogComponent" v-if="lazyDialogComponent" />
    <AppGamepadPrompt />
  </v-app>
</template>

<script lang=ts setup>
import '@/assets/common.css'
import AppImageDialog from '@/components/AppImageDialog.vue'
import AppSharedTooltip from '@/components/AppSharedTooltip.vue'
import AppHotbar from '@/components/AppHotbar.vue'
import AppPauseMenu from '@/components/AppPauseMenu.vue'
import AppMinecraftKeys from '@/components/AppMinecraftKeys.vue'
import AppInventoryTitleBar from '@/components/AppInventoryTitleBar.vue'
import { useAuthProfileImportNotification } from '@/composables/authProfileImport'
import { useCommandPaletteHotkey } from '@/composables/commandPalette'
import { kDialogModel } from '@/composables/dialog'
import { useDefaultErrorHandler } from '@/composables/errorHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunchCoordinator, useInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kLaunchButton, useLaunchButton } from '@/composables/launchButton'
import { kLocalizedContent, useLocalizedContentControl } from '@/composables/localizedContent'
import { useNotifier } from '@/composables/notifier'
import { kCompact } from '@/composables/scrollTop'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kTutorial } from '@/composables/tutorial'
import { kInFocusMode } from '@/composables/uiLayout'
import { kSidebarSettings, useInjectSidebarSettings, useSidebarSettings } from '@/composables/sidebarSettings'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import AppAddInstanceDialog from '@/views/AppAddInstanceDialog.vue'
import AppBackground from '@/views/AppBackground.vue'
import AppOmniDialog from '@/views/AppOmniDialog.vue'
import AppContextMenu from '@/views/AppContextMenu.vue'
import AppGameExitDialog from '@/views/AppGameExitDialog.vue'
import AppUnauthenticatedWarningDialog from '@/views/AppUnauthenticatedWarningDialog.vue'
import UserProfileDialog from '@/components/UserProfileDialog.vue'
import AppNotifier from '@/views/AppNotifier.vue'
import AppSideBarClassic from '@/views/AppSideBarClassic.vue'
import AppSystemBar from '@/views/AppSystemBar.vue'
import AppMenuBar from '@/views/AppMenuBar.vue'
import Setup from '@/views/Setup.vue'
import { useLocalStorage, useMediaQuery, usePreferredColorScheme, usePreferredDark } from '@vueuse/core'
import { kInstanceLauncher, useInstanceLauncher } from '@/composables/instanceLauncher'
import { useUserMenuControl } from '@/composables/userMenu'
import { UserSkinRenderPaused } from '@/composables/userSkin'
import AppSideBarGroupSettingDialog from '@/views/AppSideBarGroupSettingDialog.vue'
import AppGamepadPrompt from '@/views/AppGamepadPrompt.vue'
import { useInstanceGroupDefaultColor } from '@/composables/instanceGroup'
import { kUpdateSettings, useUpdateSettings } from '@/composables/setting'

const lazyDialogComponents = {
  'task': defineAsyncComponent(() => import('@/views/AppTaskDialog.vue')),
  'feedback': defineAsyncComponent(() => import('@/views/AppFeedbackDialog.vue')),
  'delete-instance': defineAsyncComponent(() => import('@/views/AppInstanceDeleteDialog.vue')),
  'launch-blocked': defineAsyncComponent(() => import('@/views/AppLaunchBlockedDialog.vue')),
  'InstanceInstallSkipDialog': defineAsyncComponent(() => import('@/views/AppInstallSkipDialog.vue')),
  'modpack-update-or-create': defineAsyncComponent(() => import('@/views/AppModpackUpdateDialog.vue')),
  'instance-server-edit': defineAsyncComponent(() => import('@/views/AppJoinServerDialog.vue')),
  'migrate-wizard': defineAsyncComponent(() => import('@/views/AppMigrateWizardDialog.vue')),
  'mod-group-select': defineAsyncComponent(() => import('@/views/ModGroupSelectDialog.vue')),
  'modrinth-login': defineAsyncComponent(() => import('@/views/AppModrinthLoginDialog.vue')),
  'modrinth-project-create': defineAsyncComponent(() => import('@/views/AppModrinthProjectCreateDialog.vue')),
  'modrinth-project-bind': defineAsyncComponent(() => import('@/views/AppModrinthProjectBindDialog.vue')),
  'modrinth-version-publish': defineAsyncComponent(() => import('@/views/AppModrinthVersionPublishDialog.vue')),
  'mc-settings': defineAsyncComponent(() => import('@/views/AppMcSettingsDialog.vue')),
  'store-install-targets': defineAsyncComponent(() => import('@/views/StoreInstallTargetsDialog.vue')),
}

const showSetup = ref(location.search.indexOf('bootstrap') !== -1)
const { state } = injection(kSettingsState)
const dialogModel = injection(kDialogModel)
// Disco: "Envanter Temasi" - the inventory layout replaces the classic shell.
const inventoryTheme = computed(() => state.value?.inventoryTheme ?? true)
const lazyDialogComponent = computed(() => lazyDialogComponents[dialogModel.current.value.dialog as keyof typeof lazyDialogComponents])
const developerMode = computed(() => state.value?.developerMode ?? false)


provide('streamerMode', useLocalStorage('streamerMode', false, { writeDefaults: false }))
provide(kLocalizedContent, useLocalizedContentControl())
provide(kInstanceLauncher, useInstanceLauncher())
// Disco (fix): the backup-cleanup commit removed the kUpdateSettings provide
// from Setting.vue but AppMenuBar (added in the same commit) still injects it,
// so the menu bar crashed on every app start. Provide it app-wide here so
// AppMenuBar and the update settings UI share one instance.
provide(kUpdateSettings, useUpdateSettings())

// User profile dialog — moved from AppSystemBarUserMenu to App root
const userMenu = useUserMenuControl()
const userProfileDialogShown = userMenu.shown
const route = useRoute()
const hasAttachedWorkspacePanel = computed(
  () => route.meta.workspaceSidePanel === true && sidebarPosition.value === 'left',
)
provide(UserSkinRenderPaused, computed(() => !userProfileDialogShown.value && route.path !== '/me'))

// Bind Ctrl/Cmd+Shift+C to open the command palette.
useCommandPaletteHotkey()

const defaultColor = useInstanceGroupDefaultColor()

const modes = useLocalStorage('instanceEnabledDashboard', {} as Record<string, boolean>)
const { path } = injection(kInstance)
const isLessThan490px = useMediaQuery('(max-height: 570px)')
provide(kInFocusMode, computed({
  get() {
    const less = isLessThan490px.value
    const isDashboard = modes.value[basename(path.value)]
    if (isDashboard === undefined) {
      // Disco: default to the dashboard (Prism-style grid) instead of focus.
      return false
    }
    if (less) {
      return false
    }
    return !isDashboard
  },
  set(inFocus) {
    const isDashboard = !inFocus
    modes.value = { ...modes.value, [basename(path.value)]: isDashboard }
  },
}))

provide(kLaunchButton, useLaunchButton())
provide(kInstanceLaunchCoordinator, useInstanceLaunchCoordinator())

const sidebarSettings = useSidebarSettings()
provide(kSidebarSettings, sidebarSettings)
const sidebarPosition = computed(() => sidebarSettings.position.value)

const layoutClasses = computed(() => ({
  'flex-row': sidebarPosition.value === 'left' || sidebarPosition.value === 'right',
  'flex-col': sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom',
  'flex-row-reverse': sidebarPosition.value === 'right',
  'flex-col-reverse': sidebarPosition.value === 'bottom',
}))

const mainClasses = computed(() => ({
  'inset-y-0': sidebarPosition.value === 'left' || sidebarPosition.value === 'right',
  'inset-x-0': sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom',
}))

const compact = ref(false)
provide(kCompact, compact)

const headerHeight = ref(0)
provide('headerHeight', headerHeight)

const { appBarColor, dark } = injection(kTheme)

watch(dark, (newVal) => {
  state.value?.themeSet(newVal === 'system' ? newVal : newVal ? 'dark' : 'light')
}, { immediate: true })

const tutor = injection(kTutorial)
// Set theme and start tutorial
const onReady = async (data: any) => {
  await nextTick()
  showSetup.value = false
  await nextTick()
  if (state.value) {
    state.value.themeSet(data.theme)
  } else {
    const unwatch = watch(state, (state) => {
      if (state) {
        state.themeSet(data.theme)
      }
      unwatch()
    })
  }
  tutor.start()
}

// color theme sync
const { isDark } = injection(kTheme)

// Notifier
const { notify } = useNotifier()
useDefaultErrorHandler(notify)
useAuthProfileImportNotification(notify)
</script>

<style scoped>

.clip-head {
  clip-path: inset(0px 30px 30px 0px) !important;
  width: 64px;
  height: auto;
  /*to preserve the aspect ratio of the image*/
}

.v-input__icon--prepend {
  margin-right: 7px;
}

img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.workspace-side-panel-attached :deep(.sidebar) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.workspace-side-panel-attached :deep(.sidebar-notch--left .sidebar-notch__container) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* Disco: the inventory shell. A full-height column: the page area
   scrolls, the hotbar is a fixed-height footer below it. Without an
   explicit height/min-height here the scrolling chain breaks and long
   pages (Settings above all) cannot be reached. */
.inventory-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  /* Disco: the hotbar is a fixed overlay now, so pages must reserve room
     inside their own scroll area (last row scrolls above the bar). This is
     the single source of that height. */
  --hotbar-h: 64px;
}

.inventory-shell__main {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  /* Must be a flex column: the page views inside (Mod/Save/the lobby) rely on
     inheriting a resolved height to measure their (virtual) lists. With
     display:block the height chain collapsed and every content screen rendered
     almost empty. */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Disco: the hotbar floats over the page instead of taking layout space,
     so every scrollable area ends hotbar height + 16px above the window
     bottom and the last row can always scroll out from under it. */
.inventory-shell__main .custom-scrollbar,
.inventory-shell__main .scroll-container,
.inventory-shell__main .visible-scroll,
.inventory-shell__main .home-page,
.inventory-shell__main .dashboard,
.inventory-shell__main .my-stuff-page,
.inventory-shell__main .store-entry,
.inventory-shell__main .store-sidebar,
.inventory-shell__main .market-base,
.inventory-shell__main .base-setting-scroll,
.inventory-shell__main .save-page,
.inventory-shell__main #store-content {
  padding-bottom: calc(var(--hotbar-h) + 16px);
}

/* Every page fills the remaining height and scrolls on its own, which keeps a
   single scroll container per screen (no nested page+list scrollbars). */
.inventory-shell__main > * {
  flex: 1 1 auto;
  min-height: 0;
}

/* The lobby layout is the shell's scroll container for the lobby screen. It is
   capped to the shell height (its own `max-h-full` does not resolve against a
   flex parent), so the page inside can grow to its content and this element
   scrolls - one scrollbar per screen, no nested siblings. */
.inventory-shell__main .home-page {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  max-height: 100% !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
</style>
