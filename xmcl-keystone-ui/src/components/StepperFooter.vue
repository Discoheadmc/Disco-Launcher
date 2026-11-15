<template>
  <div class="flex gap-4">
    <!-- Prism-minimal: flat corners, solid primary only on the main action.
         Disco: the cancel button carries a border and a light surface fill —
         as a bare text button it visually disappeared next to the filled
         primary actions. -->
    <v-btn
      data-testid="add-instance-cancel"
      class="stepper-cancel-btn"
      :disabled="creating"
      variant="text"
      @click="emit('quit')"
    >
      {{ t('shared.cancel') }}
    </v-btn>
    <v-spacer />
    <slot />
    <v-btn
      v-if="next"
      data-testid="add-instance-next"
      color="primary"
      variant="flat"
      :loading="creating"
      :disabled="disabled"
      @click="emit('next')"
    >
      {{ t('shared.next') }}
    </v-btn>
    <v-btn
      v-if="create"
      data-testid="add-instance-create"
      color="primary"
      variant="flat"
      :loading="creating"
      :disabled="disabled"
      @click="emit('create')"
    >
      {{ t('create') }}
    </v-btn>
  </div>
</template>
<script lang=ts setup>

defineProps<{
  disabled: boolean
  creating: boolean
  create?: boolean
  next?: boolean
}>()

const emit = defineEmits(['quit', 'next', 'create', 'back'])
const { t } = useI18n()
</script>

<style scoped>
/* Disco: outline + light surface fill so Cancel reads as a button of its
   own next to the filled primary actions. Theme tokens only. */
.stepper-cancel-btn {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.stepper-cancel-btn:hover:not(.v-btn--disabled) {
  background: rgba(var(--v-theme-on-surface), 0.14);
}

.stepper-cancel-btn.v-btn--disabled {
  opacity: 0.4;
}
</style>
