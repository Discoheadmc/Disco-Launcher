<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-1 home-metadata-box"
    >
      <AvatarItemList
        :items="items"
      />
    </div>
    <div class="flex-grow mr-2" />
    <transition name="fade-transition">
      <div
        key="launch-button-group"
        class="flex items-center justify-end overflow-visible home-launch-group"
        v-if="!isInFocusMode || !(router.currentRoute.value.path === '/')"
      >
        <HomeLaunchButtonStatus
          :active="active"
        />
        <!-- Disco: the big header launch pill (and its embedded settings gear)
             was removed. Launching lives solely in the right-hand
             InstanceActionsPanel, which shares the same kLaunchButton handler.
             The gear's menu rows (Ayarlar/Log/Klasör/Kısayol) already exist as
             dedicated rows in that panel. -->
      </div>
    </transition>
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import { useExtensionItemsGamePlay, useExtensionItemsVersion } from '@/composables/extensionItems'
import { kInstance } from '@/composables/instance'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'

const { instance, runtime: version } = injection(kInstance)
const { versionHeader } = injection(kInstanceVersion)
const isInFocusMode = useInFocusMode()
const router = useRouter()

const active = ref(false)

const compact = injection(kCompact)

const versionItems = useExtensionItemsVersion(instance, versionHeader)
const playDataItems = useExtensionItemsGamePlay(instance)
const items = computed(() => [...versionItems.value, ...playDataItems.value])

</script>
