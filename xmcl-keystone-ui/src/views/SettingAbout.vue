<template>
  <section class="about">
    <SettingCard>
      <div class="pa-4">
        <!-- Logo + name + tagline -->
        <div class="d-flex align-center flex-wrap gap-4 mb-6">
          <v-img
            :src="logo"
            alt="Disco Launcher Logo"
            width="64"
            height="64"
            class="mr-4 rounded-lg flex-grow-0 flex-shrink-0"
          ></v-img>
          <div>
            <div class="text-h5 font-weight-bold d-flex align-center">
              Disco Launcher
              <BetaBadge />
            </div>
            <div class="text-caption opacity-70">
              {{ t('setting.aboutPage.tagline') }}
            </div>
          </div>
          <v-spacer />
          <div class="d-flex align-center gap-2">
            <v-icon color="primary" size="small">verified</v-icon>
            <div class="text-caption font-weight-medium">MIT</div>
          </div>
        </div>

        <!-- Version info card -->
        <div class="surface-panel p-4 mb-6">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-sm font-weight-medium opacity-80">{{ t('setting.aboutPage.version') }}</div>
            <div class="text-sm font-weight-bold">{{ versionDisplay }}</div>
          </div>
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-sm font-weight-medium opacity-80">{{ t('setting.aboutPage.platform') }}</div>
            <div class="text-sm">{{ platformLabel }}</div>
          </div>
          <div class="d-flex align-center justify-space-between">
            <div class="text-sm font-weight-medium opacity-80">{{ t('setting.aboutPage.account') }}</div>
            <div class="text-sm">{{ accountLabel }}</div>
          </div>
          <!-- Disco Launcher: turning streamer mode on removes this button, so
               no account detail can be pasted into a chat or a bug report. -->
          <v-btn
            v-if="!streamerMode"
            class="mt-3"
            variant="outlined"
            size="small"
            prepend-icon="content_copy"
            data-testid="about-copy-info"
            @click="copyInfo"
          >
            {{ t('setting.aboutPage.copyInfo') }}
          </v-btn>
        </div>

        <!-- Action links -->
        <div class="d-flex flex-wrap gap-2 mb-6">
          <v-btn
            v-for="link in links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            variant="text"
            size="small"
            :prepend-icon="link.icon"
            :data-testid="`about-link-${link.id}`"
          >
            {{ link.title }}
          </v-btn>
        </div>

        <!-- Special thanks + license + legal -->
        <div class="text-caption opacity-70 mb-1">
          {{ t('setting.aboutPage.thanks') }}: {{ t('setting.aboutPage.thanksList') }}
        </div>
        <div class="text-caption opacity-70 mb-1">
          {{ t('setting.aboutPage.copyright') }}
        </div>
        <div class="text-caption opacity-70">
          NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
        </div>
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import BetaBadge from '@/components/BetaBadge.vue'
import SettingCard from '@/components/SettingCard.vue'
import { kEnvironment } from '@/composables/environment'
import { useNotifier } from '@/composables/notifier'
import { useSettings } from '@/composables/setting'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import logo from '../assets/logo.png'

const env = injection(kEnvironment)
const { userProfile, gameProfile } = injection(kUserContext)
const { streamerMode } = useSettings()
const { notify } = useNotifier()
const { t } = useI18n()

const version = computed(() => env.value?.version ?? '')
/** "0.1.0-beta" reads as "0.1.0 Beta"; a plain version passes through. */
const versionDisplay = computed(() => {
  const raw = version.value
  if (!raw) return ''
  const [core, ...rest] = raw.split('-')
  if (rest.length === 0) return core
  const tag = rest.join('-')
  return `${core} ${tag.charAt(0).toUpperCase()}${tag.slice(1)}`
})
const platformLabel = computed(() => {
  const os = env.value?.os ?? 'unknown'
  const name = os === 'osx' ? 'macOS' : os === 'windows' ? 'Windows' : os === 'linux' ? 'Linux' : os
  const arch = env.value?.arch
  return arch ? `${name} ${arch}` : name
})
/** The account email is masked; only the MC nickname is shown in clear. */
const maskedUsername = computed(() => {
  const username = userProfile.value?.username ?? ''
  if (!username) return ''
  const at = username.indexOf('@')
  if (at > 0) return `${username[0]}***@${username.slice(at + 1)}`
  if (username.length <= 2) return '*'.repeat(username.length)
  return `${username.slice(0, 2)}***`
})
const accountLabel = computed(() => {
  const nickname = gameProfile.value?.name ?? ''
  const account = maskedUsername.value
  if (nickname && account) return `${nickname} (${account})`
  return nickname || account || '—'
})
const links = computed(() => [
  { id: 'github', title: t('setting.aboutPage.github'), icon: 'code', url: 'https://github.com/Discoheadmc/Disco-Launcher' },
  { id: 'releases', title: t('setting.aboutPage.releases'), icon: 'new_releases', url: 'https://github.com/Discoheadmc/Disco-Launcher/releases' },
  { id: 'community', title: t('setting.aboutPage.community'), icon: 'forum', url: 'https://www.reddit.com/r/DHMC/' },
])

function copyInfo() {
  const text = [
    `Disco Launcher ${versionDisplay.value}`,
    `${t('setting.aboutPage.platform')}: ${platformLabel.value}`,
    `${t('setting.aboutPage.account')}: ${accountLabel.value}`,
  ].join('\n')
  navigator.clipboard.writeText(text)
    .then(() => notify({ level: 'success', title: t('setting.aboutPage.copied'), body: text }))
    .catch((err) => notify({ level: 'error', title: t('setting.aboutPage.copyFailed'), body: String(err) }))
}
</script>

<style scoped>
</style>