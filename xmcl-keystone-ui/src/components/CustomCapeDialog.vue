<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="rounded-xl border border-[rgba(var(--v-theme-on-surface),0.1)] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-[rgba(var(--v-theme-on-surface),0.08)]">
        <div class="flex items-center gap-2">
          <v-icon size="20" color="primary">upload</v-icon>
          <h2 class="text-lg font-bold">
            {{ t('userCape.customTitle') }}
          </h2>
        </div>
        <v-btn
          icon
          size="small"
          variant="text"
          :aria-label="t('shared.close')"
          @click="close"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </div>

      <!-- Body -->
      <div class="px-5 py-4 flex flex-col gap-4">
        <!-- Description: launcher-local scope note -->
        <p class="text-xs opacity-60 leading-relaxed">
          {{ t('userCape.customDescription') }}
        </p>

        <!-- PNG picker / preview -->
        <div v-if="!previewUrl" class="flex flex-col items-center gap-2">
          <v-btn
            variant="outlined"
            color="primary"
            size="default"
            class="prism-flat-btn font-medium text-xs tracking-normal"
            data-testid="custom-cape-pick"
            @click="pick"
          >
            <v-icon start size="16">upload</v-icon>
            {{ t('userCape.customPick') }}
          </v-btn>
        </div>
        <div v-else class="flex items-center gap-3">
          <div class="cape-preview flex-shrink-0 rounded border border-[rgba(var(--v-theme-on-surface),0.15)] overflow-hidden bg-black/20">
            <img :src="previewUrl" class="w-full h-full object-contain" :alt="t('userCape.customTitle')">
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium truncate" :title="pendingName || t('userCape.customTitle')">
              {{ pendingName || t('userCape.customTitle') }}
            </div>
            <v-btn
              variant="text"
              size="small"
              class="mt-1 text-none"
              data-testid="custom-cape-repick"
              @click="pick"
            >
              <v-icon start size="14">swap_horiz</v-icon>
              {{ t('userCape.customChange') }}
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-2 px-5 py-3 border-t border-[rgba(var(--v-theme-on-surface),0.08)]">
        <v-btn
          v-if="customCapeSet"
          variant="text"
          size="default"
          color="error"
          data-testid="custom-cape-remove"
          @click="remove"
        >
          <v-icon start size="16">delete</v-icon>
          {{ t('userCape.customRemove') }}
        </v-btn>
        <div class="flex-grow" />
        <v-btn
          variant="text"
          size="default"
          @click="close"
        >
          {{ t('userCape.customCancel') }}
        </v-btn>
        <v-btn
          variant="elevated"
          color="primary"
          size="default"
          :disabled="!dirty"
          :loading="applying"
          data-testid="custom-cape-apply"
          @click="apply"
        >
          {{ t('userCape.customApply') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useAccountCustomCape } from '@/composables/userCape'
import { useLocaleError } from '@/composables/error'
import { useNotifier } from '@/composables/notifier'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const { notify } = useNotifier()
const toLocaleError = useLocaleError()

const { userProfile, gameProfile } = injection(kUserContext)
const accountKey = computed(() => `${userProfile.value.id}:${gameProfile.value.id}`)
const customCape = useAccountCustomCape(accountKey)

const customCapeSet = computed(() => !!customCape.capeUrl.value)

// A locally picked file (not yet applied). The media protocol serves any
// local path under http://launcher/media?path=..., so the preview renders
// straight from disk without copying anything.
const pendingPath = ref('')
const pendingName = ref('')
const applying = ref(false)

const dirty = computed(() => !!pendingPath.value)

const previewUrl = computed(() => {
  if (pendingPath.value) return toMediaUrl(pendingPath.value)
  return customCape.capeUrl.value || ''
})

function toMediaUrl (path: string) {
  const url = new URL('http://launcher/media')
  url.searchParams.set('path', path)
  return url.toString()
}

// Fresh state each time the dialog opens.
watch(() => props.modelValue, (open) => {
  if (open) {
    pendingPath.value = ''
    pendingName.value = ''
  }
})

async function pick () {
  const { showOpenDialog } = windowController
  const { filePaths } = await showOpenDialog({
    title: t('userCape.customImportTitle'),
    filters: [{ extensions: ['png'], name: 'PNG Images' }],
  })
  if (!filePaths?.[0]) return
  pendingPath.value = filePaths[0]
  pendingName.value = filePaths[0].split(/[\\/]/).pop() || ''
}

async function apply () {
  if (!pendingPath.value) return
  applying.value = true
  try {
    await customCape.setCape(pendingPath.value)
    notify({ level: 'success', title: t('userCape.customApplied') })
    close()
  } catch (e) {
    notify({ level: 'error', title: t('userCape.customFailed'), body: toLocaleError(e) })
  } finally {
    applying.value = false
  }
}

async function remove () {
  try {
    await customCape.removeCape()
    close()
  } catch (e) {
    notify({ level: 'error', title: t('userCape.customFailed'), body: toLocaleError(e) })
  }
}

function close () {
  pendingPath.value = ''
  pendingName.value = ''
  emit('update:modelValue', false)
}
</script>

<style scoped>
/* Cape textures are 2:1 — show the full texture at a small size. */
.cape-preview {
  width: 64px;
  height: 32px;
}

.prism-flat-btn {
  border-radius: 2px !important;
  text-transform: none;
}

.prism-flat-btn :deep(.v-btn__overlay) {
  opacity: 0;
}
</style>
