<template>
  <v-list
    ref="menuRoot"
    role="menu"
    :aria-label="t('baseSetting.title', 2)"
    min-width="260"
  >
    <v-list-item
      role="menuitem"
      :title="t('baseSetting.title', 2)"
      to="/base-setting"
    >
      <template #prepend>
        <v-icon size="20">
          settings
        </v-icon>
      </template>
    </v-list-item>
    <v-list-item
      v-if="!isBedrock || bedrockStorage"
      role="menuitem"
      :title="isBedrock ? t('instance.openLogFolder') : t('logsCrashes.title')"
      @click="showLogs"
    >
      <template #prepend>
        <v-icon size="20">
          subtitles
        </v-icon>
      </template>
    </v-list-item>
    <v-list-item
      v-if="!isBedrock || bedrockStorage"
      role="menuitem"
      :title="t('instance.showInstance')"
      @click="showInstanceFolder"
    >
      <template #prepend>
        <v-icon size="20">
          folder
        </v-icon>
      </template>
    </v-list-item>
    <v-list-item
      v-if="env && env.os !== 'osx'"
      role="menuitem"
      :title="t('launch.createShortcut')"
      @click="onCreateShortcut"
    >
      <template #prepend>
        <v-icon size="20">
          rocket_launch
        </v-icon>
      </template>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { useService } from '@/composables';
import { useDialog } from '@/composables/dialog'
import { kEnvironment } from '@/composables/environment';
import { kInstance } from '@/composables/instance';
import { kUserContext } from '@/composables/user';
import { join } from '@/util/basename';
import { getInstanceIcon } from '@/util/favicon';
import { injection } from '@/util/inject'
import { BaseServiceKey, BedrockServiceKey, BedrockStoragePaths, LaunchServiceKey } from '@xmcl/runtime-api';
import { isBedrockInstance } from '@xmcl/instance';

const { t } = useI18n()
defineProps<{}>()

// When the menu opens (this component mounts) Vuetify redirects focus to the
// overlay content wrapper, which sits *above* the roving-tabindex root, so
// arrow keys never reach the directive. Move focus onto the first item so the
// roving group is actually focused and Up/Down navigation works.
const menuRoot = ref<{ $el: HTMLElement }>()
onMounted(async () => {
  await nextTick()
  menuRoot.value?.$el.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
})

const { path, name, instance } = injection(kInstance)
const { userProfile } = injection(kUserContext)
const env = injection(kEnvironment)

const isBedrock = computed(() => isBedrockInstance(instance.value))
const { createLaunchShortcut } = useService(LaunchServiceKey)
const { getDesktopDirectory, openDirectory } = useService(BaseServiceKey)
const { getStoragePaths } = useService(BedrockServiceKey)
const onCreateShortcut = async () => {
  const dir = await getDesktopDirectory()
  const { filePath } = await windowController.showSaveDialog({
    defaultPath: join(dir, name.value),
    filters: env.value?.os === 'windows' ? [
      {
        name: 'Shortcut',
        extensions: ['lnk']
      }
    ] : [{
      name: 'Shortcut',
      extensions: ['desktop']
    }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  })
  if (!filePath) {
    return
  }
  let icon = getInstanceIcon(instance.value, undefined)
  if (icon.endsWith('.webp')) {
    // render webp to png
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.src = icon
    await new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)
        resolve(true)
      }
    })
    const dataUrl = canvas.toDataURL('image/png')
    icon = dataUrl
  }
  await createLaunchShortcut({
    instancePath: path.value,
    destination: filePath,
    userId: userProfile.value.id,
    icon,
  })
}

// Instance actions (logs / folder)
const { show: showLogDialog } = useDialog('log')

const bedrockStorage = ref<BedrockStoragePaths>()
watch(isBedrock, async (bedrock) => {
  bedrockStorage.value = undefined
  if (bedrock) {
    bedrockStorage.value = await getStoragePaths()
  }
}, { immediate: true })

function showInstanceFolder() {
  openDirectory(isBedrock.value ? bedrockStorage.value!.dataPath : path.value)
}

function showLogs() {
  if (isBedrock.value) {
    openDirectory(bedrockStorage.value!.logsPath)
    return
  }
  showLogDialog()
}
</script>
