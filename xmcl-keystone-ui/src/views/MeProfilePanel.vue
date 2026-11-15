<template>
  <div class="me-profile-panel workspace-side-panel flex flex-col h-full overflow-hidden select-none">
    <UserAccountSwitcher class="profile-header px-3 pt-3 pb-2 flex-shrink-0" show-inline-delete />

    <!-- Skin & Cape Card -->
    <div class="skin-cape-card surface-panel mx-3 mt-1 mb-2 flex-shrink-0 overflow-hidden">
      <!-- 3D Model with edit controls -->
      <div
        class="flex items-center justify-center py-3 cursor-default"
      >
        <UserSkin
          :user="userProfile"
          :profile="gameProfile"
          :inspect="false"
          :hide-controls="true"
        />
      </div>

      <!-- Skin Library Button (Prism-style flat outline button) -->
      <div v-if="canUploadSkin" class="skin-row px-3 py-2"
        style="border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);"
      >
        <v-btn
          variant="outlined"
          size="small"
          block
          color="primary"
          class="prism-flat-btn font-medium text-xs tracking-normal"
          @click="isSkinLibraryOpen = true"
        >
          <v-icon start size="16">checkroom</v-icon>
          {{ t('me.localCloset') }}
        </v-btn>
      </div>

      <!-- Official cape row (Microsoft-owned capes only) -->
      <div v-if="capes.length > 0" class="cape-row px-3 py-2.5"
        style="border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);"
      >
        <div class="text-[10px] font-semibold uppercase tracking-widest opacity-50 mb-1.5">
          {{ t('userCape.changeTitle') }}
        </div>
        <div
          ref="capeScroller"
          v-roving-tabindex
          role="radiogroup"
          :aria-label="t('userCape.changeTitle')"
          class="cape-scroll flex gap-1.5 overflow-x-auto"
          @wheel.prevent="onCapeWheel"
        >
          <!-- No cape -->
          <div
            v-shared-tooltip.top="() => t('userCape.noCape')"
            class="cape-thumb flex-shrink-0 cursor-pointer border transition-colors flex items-center justify-center"
            :class="!skinModel.cape.value
              ? 'border-primary bg-primary/10'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.2)]'"
            role="radio"
            tabindex="0"
            :aria-checked="!skinModel.cape.value"
            :aria-label="t('userCape.noCape')"
            @click="selectCape(undefined)"
            @keydown.enter.prevent="selectCape(undefined)"
            @keydown.space.prevent="selectCape(undefined)"
          >
            <div class="w-full h-full border border-dashed border-current rounded opacity-30 flex items-center justify-center">
              <v-icon size="12" aria-hidden="true">block</v-icon>
            </div>
          </div>
          <!-- Capes -->
          <div
            v-for="c of capes"
            :key="c.id"
            v-shared-tooltip.top="() => c.alias || c.id"
            class="cape-thumb flex-shrink-0 cursor-pointer border transition-colors overflow-hidden"
            :class="skinModel.cape.value === c.url
              ? 'border-primary bg-primary/10'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.2)]'"
            role="radio"
            tabindex="0"
            :aria-checked="skinModel.cape.value === c.url"
            :aria-label="c.alias || c.id"
            @click="selectCape(c.url)"
            @keydown.enter.prevent="selectCape(c.url)"
            @keydown.space.prevent="selectCape(c.url)"
          >
            <div class="cape-scale-wrapper">
              <PlayerCape :src="c.url" />
            </div>
          </div>
          <!-- Custom cape: opens the launcher-local cape picker (same size as official cape thumbs) -->
          <div
            v-shared-tooltip.top="() => customCapeSet ? t('userCape.customChange') : t('userCape.customPick')"
            class="cape-thumb flex-shrink-0 cursor-pointer border transition-colors flex items-center justify-center"
            :class="customSelected
              ? 'border-primary bg-primary/10'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.2)]'"
            role="button"
            tabindex="0"
            :aria-checked="customSelected"
            :aria-label="customCapeSet ? t('userCape.customChange') : t('userCape.customPick')"
            @click="isCustomCapeDialogOpen = true"
            @keydown.enter.prevent="isCustomCapeDialogOpen = true"
            @keydown.space.prevent="isCustomCapeDialogOpen = true"
          >
            <v-icon size="16" aria-hidden="true">{{ customCapeSet ? 'auto_awesome' : 'add' }}</v-icon>
          </div>
        </div>
        <div v-if="customCapeSet" class="mt-1.5 text-[10px] opacity-50 truncate">
          {{ t('userCape.customOnlyHere') }}
        </div>
      </div>
    </div>

    <UserSkinLibraryDialog
      v-model="isSkinLibraryOpen"
      :user="userProfile"
      :profile="gameProfile"
    />

    <CustomCapeDialog v-model="isCustomCapeDialogOpen" />
  </div>
</template>

<script lang="ts" setup>
import PlayerCape from '@/components/PlayerCape.vue'
import UserAccountSwitcher from '@/components/UserAccountSwitcher.vue'
import UserSkin from '@/components/UserSkin.vue'
import UserSkinLibraryDialog from '@/components/UserSkinLibraryDialog.vue'
import CustomCapeDialog from '@/components/CustomCapeDialog.vue'
import { useNotifier } from '@/composables/notifier'
import { useLocaleError } from '@/composables/error'
import { useAccountCustomCape } from '@/composables/userCape'
import { kUserContext } from '@/composables/user'
import { UserSkinModel, UserSkinRenderPaused, useUserSkin } from '@/composables/userSkin'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { notify } = useNotifier()
const toLocaleError = useLocaleError()

const { userProfile, gameProfile } = injection(kUserContext)

const paused = inject(UserSkinRenderPaused, ref(false))

const skinModel = useUserSkin(
  computed(() => userProfile.value.id),
  gameProfile,
  computed(() => userProfile.value),
)
provide(UserSkinModel, skinModel)

// The custom cape overrides the official one in the launcher's own 3D
// preview. When the user picks a custom cape the preview switches to it
// through this watch; removing it restores the official cape (if any).
const customCapeAccountKey = computed(() => `${userProfile.value.id}:${gameProfile.value.id}`)
const customCape = useAccountCustomCape(customCapeAccountKey)
const officialCapeUrl = computed(() => (gameProfile.value?.capes ? gameProfile.value.capes.find(c => c.state === 'ACTIVE')?.url : undefined) || gameProfile.value?.textures?.CAPE?.url)
// Re-apply the override whenever it arrives (service refresh) or the profile
// changes, because useUserSkin's reset() runs on those transitions and would
// otherwise clobber the override back to the official cape.
watch([customCape.capeUrl, () => gameProfile.value?.id], async ([url, _id], [oldUrl]) => {
  await nextTick() // let reset() settle first
  if (url) {
    // Launcher-local override: every preview reading the shared skin model
    // (panel 3D view + closet dialog) now renders the custom cape.
    skinModel.cape.value = url
  } else if (oldUrl && skinModel.cape.value === oldUrl) {
    // Removed while active: fall back to the official cape selection.
    skinModel.cape.value = officialCapeUrl.value
  }
}, { immediate: true })
// The custom thumb is only "selected" while the preview actually shows the
// stored custom cape (an official cape click switches the preview away).
const customSelected = computed(() => !!customCape.capeUrl.value && skinModel.cape.value === customCape.capeUrl.value)
const { canUploadSkin } = skinModel

const isSkinLibraryOpen = ref(false)
const isCustomCapeDialogOpen = ref(false)

const capes = computed(() => gameProfile.value?.capes ?? [])
const capeScroller = ref<HTMLElement | null>(null)

// Custom cape: launcher-local overlay, per account+profile.
const customCapeSet = computed(() => !!customCape.capeUrl.value)

function selectCape(url: string | undefined) {
  skinModel.cape.value = url
  skinModel.save()
}

function onCapeWheel(e: WheelEvent) {
  if (capeScroller.value) {
    capeScroller.value.scrollLeft += e.deltaY
  }
}
</script>

<style scoped>
.me-profile-panel {
  --workspace-side-panel-width: 280px;
}

/* Prism-style flat outline button: sharp corners, no fill/gloss. */
.prism-flat-btn {
  border-radius: 2px !important;
  text-transform: none;
}

.prism-flat-btn :deep(.v-btn__overlay) {
  opacity: 0;
}

.skin-thumb,
.cape-thumb {
  width: 36px;
  height: 52px;
  padding: 3px;
}

.cape-scale-wrapper {
  width: 80px;
  height: 120px;
  transform: scale(0.375);
  transform-origin: top left;
}

.skin-scroll,
.cape-scroll {
  scrollbar-width: none;
}

.skin-scroll::-webkit-scrollbar,
.cape-scroll::-webkit-scrollbar {
  height: 0;
  display: none;
}
</style>
