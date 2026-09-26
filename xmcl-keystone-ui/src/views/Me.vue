<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import { useTutorial } from '@/composables/tutorial'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { useInstanceContextMenuFunc } from '@/composables/instanceContextMenu'
import { useInstanceGroup } from '@/composables/instanceGroup'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { kLaunchButton } from '@/composables/launchButton'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { useGamepadInnerNav } from '@/composables/gamepad'
import { useTextFieldBehavior } from '@/composables/textfieldBehavior'
import { kTheme } from '@/composables/theme'
import { vContextMenu } from '@/directives/contextMenu'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { useFocus, useLocalStorage } from '@vueuse/core'
import { Instance } from '@xmcl/instance'
import { Ref, computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import MeProfilePanel from './MeProfilePanel.vue'

const { t } = useI18n()
const { instances } = injection(kInstances)
const { path } = injection(kInstance)
const { groups } = useInstanceGroup()
const { pinnedInstances } = useInjectSidebarSettings()

const filterKey = ref('')

// View mode: folder, date, or plain
const instanceViewMode = useLocalStorage<'folder' | 'date' | 'plain'>('instanceViewMode', 'plain')

// Gamepad triggers (L2/R2) switch the instance grouping tab.
const VIEW_MODES: Array<'folder' | 'date' | 'plain'> = ['folder', 'date', 'plain']
useGamepadInnerNav({
  handler: (dir) => {
    let idx = VIEW_MODES.indexOf(instanceViewMode.value)
    if (idx === -1) idx = 0
    idx = dir === 'next'
      ? (idx + 1) % VIEW_MODES.length
      : (idx - 1 + VIEW_MODES.length) % VIEW_MODES.length
    instanceViewMode.value = VIEW_MODES[idx]
  },
})

const filteredInstances = computed(() =>
  [...instances.value]
    .filter((v) => v.name.toLocaleLowerCase().includes(filterKey.value.toLocaleLowerCase()))
    .sort((a, b) => b.lastAccessDate - a.lastAccessDate),
)

// Create a map from instance path to instance
const instanceMap = computed(() => {
  const map = new Map<string, Instance>()
  for (const inst of filteredInstances.value) {
    map.set(inst.path, inst)
  }
  return map
})

interface GroupedItem {
  type: 'group'
  id: string
  name: string
  color: string
  instances: Instance[]
}

// Get grouped instances
const groupedInstances = computed((): GroupedItem[] => {
  const result: GroupedItem[] = []
  for (const item of groups.value) {
    if (typeof item === 'object') {
      const groupInstances: Instance[] = []
      for (const instancePath of item.instances) {
        const inst = instanceMap.value.get(instancePath)
        if (inst) {
          groupInstances.push(inst)
        }
      }
      if (groupInstances.length > 0) {
        result.push({
          type: 'group',
          id: item.id,
          name: item.name,
          color: item.color,
          instances: groupInstances,
        })
      }
    }
  }
  return result
})

// Get ungrouped instance paths
const groupedPaths = computed(() => {
  const paths = new Set<string>()
  for (const item of groups.value) {
    if (typeof item === 'object') {
      for (const instancePath of item.instances) {
        paths.add(instancePath)
      }
    }
  }
  return paths
})

// Filter to only ungrouped instances
const ungroupedInstances = computed(() => {
  return filteredInstances.value.filter((inst) => !groupedPaths.value.has(inst.path))
})

// Time-based grouping constants
const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24
const threeDays = oneDay * 3

const timeGroupTitles = computed(() => [
  t('instanceAge.today'),
  t('instanceAge.threeDay'),
  t('instanceAge.older'),
])

// Helper function to group instances by time
const groupByTime = (instances: Instance[]): Instance[][] => {
  const todayR: Instance[] = []
  const threeR: Instance[] = []
  const other: Instance[] = []
  for (const p of instances) {
    const diff = now - p.lastAccessDate
    if (diff <= oneDay) {
      todayR.push(p)
    } else if (diff <= threeDays) {
      threeR.push(p)
    } else {
      other.push(p)
    }
  }
  const result: Instance[][] = []
  if (todayR.length > 0) result.push(todayR)
  if (threeR.length > 0) result.push(threeR)
  if (other.length > 0) result.push(other)
  return result
}

const ungroupedByTime: Ref<Instance[][]> = computed(() => groupByTime(ungroupedInstances.value))
const instancesByTime: Ref<Instance[][]> = computed(() => groupByTime(filteredInstances.value))

// Unified data structure for both view modes
interface InstanceSection {
  id: string
  title: string
  icon: string
  instances: Instance[]
}

const instanceSections = computed((): InstanceSection[] => {
  if (instanceViewMode.value === 'folder') {
    const sections: InstanceSection[] = []

    // Add manual groups
    for (const group of groupedInstances.value) {
      sections.push({
        id: `group-${group.id}`,
        title: group.name || t('instances.folder'),
        icon: 'folder',
        instances: group.instances,
      })
    }

    // Add ungrouped instances directly
    if (ungroupedInstances.value.length > 0) {
      sections.push({
        id: 'ungrouped',
        title: ' ',
        icon: 'view_list',
        instances: ungroupedInstances.value,
      })
    }

    return sections
  } else if (instanceViewMode.value === 'date') {
    // Date view mode - all instances by time
    const sections: InstanceSection[] = []
    const timeGroups = instancesByTime.value
    timeGroups.forEach((timeGroup, i) => {
      if (timeGroup.length > 0) {
        sections.push({
          id: `time-${i}`,
          title: timeGroupTitles.value[i],
          icon: 'schedule',
          instances: timeGroup,
        })
      }
    })

    return sections
  } else {
    // Plain view mode - all instances in one list
    return [
      {
        id: 'plain',
        title: '',
        icon: 'view_list',
        instances: filteredInstances.value,
      },
    ]
  }
})

const { show: openAddInstanceDialog } = useDialog(AddInstanceDialogKey)

const router = useRouter()
const { onClick: onLaunchClick } = injection(kLaunchButton)

function selectInstance(instancePath: string) {
  path.value = instancePath
  if (router.currentRoute.value.path !== '/') {
    router.push('/')
  }
}

async function launchInstance(instancePath: string) {
  path.value = instancePath
  await nextTick()
  await onLaunchClick()
}

const getInstanceContextMenu = useInstanceContextMenuFunc()

const filter = ref<HTMLElement | null>(null)
const { focused } = useFocus(filter)
useTextFieldBehavior(filter, focused)

useTutorial(
  computed(() => [
    {
      element: '.profile-header',
      popover: {
        title: t('tutorial.me.profileTitle'),
        description: t('tutorial.me.profileDescription'),
      },
    },
    {
      element: '.skin-cape-card',
      popover: {
        title: t('tutorial.me.skinTitle'),
        description: t('tutorial.me.skinDescription'),
      },
    },
    {
      element: '.instances-section',
      popover: {
        title: t('tutorial.me.instancesTitle'),
        description: t('tutorial.me.instancesDescription'),
      },
    },
  ]),
)
</script>

<template>
  <div class="me-layout flex h-full overflow-hidden">
    <!-- Left: User Profile Panel -->
    <MeProfilePanel />

    <!-- Right: News + Instances (unchanged content) -->
    <div ref="container" class="my-stuff-page h-full flex-grow overflow-auto min-w-0">
    <div class="classic-container">
      <!-- Instances Section -->
      <section class="instances-section">
        <div class="section-header">
          <div class="d-flex align-center">
            <v-icon class="section-icon" color="primary" aria-hidden="true">apps</v-icon>
            <h2 class="section-title">{{ t('instance.current', 2) }}</h2>
          </div>
          <div v-if="instances.length > 0" class="d-flex align-center gap-2">
            <v-btn-toggle
              v-roving-tabindex
              v-model="instanceViewMode"
              density="compact"
              mandatory
              class="mr-2"
              :aria-label="t('me.instanceViewMode')"
            >
              <v-btn
                v-shared-tooltip="() => t('me.groupByFolder')"
                value="folder"
                size="small"
              >
                <v-icon size="small" aria-hidden="true">folder</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="() => t('me.groupByDate')"
                value="date"
                size="small"
              >
                <v-icon size="small" aria-hidden="true">schedule</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="() => t('me.listView')"
                value=""
                size="small"
              >
                <v-icon size="small" aria-hidden="true">view_list</v-icon>
              </v-btn>
            </v-btn-toggle>
            <v-btn color="primary" @click="openAddInstanceDialog" size="small">
              <v-icon start size="small" aria-hidden="true">add</v-icon>
              {{ t('instances.add') }}
            </v-btn>
          </div>
        </div>

        <v-text-field
          v-if="instances.length > 0"
          ref="filter"
          v-model="filterKey"
          :placeholder="t('shared.filter')"
          prepend-inner-icon="search"
          variant="outlined"
          density="compact"
          hide-details
          class="search-field mb-4"
        />

        <Hint
          v-if="instances.length === 0"
          icon="sports_esports"
          :text="t('instances.addDescription')"
          class="instances-empty"
        >
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="add"
            size="small"
            class="mt-2"
            @click="openAddInstanceDialog"
          >
            {{ t('instances.add') }}
          </v-btn>
        </Hint>

        <!-- Unified Instance Sections -->
        <div
          v-for="section in instanceSections"
          :key="section.id"
          class="mb-6"
          role="region"
          :aria-label="section.title || t('instance.name', 2)"
        >
          <div v-if="section.title" class="section-header-item mb-3">
            <v-icon size="small" class="mr-2" aria-hidden="true">{{ section.icon }}</v-icon>
            <span class="section-title-item">{{ section.title }}</span>
            <span class="section-count">({{ section.instances.length }})</span>
          </div>
          <div
            v-roving-tabindex
            role="group"
            :aria-label="section.title || t('instance.name', 2)"
            class="instances-grid"
          >
            <div
              v-for="instance in section.instances"
              :key="instance.path"
              v-context-menu="getInstanceContextMenu(instance)"
              class="instance-item surface-card-row"
              :class="{ 'instance-item--active': instance.path === path }"
              role="button"
              tabindex="0"
              :aria-label="`${instance.name} (Minecraft ${instance.runtime.minecraft})`"
              :aria-pressed="instance.path === path"
              @click="selectInstance(instance.path)"
              @keydown.enter.prevent="selectInstance(instance.path)"
              @keydown.space.prevent="selectInstance(instance.path)"
            >
              <div class="instance-avatar-wrapper">
                <v-avatar size="44" class="instance-avatar">
                  <v-img :src="getInstanceIcon(instance, undefined)" />
                </v-avatar>
                <div v-if="pinnedInstances.includes(instance.path)" class="pin-badge">
                  <v-icon size="x-small" color="white" class="text-[8px]" aria-hidden="true">push_pin</v-icon>
                </div>
              </div>
              <div class="instance-info">
                <div class="instance-name">{{ instance.name }}</div>
                <div class="instance-version">{{ instance.runtime.minecraft }}</div>
              </div>
              <v-btn
                v-shared-tooltip="() => t('launch.launch')"
                class="instance-play-button"
                color="primary"
                variant="text"
                size="small"
                icon="play_arrow"
                :aria-label="t('launch.launch')"
                @click.stop="launchInstance(instance.path)"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
  </div>
</template>

<style scoped>
.my-stuff-page {
  background: transparent;
}

.classic-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-icon {
  margin-right: 12px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: rgba(0, 0, 0, 0.9);
}

.dark .section-title {
  color: rgba(255, 255, 255, 0.9);
}

.instances-section {
  width: 100%;
  user-select: none;
}

.instances-empty {
  min-height: 180px;
}

.search-field {
  max-width: 400px;
  border-radius: 8px;
}

.group-header,
.time-header {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.dark .group-header,
.dark .time-header {
  color: rgba(255, 255, 255, 0.7);
}

.group-title,
.time-title {
  font-size: 1rem;
}

.group-count {
  margin-left: 8px;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
}

.dark .group-count {
  color: rgba(255, 255, 255, 0.5);
}

.instances-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

/* Mirrors the .v-list-item language: 10px radius, neutral hover bg,
   no lift/shadow. Lives outside the Vuetify list machinery (custom
   avatar + info layout) so the rules are duplicated here, but the
   radius pulls from the same token (--card-item-radius). */
.instance-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  /* radius / border / cursor / transition / hover come from .surface-card-row */
}

.instance-item--active {
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}

.instance-play-button {
  flex-shrink: 0;
  margin-left: auto;
}

.instance-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.pin-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  background-color: #eab308;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.section-header-item {
  display: flex;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.dark .section-header-item {
  color: rgba(255, 255, 255, 0.7);
}

.section-title-item {
  font-size: 1rem;
}

.section-count {
  margin-left: 8px;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.5);
}

.dark .section-count {
  color: rgba(255, 255, 255, 0.5);
}

.dark .sectionnce-name {
  color: rgba(255, 255, 255, 0.9);
}

.instance-version {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
}

.dark .instance-version {
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .classic-container {
    padding: 16px;
    gap: 24px;
  }

  .instances-grid {
    grid-template-columns: 1fr;
  }
}
</style>
