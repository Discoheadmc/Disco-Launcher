// Disco (memory): routes are lazy by design. Only the lobby (the screen the
// app boots into) and the Store shell stay eager - everything else is fetched
// on first navigation, so an idle launcher never pays for the code of screens
// the user never opens. Eager imports would keep ~20 view modules in the
// initial bundle and in the renderer heap for the whole session.
import HomeLayout from '@/views/HomeLayout.vue'
import Home from '@/views/Home.vue'
import HomeActions from '@/views/HomeActions.vue'
import HomeExtension from '@/views/HomeExtension.vue'
import Store from '@/views/Store.vue'
import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: HomeLayout,
      children: [
        {
          path: '',
          components: {
            default: Home,
            extensions: HomeExtension,
            actions: HomeActions,
          },
        },
        {
          path: 'save',
          components: {
            default: () => import('@/views/Save.vue'),
            extensions: () => import('@/views/SaveExtension.vue'),
            actions: () => import('@/views/SaveActions.vue'),
          },
        },
        {
          path: 'mods',
          components: {
            default: () => import('@/views/Mod.vue'),
            extensions: () => import('@/views/ModExtension.vue'),
            actions: () => import('@/views/ModActions.vue'),
          },
        },
        {
          path: 'resourcepacks',
          components: {
            default: () => import('@/views/ResourcePack.vue'),
            extensions: () => import('@/views/ResourcePackExtension.vue'),
            actions: () => import('@/views/ResourcePackActions.vue'),
          },
        },
        {
          path: 'shaderpacks',
          components: {
            default: () => import('@/views/ShaderPack.vue'),
            extensions: () => import('@/views/ShaderPackExtension.vue'),
            actions: () => import('@/views/ShaderPackActions.vue'),
          },
        },
        {
          path: 'blueprints',
          meta: { blueprintState: true },
          components: {
            default: () => import('@/views/Blueprint.vue'),
            extensions: () => import('@/views/BlueprintExtension.vue'),
            actions: () => import('@/views/BlueprintActions.vue'),
          },
        },
        {
          path: 'base-setting',
          components: {
            default: () => import('@/views/BaseSetting.vue'),
            extensions: () => import('@/views/BaseSettingExtension.vue'),
            actions: () => import('@/views/BaseSettingActions.vue'),
          },
        },
        {
          path: 'base-setting/modrinth-project',
          redirect: { path: '/base-setting', query: { target: 'modrinth-project' } },
        },
      ],
    },
    {
      path: '/store',
      component: Store,
      children: [
        {
          path: '',
          component: () => import('@/views/StoreEntry.vue'),
        },
        {
          path: 'modrinth/:id',
          component: () => import('@/views/StoreProjectModrinth.vue'),
          props: (route) => ({ id: route.params.id }),
        },
        {
          path: 'curseforge/:id',
          component: () => import('@/views/StoreProjectCurseforge.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'ftb/:id',
          component: () => import('@/views/StoreProjectFeedTheBeast.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
      ],
    },
    {
      path: '/setting',
      component: () => import('@/views/Setting.vue'),
    },
    {
      path: '/me',
      component: () => import('@/views/Me.vue'),
      meta: { workspaceSidePanel: true },
    },
  ],
})

