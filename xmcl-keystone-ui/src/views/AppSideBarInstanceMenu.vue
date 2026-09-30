<template>
  <v-menu
    v-model="open"
    location="end center"
    :close-on-content-click="true"
    max-width="280"
  >
    <template #activator="{ props: activatorProps }">
      <AppSideBarItem
        :id="'sidebar-instance-menu-button'"
        data-testid="sidebar-instance-menu-button"
        v-shared-tooltip.right="buttonTooltip"
        clickable
        :active="activeInstanceActive"
        :aria-label="t('instances.title', 2)"
        :aria-expanded="open"
        v-bind="activatorProps"
      >
        <span class="sidebar-instance-menu__content">
          <v-img
            v-if="activeFaviconWithStatus || activeFavicon"
            class="sidebar-instance-menu__image"
            :width="32"
            :height="32"
            :src="activeFaviconWithStatus || activeFavicon"
            draggable="false"
          />
          <v-icon v-else class="sidebar-item__icon" :size="26">
            sports_esports
          </v-icon>
          <v-icon class="sidebar-instance-menu__chevron" :size="12">
            expand_more
          </v-icon>
        </span>
      </AppSideBarItem>
    </template>

    <v-list
      density="compact"
      class="sidebar-instance-menu__list"
      max-height="360"
      role="menu"
      :aria-label="t('instances.title', 2)"
    >
      <v-list-item
        v-for="item in flatItems"
        :key="item.path"
        role="menuitem"
        :aria-label="item.name"
        :active="item.path === selectedInstance"
        class="sidebar-instance-menu__item"
        @click="navigate(item.path)"
      >
        <template #prepend>
          <v-img
            class="sidebar-instance-menu__item-image"
            :width="28"
            :height="28"
            :src="item.favicon"
            draggable="false"
          />
        </template>
        <v-list-item-title class="text-body-2">
          {{ item.name }}
        </v-list-item-title>
        <template #append>
          <v-icon
            v-if="item.path === selectedInstance"
            size="16"
            color="primary"
          >
            check
          </v-icon>
        </template>
      </v-list-item>

      <v-divider class="my-1" />

      <v-list-item
        role="menuitem"
        :aria-label="t('instances.add')"
        class="sidebar-instance-menu__item"
        @click="showAddInstance()"
      >
        <template #prepend>
          <v-icon size="20">add</v-icon>
        </template>
        <v-list-item-title class="text-body-2">
          {{ t('instances.add') }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { useInstanceGroupOps } from '@/composables/instanceGroup'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { BuiltinImages } from '../constant'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import AppSideBarItem from './AppSideBarItem.vue'

const { t } = useI18n()
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { instances, selectedInstance } = injection(kInstances)
const { select } = injection(kInstance)
const router = useRouter()
const open = ref(false)

interface MenuItem {
  path: string
  name: string
  favicon: string
}

const menuEntries = computed(() => {
  const list: MenuItem[] = []
  for (const inst of instances.value) {
    if (!inst) continue
    let name = ''
    if (inst.name) name = inst.name
    else if (inst.runtime.minecraft) name = `Minecraft ${inst.runtime.minecraft}`
    list.push({ path: inst.path, name, favicon: getInstanceIcon(inst, undefined) })
  }
  return list
})

// Keep the pinned/group order from the existing sidebar grouping when the
// group data is available; fall back to the plain instance list.
const { groups } = useInstanceGroupOps()
const { pinnedInstances, showOnlyPinned } = useInjectSidebarSettings()

const flatItems = computed<MenuItem[]>(() => {
  const byPath = new Map(menuEntries.value.map(i => [i.path, i]))
  const ordered: MenuItem[] = []
  const pushPath = (p: string) => {
    const found = byPath.get(p)
    if (found && !ordered.some(o => o.path === p)) ordered.push(found)
  }
  let items: (string | { instances: string[] })[] = groups.value
  if (showOnlyPinned.value) {
    const pinnedSet = new Set(pinnedInstances.value)
    items = items.filter(item => typeof item === 'string' ? pinnedSet.has(item) || item === selectedInstance.value : item.instances.some(p => pinnedSet.has(p) || p === selectedInstance.value))
  }
  for (const item of items) {
    if (typeof item === 'string') pushPath(item)
    else item.instances.forEach(pushPath)
  }
  // any instance not covered by groups (e.g. fresh install before group sync)
  for (const entry of menuEntries.value) pushPath(entry.path)
  return ordered.filter(i => i.name)
})

const activeEntry = computed(() => flatItems.value.find(i => i.path === selectedInstance.value))
const activeFavicon = computed(() => activeEntry.value?.favicon || '')

const { status, refreshIfStale } = useInstanceServerStatus(computed(() => instances.value.find(i => i.path === selectedInstance.value)))
// The live server favicon is the authoritative icon once a ping succeeds;
// `activeFavicon` remains the fallback until then.
const activeFaviconWithStatus = computed(() => {
  const inst = instances.value.find(i => i.path === selectedInstance.value)
  if (!inst) return ''
  return getInstanceIcon(inst, inst.server ? status.value : undefined)
})
onMounted(() => {
  refreshIfStale()
})

const activeInstanceActive = computed(() => router.currentRoute.value.matched[0]?.path === '/')

const buttonTooltip = () => {
  const name = activeEntry.value?.name || t('instances.title', 2)
  return { text: name }
}

function navigate(path: string) {
  open.value = false
  if (router.currentRoute.value.path !== '/') {
    router.push('/').then(() => {
      select(path)
    })
  } else {
    select(path)
  }
}
</script>

<style scoped>
.sidebar-instance-menu__content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-instance-menu__image {
  border-radius: 8px;
}

.sidebar-instance-menu__chevron {
  position: absolute;
  right: -2px;
  bottom: -2px;
  background: rgba(var(--v-theme-surface), 0.9);
  border-radius: 999px;
  padding: 1px;
}

.sidebar-instance-menu__list {
  background: rgb(var(--v-theme-surface));
}

.sidebar-instance-menu__item {
  min-height: 40px;
}
</style>
