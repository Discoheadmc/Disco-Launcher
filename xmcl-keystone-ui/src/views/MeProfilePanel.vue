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

      <!-- Cape row -->
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
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import PlayerCape from '@/components/PlayerCape.vue'
import SkinView from '@/components/SkinView.vue'
import UserAccountSwitcher from '@/components/UserAccountSwitcher.vue'
import UserSkin from '@/components/UserSkin.vue'
import UserSkinLibraryDialog from '@/components/UserSkinLibraryDialog.vue'
import { kUserContext } from '@/composables/user'
import { UserSkinModel, UserSkinRenderPaused, useUserSkin } from '@/composables/userSkin'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const { t } = useI18n()

const { userProfile, gameProfile } = injection(kUserContext)

const paused = inject(UserSkinRenderPaused, ref(false))

const skinModel = useUserSkin(
  computed(() => userProfile.value.id),
  gameProfile,
  computed(() => userProfile.value),
)
provide(UserSkinModel, skinModel)
const { canUploadSkin } = skinModel

const isSkinLibraryOpen = ref(false)

const capes = computed(() => gameProfile.value?.capes ?? [])
const capeScroller = ref<HTMLElement | null>(null)

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
