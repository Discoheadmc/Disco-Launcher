<template>
  <div
    ref="scrollElement"
    class="select-none"
    :class="{ 'h-full': isFocus }"
    v-context-menu="isFocus ? getFocusBackgroundMenu : undefined"
  >
    <HomeCriticalError />
    <transition name="slide-y-reverse-transition" mode="out-in">
      <div v-if="!isFocus" class="flex items-start gap-0 pr-0">
        <div class="flex-1 min-w-0 mx-3 relative">
          <HomeInstanceGrid />
        </div>
        <InstanceActionsPanel class="home-side-panel sticky top-0" />
      </div>
      <HomeFocusFooter v-if="isFocus" class="absolute bottom-0 left-0 pb-[26px]" />
    </transition>
  </div>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useGamepadAction } from '@/composables/gamepad'
import { kUpstream } from '@/composables/instanceUpdate'
import { kCompact } from '@/composables/scrollTop'
import { useTutorial } from '@/composables/tutorial'
import { useInFocusMode } from '@/composables/uiLayout'
import { useHomeFocusCards } from '@/composables/homeCards'
import { vContextMenu } from '@/directives/contextMenu'
import { injection } from '@/util/inject'
import { isBedrockInstance } from '@xmcl/instance'
import type { DriveStep } from 'driver.js'
import HomeCriticalError from './HomeCriticalError.vue'
import HomeFocusFooter from './HomeFocusFooterV2.vue'
import HomeInstanceGrid from './HomeInstanceGrid.vue'
import InstanceActionsPanel from './InstanceActionsPanel.vue'

const isFocus = useInFocusMode()
const { getBackgroundMenu: getFocusBackgroundMenu } = useHomeFocusCards()
const { instance } = injection(kInstance)
const isBedrock = computed(() => isBedrockInstance(instance.value))

watch(isBedrock, (bedrock) => {
  if (bedrock) {
    isFocus.value = false
  }
}, { immediate: true })
provide(
  kUpstream,
  computed(() => ({
    upstream: instance.value.upstream,
    minecraft: instance.value.runtime.minecraft,
  })),
)

const compact = injection(kCompact)
onMounted(() => {
  compact.value = false
})

const { show } = useDialog('HomeDropModpackDialog')

useGlobalDrop({
  onDrop: async (e) => {
    const files = e.files
    const file = files?.[0]
    if (file) {
      const ext = file.name.split('.').pop()
      const filePath = windowController.getPathForFile(file)
      if ((ext === 'zip' || ext === 'mrpack') && filePath) {
        show(filePath)
        return
      }
    }
  },
})

const scrollElement = ref(null as HTMLElement | null)
provide('scrollElement', scrollElement)

const { t } = useI18n()

import { useLaunchButton } from '@/composables/launchButton'

// Gamepad face-button actions scoped to the home page (auto-unregister on leave).
const router = useRouter()
const { text: launchText, onClick: onLaunchClick } = useLaunchButton()
useGamepadAction('X', {
  label: () => launchText.value,
  handler: () => onLaunchClick(),
})
useGamepadAction('Y', {
  label: () => t('gamepad.guide.instanceSettings'),
  handler: () => router.push('/base-setting'),
})

useTutorial(
  computed(() => {
    const steps: DriveStep[] = [
      {
        element: '#my-stuff-button',
        popover: { title: t('userAccount.add'), description: t('tutorial.userAccountDescription') },
      },
      {
        element: '#create-instance-button',
        popover: { title: t('instances.add'), description: t('tutorial.instanceAddDescription') },
      },
      {
        element: '#launch-button',
        popover: { title: t('launch.launch'), description: t('tutorial.launchDescription') },
      },
    ]
    return steps
  }),
)
</script>
