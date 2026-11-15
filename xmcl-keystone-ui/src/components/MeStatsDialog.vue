<template>
  <!-- Disco: play statistics panel for the "My stuff" page. A short, flat
       summary of what the user actually played: total time, the three biggest
       instances with a proportion bar, and the most recent one. Everything
       comes from the shared instance state, so it refreshes the moment a new
       session is recorded. -->
  <v-dialog
    v-model="open"
    max-width="520px"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <v-card data-testid="me-stats-dialog">
      <div class="stats__header">
        <div>
          <div class="text-subtitle-1 font-weight-medium">
            {{ t('homeStats.title') }}
          </div>
          <div class="text-caption stats__subtitle">
            {{ t('homeStats.subtitle') }}
          </div>
        </div>
        <v-btn
          variant="text"
          size="small"
          :aria-label="t('shared.cancel')"
          data-testid="me-stats-close"
          @click="open = false"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </div>
      <v-divider />

      <!-- Empty state: nothing has been played yet. -->
      <div
        v-if="played.length === 0"
        class="stats__empty"
        data-testid="me-stats-empty"
      >
        <v-icon size="40" class="mb-3">sports_esports</v-icon>
        <div class="text-body-2">{{ t('homeStats.empty') }}</div>
      </div>

      <template v-else>
        <!-- Totals -->
        <div class="stats__totals">
          <div class="stats__total">
            <div class="stats__total-label">{{ t('instance.playtime') }}</div>
            <div
              class="stats__total-value"
              data-testid="me-stats-total"
            >{{ totalText }}</div>
          </div>
          <div class="stats__total">
            <div class="stats__total-label">{{ t('homeStats.instances') }}</div>
            <div class="stats__total-value">{{ played.length }}</div>
          </div>
          <div class="stats__total">
            <div class="stats__total-label">{{ t('homeStats.sessions') }}</div>
            <div class="stats__total-value">{{ sessions }}</div>
          </div>
        </div>
        <v-divider />

        <!-- Top three, with a share bar -->
        <div class="stats__body">
          <div
            v-for="row in top"
            :key="row.path"
            class="stats__row"
          >
            <img
              class="stats__row-icon"
              :src="getInstanceIcon(row.instance, undefined)"
              :alt="row.name"
              draggable="false"
            >
            <div class="stats__row-text">
              <div class="stats__row-name">{{ row.name }}</div>
              <div class="stats__row-bar">
                <span
                  class="stats__row-fill"
                  :style="{ width: `${row.share}%` }"
                />
              </div>
            </div>
            <div class="stats__row-value">{{ row.text }}</div>
          </div>
        </div>
        <v-divider />

        <!-- Most recent -->
        <div class="stats__recent">
          <div class="text-caption stats__total-label">
            {{ t('instance.lastPlayed') }}
          </div>
          <div class="stats__recent-row">
            <img
              class="stats__row-icon"
              :src="getInstanceIcon(recent.instance, undefined)"
              :alt="recent.name"
              draggable="false"
            >
            <div class="stats__row-text">
              <div class="stats__row-name">{{ recent.name }}</div>
              <div class="text-caption">{{ recentText }}</div>
            </div>
          </div>
        </div>
      </template>

      <v-divider />
      <div class="stats__actions">
        <v-spacer />
        <v-btn
          variant="text"
          data-testid="me-stats-done"
          @click="open = false"
        >
          {{ t('shared.close') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kInstances } from '@/composables/instances'
import { TimeUnit, getHumanizeDuration } from '@/util/date'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const open = defineModel<boolean>()
const { instances } = injection(kInstances)

/** One row of the panel: an instance plus its humanized play time. */
interface StatsRow {
  path: string
  name: string
  instance: any
  ms: number
  text: string
  /** Share of the total time, 0-100. */
  share: number
}

/** Humanize a millisecond span using the existing duration keys. */
function humanize(ms: number): string {
  const [text, value, unit] = getHumanizeDuration(ms)
  switch (unit) {
    case TimeUnit.Day:
      return t('duration.day', { duration: text }, { plural: value })
    case TimeUnit.Hour:
      return t('duration.hour', { duration: text }, { plural: value })
    case TimeUnit.Minute:
      return t('duration.minute', { duration: text }, { plural: value })
    default:
      return t('duration.second', { duration: text }, { plural: value })
  }
}

/** Only instances that were actually played count towards the statistics. */
const played = computed<StatsRow[]>(() => {
  const list = instances.value
    .filter(i => (i.playtime ?? 0) > 0)
    .map(i => ({ path: i.path, name: i.name, instance: i, ms: i.playtime ?? 0, text: humanize(i.playtime ?? 0), share: 0 }))
    .sort((a, b) => b.ms - a.ms)
  const total = list.reduce((sum, r) => sum + r.ms, 0)
  for (const r of list) {
    r.share = total > 0 ? Math.round((r.ms / total) * 100) : 0
  }
  return list
})

/** A "session" is an instance that has ever been started. */
const sessions = computed(() =>
  instances.value.filter(i => (i.lastPlayedDate ?? 0) > 0).length,
)

const totalText = computed(() => {
  const total = played.value.reduce((sum, r) => sum + r.ms, 0)
  return humanize(total)
})

const top = computed<StatsRow[]>(() => played.value.slice(0, 3))

const recent = computed<StatsRow>(() => {
  const list = instances.value
    .filter(i => (i.lastPlayedDate ?? 0) > 0)
    .sort((a, b) => (b.lastPlayedDate ?? 0) - (a.lastPlayedDate ?? 0))[0]
  return {
    path: list.path,
    name: list.name,
    instance: list,
    ms: list.playtime ?? 0,
    text: humanize(list.playtime ?? 0),
    share: 0,
  }
})

const recentText = computed(() => {
  const date = recent.value?.instance?.lastPlayedDate
  if (!date) return t('instance.neverPlayed')
  return new Date(date).toLocaleString()
})
</script>

<style scoped>
.stats__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px 10px;
}

.stats__subtitle {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.stats__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 16px;
  opacity: 0.7;
}

.stats__totals {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.stats__total {
  flex: 1 1 0;
  min-width: 0;
}

.stats__total-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.stats__total-value {
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stats__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
}

.stats__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stats__row-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  object-fit: contain;
  image-rendering: pixelated;
}

.stats__row-text {
  flex: 1 1 auto;
  min-width: 0;
}

.stats__row-name {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Proportion bar - flat, square, theme tokens only. */
.stats__row-bar {
  margin-top: 4px;
  height: 6px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 0;
}

.stats__row-fill {
  display: block;
  height: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 0;
}

.stats__row-value {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.stats__recent {
  padding: 10px 16px 14px;
}

.stats__recent-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.stats__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}
</style>
