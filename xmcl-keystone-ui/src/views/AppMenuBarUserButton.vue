<template>
  <button
    type="button"
    class="menu-user-btn non-moveable flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer"
    data-testid="menu-user-button"
    :aria-label="t('myStuff')"
    @click="goMe"
  >
    <PlayerAvatar
      class="overflow-hidden rounded-md"
      :src="gameProfile?.textures?.SKIN?.url"
      :dimension="24"
    />
  </button>
</template>

<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'

const { gameProfile } = injection(kUserContext)
const { t } = useI18n()
const router = useRouter()

function goMe() {
  router.push('/me')
}
</script>

<style scoped>
.menu-user-btn {
  border: none;
  background: transparent;
  color: inherit;
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-user-btn:hover {
  background-color: rgba(128, 128, 128, 0.18);
}
</style>
