import { useService } from '@/composables/service'
import { useDialog } from '@/composables/dialog'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useMcSettingsFavorite } from '@/composables/mcSettingsFavorite'
import { useInstanceLaunchMenuItems } from '@/composables/instanceLaunchMenuItems'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kUserContext } from '@/composables/user'
import { kLaunchButton } from '@/composables/launchButton'
import { join } from '@/util/basename'
import { getInstanceIcon, toPngIconUrl } from '@/util/favicon'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

/**
 * Disco: the instance's content screens, as navigation entries.
 *
 * Only screens that really exist are listed - the routes already exist in the
 * router and are what the command palette uses. "Kayıtlar" and "Dünyalar" are
 * the same screen in Minecraft terms (world saves), so both point at /save.
 * There is no /servers route; the server screen lives in the base-setting tab.
 */
export interface InstanceContentLink {
  id: 'mods' | 'saves' | 'worlds' | 'servers'
  label: string
  icon: string
  to: string
}

export function useInstanceContentLinks(): InstanceContentLink[] {
  const { t } = useI18n()
  return [
    { id: 'mods', label: t('instanceContent.mods'), icon: 'extension', to: '/mods' },
    { id: 'saves', label: t('instanceContent.saves'), icon: 'map', to: '/save' },
    { id: 'worlds', label: t('instanceContent.worlds'), icon: 'public', to: '/save' },
    { id: 'servers', label: t('instanceContent.servers'), icon: 'dns', to: '/base-setting?target=server' },
  ]
}

/**
 * Disco: the single source of truth for instance actions.
 *
 * Every layout that offers instance actions - the classic right panel, the
 * inventory-theme tooltip panel, and the new home card - reads from here, so
 * the list, the order, the disabled/enabled rules and the handlers are defined
 * exactly once. Adding an action or fixing a state rule updates all layouts at
 * the same time, and no layout can drift out of sync (a missing "MC Ayarları"
 * in one of them was the reason this was extracted).
 *
 * The returned actions keep the same `data-testid` values the classic panel has
 * always used, so existing E2E anchors keep working.
 */
export interface InstanceAction {
  /** Stable id - also used to build the per-layout test id suffix. */
  id: string
  label: string
  icon: string
  /** The historical test id of this action (kept for E2E stability). */
  testid: string
  /** Shown with the danger styling (delete). */
  danger?: boolean
  /** The primary call-to-action (launch or install). */
  primary?: boolean
  /** Custom launch-button color, when the user picked one. */
  style?: Record<string, string>
  disabled?: boolean
  /** Busy state - the button shows a spinner instead of the label. */
  loading?: boolean
  /** Fired when the row is activated. */
  run: () => void
}

export function useInstanceActions() {
  const { t } = useI18n()
  const router = useRouter()

  const { instance, path, name } = injection(kInstance)
  const { kill, count } = injection(kInstanceLaunch)
  // Use the app-root launch button, not a private `useLaunchButton()` instance:
  // the root owns the preclick listeners (unauthenticated warning, debounced
  // instance-edit flush). A private instance has an empty listener set, so
  // launching from any other panel would skip those guards.
  const { onClick: onLaunch } = injection(kLaunchButton)
  const { duplicateInstance } = useService(InstanceServiceKey)
  const { openDirectory, getDesktopDirectory } = useService(BaseServiceKey)
  const { createLaunchShortcut } = useService(LaunchServiceKey)
  const { userProfile } = injection(kUserContext)
  const env = injection(kEnvironment)
  const { show: showDeleteDialog } = useDialog('delete-instance')
  const { show: showMcSettings } = useDialog('mc-settings')
  const { show: showLogDialog } = useDialog('log')
  const { isFavoriteOf } = useMcSettingsFavorite()
  const isMcFavorite = computed(() => isFavoriteOf(path.value))

  // When the selected instance is not installable as-is (missing/broken version
  // jar, missing java, missing libraries/assets, stalled downloads...), the
  // "Başlat" action becomes a fixed-blue "İndir" action that runs the same
  // repair flow the old top "Yükle" button used. The custom launch-button color
  // must NOT tint that state.
  const { issues, fixInstanceFileIssue } = useInstanceLaunchMenuItems()
  const { fix: fixVersionIssues, loading: loadingVersionIssues, isInstanceFixing } =
    injection(kInstanceVersionInstall)
  const needsInstall = computed(() => issues.value !== 0)
  const fixing = computed(() => isInstanceFixing(path.value) || loadingVersionIssues.value)

  async function onFix() {
    if (fixing.value) return
    const instancePath = path.value
    await Promise.allSettled([
      fixVersionIssues(instancePath),
      fixInstanceFileIssue(instancePath),
    ])
  }

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
      icon: await toPngIconUrl(getInstanceIcon(instance.value, undefined)),
    })
  }

  const actions = computed<InstanceAction[]>(() => {
    const list: InstanceAction[] = []

    // Primary: "İndir" when the instance is broken, otherwise "Başlat".
    if (needsInstall.value) {
      list.push({
        id: 'install',
        label: t('shared.download'),
        icon: 'get_app',
        testid: 'panel-install',
        primary: true,
        disabled: fixing.value,
        run: onFix,
      })
    } else {
      list.push({
        id: 'launch',
        label: t('launch.launch'),
        icon: 'play_arrow',
        testid: 'panel-launch',
        primary: true,
        run: () => onLaunch(),
      })
    }
    list.push({
      id: 'kill',
      label: t('launch.kill'),
      icon: 'cancel',
      testid: 'panel-kill',
      danger: true,
      disabled: count.value === 0,
      run: () => kill('client'),
    })

    list.push({
      id: 'edit',
      label: t('shared.manage'),
      icon: 'edit',
      testid: 'panel-edit',
      run: () => router.push('/base-setting'),
    })
    list.push({
      id: 'mc-settings',
      label: t('instance.mcSettings'),
      icon: 'tune',
      testid: 'panel-mc-settings',
      run: () => showMcSettings({ path: path.value, name: name.value }),
    })
    list.push({
      id: 'folder',
      label: t('instance.showInstance'),
      icon: 'folder',
      testid: 'panel-folder',
      run: openFolder,
    })
    list.push({
      id: 'logs',
      label: t('logsCrashes.title'),
      icon: 'subtitles',
      testid: 'panel-logs',
      run: () => showLogDialog(),
    })
    list.push({
      id: 'export',
      label: t('modpack.export'),
      icon: 'ios_share',
      testid: 'panel-export',
      run: () => router.push('/base-setting?target=modpack'),
    })
    list.push({
      id: 'duplicate',
      label: t('instance.duplicate'),
      icon: 'file_copy',
      testid: 'panel-duplicate',
      run: onDuplicate,
    })

    list.push({
      id: 'delete',
      label: t('instance.delete'),
      icon: 'delete',
      testid: 'panel-delete',
      danger: true,
      run: () => showDeleteDialog({ name: name.value, path: path.value }),
    })
    list.push({
      id: 'shortcut',
      label: t('launch.createShortcut'),
      icon: 'rocket_launch',
      testid: 'panel-shortcut',
      run: onCreateShortcut,
    })

    return list
  })

  /** The MC-settings row carries a favorite star in some layouts. */
  const favoriteOf = computed(() => isMcFavorite.value)

  return { actions, favoriteOf }
}
