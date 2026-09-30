<template>
  <SettingItem :description="description" :title-class="titleClass" class="setting-item-switcher">
    <template #title>
      <v-icon v-if="icon" start size="small" color="primary">{{ icon }}</v-icon>
      {{ title }}
    </template>
    <template #action="{ titleId, descriptionId }">
      <v-switch
        v-model="model"
        v-bind="$attrs"
        color="primary"
        hide-details
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
      />
    </template>
  </SettingItem>
</template>
<script setup lang="ts">
import SettingItem from "./SettingItem.vue";

defineOptions({ inheritAttrs: false });

const model = defineModel<boolean>({ required: true });

defineProps<{
  title: string;
  icon?: string;
  titleClass?: string;
  description?: string;
}>();
</script>

<style scoped>
.setting-item-switcher :deep(.setting-item__action .v-switch) {
  flex: none;
}

/* Subtle hover/focus transitions on the switch (color/opacity only) */
.setting-item-switcher :deep(.v-switch__track) {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.setting-item-switcher :deep(.v-switch__thumb) {
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.setting-item-switcher:hover :deep(.v-switch__track) {
  opacity: 0.85;
}

.setting-item-switcher:hover :deep(.v-switch__thumb) {
  background: rgba(var(--v-theme-on-surface), 0.92);
}

.setting-item-switcher:focus-within :deep(.v-switch__track) {
  opacity: 0.8;
}
</style>
