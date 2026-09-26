<template>
  <section class="about">
    <SettingCard>
      <div class="pa-4">
        <!-- Logo & Header info -->
        <div class="d-flex align-center flex-wrap gap-4 mb-6">
          <v-img
            :src="logo"
            alt="Disco Launcher Logo"
            width="64"
            height="64"
            class="mr-4 rounded-lg flex-grow-0 flex-shrink-0"
          ></v-img>
          <div>
            <div class="text-h5 font-weight-bold">Disco Launcher</div>
            <div class="text-caption opacity-70">{{ version }}</div>
          </div>
          <v-spacer />
          <div class="d-flex align-center gap-2">
            <v-icon color="primary" size="small">verified</v-icon>
            <div class="text-caption font-weight-medium">MIT</div>
          </div>
        </div>
        <div class="text-caption opacity-70 mb-6">
          NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
        </div>
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import { computed } from 'vue'
import logo from '../assets/logo.png'

const env = injection(kEnvironment)

const version = computed(() => (env.value?.version ? `v${env.value.version}` : ''))
</script>

<style scoped>
</style>
