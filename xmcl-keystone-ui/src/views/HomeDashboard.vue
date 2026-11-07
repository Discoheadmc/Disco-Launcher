<template>
  <!-- Disco: "Yeni Ana Ekran" (dashboard home). A large card for the last
       played instance on top, a compact list below. Every action is reachable
       from the card's menu, so the classic right panel can stay hidden while
       this layout is active. Launching a row from the list reuses the app root
       launch button exactly like the panel does (select, then click). -->
  <div class="dashboard" data-testid="home-dashboard">
    <!-- No instance / never played -->
    <div
      v-if="!lastPlayed"
      class="dashboard__empty"
      data-testid="home-dashboard-empty"
    >
      <v-icon size="40" class="mb-2">sports_esports</v-icon>
      <div class="text-body-1 mb-1">{{ t('homeDashboard.noneTitle') }}</div>
      <div class="text-caption mb-4">{{ t('homeDashboard.noneHint') }}</div>
      <v-btn color="primary" @click="onCreate">
        <v-icon start>add</v-icon>
        {{ t('instances.add') }}
      </v-btn>
    </div>

    <template v-else>
      <!-- Big card: the last played instance -->
      <div
        class="hero"
        data-testid="home-dashboard-hero"
      >
        <div class="hero__banner">
          <img
            :src="getInstanceIcon(lastPlayed, undefined)"
            :alt="lastPlayed.name"
            draggable="false"
          >
        </div>
        <div class="hero__body">
          <div class="hero__name" :title="lastPlayed.name">{{ lastPlayed.name }}</div>
          <div class="hero__meta">
            {{ lastPlayed.runtime.minecraft || '' }}
            <template v-if="lastPlayed.runtime.forge"> · Forge {{ lastPlayed.runtime.forge }}</template>
            <template v-else-if="lastPlayed.runtime.fabricLoader"> · Fabric {{ lastPlayed.runtime.fabricLoader }}</template>
          </div>
          <div class="hero__facts">
            <span><v-icon size="14">schedule</v-icon> {{ playTimeText() }}</span>
            <span><v-icon size="14">update</v-icon> {{ lastPlayedText }}</span>
          </div>
          <div class="hero__actions">
            <v-btn
              size="large"
              color="primary"
              :data-testid="needsInstall ? 'home-dashboard-download' : 'home-dashboard-launch'"
              :disabled="needsInstall ? fixing : false"
              @click="heroPrimaryAction"
            >
              <v-icon start>{{ needsInstall ? 'get_app' : 'play_arrow' }}</v-icon>
              {{ needsInstall ? t('shared.download') : t('launch.launch') }}
            </v-btn>
            <v-btn
              variant="outlined"
              size="large"
              data-testid="home-dashboard-menu"
              @click="showMenu = !showMenu"
            >
              <v-icon start>more_horiz</v-icon>
              {{ t('homeDashboard.more') }}
            </v-btn>
          </div>

          <!-- Action menu: the same shared source, minus the primary action. -->
          <div
            v-if="showMenu"
            class="hero__menu"
            data-testid="home-dashboard-action-menu"
          >
            <button
              v-for="action in menuActions"
              :key="action.id"
              type="button"
              class="hero__menu-btn"
              :class="{ 'hero__menu-btn--danger': action.danger }"
              :data-testid="action.testid"
              @click="runMenuAction(action)"
            >
              <v-icon size="16">{{ action.icon }}</v-icon>
              {{ action.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Compact list: one quick launch per row -->
      <div class="list" data-testid="home-dashboard-list">
        <div class="list__header">
          <span class="text-subtitle-2">{{ t('homeDashboard.listTitle') }}</span>
          <span class="text-caption list__count">{{ t('homeDashboard.count', { count: instances.length }, instances.length) }}</span>
        </div>
        <div class="list__rows">
          <div
            v-for="inst in instances"
            :key="inst.path"
            class="row"
            :class="{ 'row--selected': inst.path === lastPlayed?.path }"
            :data-testid="`home-dashboard-row-${inst.name}`"
          >
            <img
              class="row__icon"
              :src="getInstanceIcon(inst, undefined)"
              :alt="inst.name"
              draggable="false"
              loading="lazy"
              @click="select(inst.path)"
            >
            <div
              class="row__text"
              @click="select(inst.path)"
            >
              <div class="row__name">{{ inst.name }}</div>
              <div class="row__meta">
                {{ inst.runtime.minecraft || '' }}
                <template v-if="inst.runtime.forge"> · Forge {{ inst.runtime.forge }}</template>
                <template v-else-if="inst.runtime.fabricLoader"> · Fabric {{ inst.runtime.fabricLoader }}</template>
              </div>
            </div>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              :data-testid="`home-dashboard-row-launch-${inst.name}`"
              @click.stop="launchInstance(inst.path)"
            >
              <v-icon start size="16">play_arrow</v-icon>
              {{ t('launch.launch') }}
            </v-btn>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { useInstanceActions } from '@/composables/instanceActions'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { useInstanceLaunchMenuItems } from '@/composables/instanceLaunchMenuItems'
import { kLaunchButton } from '@/composables/launchButton'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { useDialog } from '@/composables/dialog'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { instances, selectedInstance } = injection(kInstances)
const { select } = injection(kInstance)
const { onClick: onLaunchClick } = injection(kLaunchButton)
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

/** The instance shown in the hero card: the most recently played one. */
const lastPlayed = computed(() => {
  const list = instances.value.filter(i => (i.lastPlayedDate ?? 0) > 0)
  if (list.length === 0) return undefined
  return [...list].sort((a, b) => (b.lastPlayedDate ?? 0) - (a.lastPlayedDate ?? 0))[0]
})

const showMenu = ref(false)

function onCreate() {
  showAddInstance(undefined)
}

function playTimeText() {
  const ms = lastPlayed.value?.playtime
  if (!ms) return t('instance.neverPlayed')
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  // t() already composes the number with the unit ("3 gün"), so the parts are
  // joined directly - prefixing the count again would print it twice.
  const parts: string[] = []
  if (days > 0) parts.push(t('duration.day', { duration: days }, { plural: days }))
  if (hours > 0) parts.push(t('duration.hour', { duration: hours }, { plural: hours }))
  if (parts.length === 0 || minutes > 0) {
    parts.push(t('duration.minute', { duration: minutes }, { plural: minutes }))
  }
  return parts.join(' ')
}

const lastPlayedText = computed(() => {
  const date = lastPlayed.value?.lastPlayedDate
  if (!date) return t('instance.neverPlayed')
  return new Date(date).toLocaleString()
})

/** Primary action on the card: install when broken, otherwise launch. */
const { issues, fixInstanceFileIssue } = useInstanceLaunchMenuItems()
const { fix: fixVersionIssues, loading: loadingVersionIssues, isInstanceFixing } =
  injection(kInstanceVersionInstall)
const needsInstall = computed(() => {
  if (!lastPlayed.value) return false
  const i = lastPlayed.value
  if (i.path !== selectedInstance.value) return false
  return issues.value !== 0
})
const fixing = computed(() => {
  if (!lastPlayed.value) return false
  return isInstanceFixing(lastPlayed.value.path) || loadingVersionIssues.value
})

async function heroPrimaryAction() {
  const inst = lastPlayed.value
  if (!inst) return
  if (inst.path !== selectedInstance.value) select(inst.path)
  await nextTick()
  if (needsInstall.value) {
    await Promise.allSettled([fixVersionIssues(inst.path), fixInstanceFileIssue(inst.path)])
    return
  }
  await onLaunchClick()
}

/** The menu list is the shared source minus the primary (launch/install). */
const { actions } = useInstanceActions()
const menuActions = computed(() =>
  actions.value.filter(a => a.id !== 'launch' && a.id !== 'install'),
)

function runMenuAction(action: { run: () => void }) {
  showMenu.value = false
  action.run()
}

/**
 * Quick launch from a list row: select the instance, then click the app root
 * launch button - the same sequence the classic panel uses.
 */
async function launchInstance(instancePath: string) {
  if (instancePath !== selectedInstance.value) select(instancePath)
  await nextTick()
  await onLaunchClick()
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 4px 24px;
}

.dashboard__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  opacity: 0.75;
  text-align: center;
}

/* The last-played card: flat, square, one thin border - no elevation. */
.hero {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.hero__banner {
  width: 128px;
  height: 128px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  overflow: hidden;
}

.hero__banner img {
  max-width: 82%;
  max-height: 82%;
  object-fit: contain;
  image-rendering: pixelated;
}

.hero__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero__name {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero__meta {
  font-size: 0.8rem;
  opacity: 0.7;
}

.hero__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 0.75rem;
  opacity: 0.75;
}

.hero__facts span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.hero__menu {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 2px;
}

.hero__menu-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: 0;
  border-radius: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.hero__menu-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.hero__menu-btn--danger:hover {
  background: rgba(255, 82, 82, 0.18);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 2px;
}

.list__count {
  opacity: 0.6;
}

.list__rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* Compact row: icon + name/version on the left, quick launch on the right. */
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.row:hover {
  background: rgba(255, 255, 255, 0.1);
}

.row--selected {
  border-color: rgba(var(--v-theme-primary), 0.6);
}

.row__icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  object-fit: contain;
  image-rendering: pixelated;
  cursor: pointer;
}

.row__text {
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;
}

.row__name {
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__meta {
  font-size: 0.68rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
