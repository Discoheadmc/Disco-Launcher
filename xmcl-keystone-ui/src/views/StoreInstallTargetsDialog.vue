<template>
  <v-dialog
    v-model="isShown"
    max-width="560px"
    :persistent="installing"
  >
    <v-card
      data-testid="store-install-targets"
      class="store-install-targets"
      @keydown.enter="onEnter"
    >
      <!-- Header: one line - content icon, name, type -->
      <div class="targets-header">
        <img
          v-if="payload?.icon"
          class="targets-header__icon"
          :src="payload.icon"
          alt=""
        >
        <div class="targets-header__text">
          <div class="text-subtitle-1 font-weight-medium">
            {{ t('storeInstall.title') }}
          </div>
          <div class="text-caption targets-header__content">
            <span class="targets-header__name">{{ payload?.title }}</span>
            <span class="targets-header__dot">·</span>
            <span>{{ contentTypeLabel }}</span>
          </div>
        </div>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          :aria-label="t('shared.cancel')"
          :disabled="installing"
          data-testid="store-install-targets-close"
          @click="onCancel"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </div>
      <v-divider />

      <template v-if="step === 'targets'">
        <!-- Loading rows -->
        <div v-if="loadingRows" class="d-flex justify-center py-8">
          <v-progress-circular indeterminate size="28" />
        </div>

        <!-- Empty state -->
        <div v-else-if="instances.length === 0" class="targets-empty">
          <v-icon size="36" class="mb-2">sports_esports</v-icon>
          <div class="text-body-2 mb-4">
            {{ t('storeInstall.empty') }}
          </div>
          <v-btn
            color="primary"
            variant="tonal"
            size="small"
            data-testid="store-install-targets-create"
            @click="onCreateInstance"
          >
            <v-icon start>add</v-icon>
            {{ t('instances.add') }}
          </v-btn>
        </div>

        <template v-else>
          <!-- Instance filter (only when the list gets long) -->
          <v-text-field
            v-if="instances.length > 6"
            v-model="filterKeyword"
            variant="solo"
            flat
            density="compact"
            rounded="lg"
            hide-details
            class="mx-4 mt-3"
            prepend-inner-icon="search"
            :placeholder="t('storeInstall.search')"
            data-testid="store-install-targets-search"
          />

          <div class="targets-list custom-scrollbar">
            <div
              v-for="row in filteredRows"
              :key="row.path"
              class="target-row"
              :class="{
                'target-row--disabled': !row.compatible,
                'target-row--selected': selectedPaths.has(row.path),
              }"
              :data-testid="`store-install-target-${row.name}`"
              @click="toggleRow(row)"
            >
              <img class="target-row__icon" :src="row.icon" alt="">
              <div class="target-row__body">
                <div class="target-row__title">
                  <span class="target-row__name">{{ row.name }}</span>
                  <span
                    v-if="row.installed"
                    class="target-badge"
                    data-testid="store-install-target-installed"
                  >{{ t('storeInstall.installed') }}</span>
                  <span
                    v-if="row.running"
                    class="target-badge target-badge--running"
                  >{{ t('storeInstall.running') }}</span>
                </div>
                <div class="target-row__meta">
                  {{ row.minecraft || '?' }}<template v-if="row.loaderLabel"> · {{ row.loaderLabel }}</template>
                </div>
                <div
                  class="target-row__status"
                  :class="{ 'target-row__status--error': !row.compatible }"
                  :data-testid="`store-install-target-status-${row.name}`"
                >
                  <template v-if="row.compatible">
                    {{ t('storeInstall.willInstall', { version: row.versionName }) }}
                  </template>
                  <template v-else-if="row.reason === 'loader-mismatch'">
                    {{ t('storeInstall.loaderMismatch') }}
                  </template>
                  <template v-else>
                    {{ t('storeInstall.noVersion') }}
                  </template>
                </div>
                <div
                  v-if="row.compatible && row.installed"
                  class="target-row__status"
                >
                  {{ t('storeInstall.installedNote') }}
                </div>
              </div>
              <span
                class="target-check"
                :class="{
                  'target-check--checked': selectedPaths.has(row.path),
                  'target-check--disabled': !row.compatible,
                }"
              >
                <v-icon v-if="selectedPaths.has(row.path)" size="14">check</v-icon>
              </span>
            </div>
          </div>

          <v-divider />
          <div
            v-if="selectedRows.some(r => r.running)"
            class="targets-warning"
          >
            <v-icon size="14">info</v-icon>
            <span>{{ t('storeInstall.runningWarning') }}</span>
          </div>
          <div class="targets-actions">
            <v-btn variant="text" :disabled="installing" data-testid="store-install-targets-cancel" @click="onCancel">
              {{ t('shared.cancel') }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :disabled="selectedRows.length === 0"
              :loading="loadingDeps"
              data-testid="store-install-targets-confirm"
              @click="onConfirmTargets"
            >
              {{ t('storeInstall.confirm', { count: selectedRows.length }) }}
            </v-btn>
          </div>
        </template>
      </template>

      <!-- Step 2: required dependencies -->
      <template v-else-if="step === 'deps'">
        <div class="deps-body custom-scrollbar">
          <div class="text-subtitle-2 mb-1">
            {{ t('storeInstall.depsTitle') }}
          </div>
          <div class="text-caption targets-header__content mb-3">
            {{ t('storeInstall.depsHint') }}
          </div>
          <div
            v-for="dep in requiredDeps"
            :key="dep.key"
            class="dep-row"
          >
            <img v-if="dep.icon" class="dep-row__icon" :src="dep.icon" alt="">
            <div class="dep-row__text">
              <div class="target-row__name">{{ dep.title }}</div>
              <div class="target-row__status">
                {{ t('storeInstall.depCount', { count: dep.count }) }}
              </div>
            </div>
          </div>
        </div>
        <v-divider />
        <div class="targets-actions">
          <v-btn variant="text" :disabled="installing" @click="step = 'targets'">
            {{ t('storeInstall.back') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="installing"
            data-testid="store-install-deps-confirm"
            @click="performInstall"
          >
            {{ t('storeInstall.confirm', { count: selectedRows.length }) }}
          </v-btn>
        </div>
      </template>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { pickCurseforgeFile, pickModrinthVersion, StoreInstallTargetsDialogKey, StoreTargetPickFailed } from '@/composables/storeInstall'
import { useDialog } from '@/composables/dialog'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kInstances } from '@/composables/instances'
import { useNotifier } from '@/composables/notifier'
import { useService } from '@/composables/service'
import { getCurseforgeDependenciesModel } from '@/composables/curseforgeDependencies'
import { getModrinthDependenciesModel } from '@/composables/modrinthDependencies'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime, getModLoaderTypesForFile } from '@/util/curseforge'
import { getInstanceIcon } from '@/util/favicon'
import { isNoModLoader } from '@/util/isNoModloader'
import { getModrinthModLoaders } from '@/util/modrinth'
import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { FileModLoaderType, FileRelationType } from '@xmcl/curseforge'
import { InstanceModsServiceKey, InstanceResourcePacksServiceKey, MarketType } from '@xmcl/runtime-api'
import type { File } from '@xmcl/curseforge'
import type { ProjectVersion } from '@xmcl/modrinth'
import type { Instance, RuntimeVersions } from '@xmcl/instance'
import type { SharedState } from '@xmcl/runtime-api'
import type { ResourceState } from '@xmcl/resource'

interface TargetRow {
  path: string
  name: string
  icon: string
  minecraft: string
  loaderLabel: string
  runtime: RuntimeVersions
  compatible: boolean
  reason?: 'no-version' | 'loader-mismatch'
  versionName?: string
  version?: ProjectVersion
  file?: File
  installed: boolean
  running: boolean
}

/** A dependency installable into a specific instance. */
interface ResolvedDepFile {
  versionId?: string
  fileId?: number
  icon?: string
}

interface RequiredDep {
  key: string
  title: string
  icon?: string
  count: number
}

const { t } = useI18n()
const { notify } = useNotifier()
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { instances, ready: instancesReady } = injection(kInstances)
const { isRunning } = injection(kInstanceLaunchCoordinator)
const modsService = useService(InstanceModsServiceKey)
const resourcePacksService = useService(InstanceResourcePacksServiceKey)
const swrvConfig = injection(kSWRVConfig)

const { isShown, parameter: payload } = useDialog(StoreInstallTargetsDialogKey)

const step = ref<'targets' | 'deps'>('targets')
const loadingRows = ref(false)
const loadingDeps = ref(false)
const installing = ref(false)
const filterKeyword = ref('')
const rows = shallowRef<TargetRow[]>([])
const selectedPaths = shallowRef(new Set<string>())
const requiredDeps = shallowRef<RequiredDep[]>([])
/** Required deps per selected instance path, resolved for the deps step. */
const depsByPath = shallowRef(new Map<string, ResolvedDepFile[]>())

/** Per-instance watch states held while the dialog is open, released on close. */
const watchedStates = new Map<string, SharedState<ResourceState>>()

const contentTypeLabel = computed(() => payload.value?.contentType === 'mod' ? t('storeInstall.typeMod') : t('storeInstall.typeResourcepack'))
const selectedRows = computed(() => rows.value.filter(r => selectedPaths.value.has(r.path)))
const filteredRows = computed(() => {
  const kw = filterKeyword.value.trim().toLocaleLowerCase()
  if (!kw) return rows.value
  return rows.value.filter(r => r.name.toLocaleLowerCase().includes(kw))
})

function loaderLabelOf(runtime: RuntimeVersions) {
  if (runtime.forge) return `Forge ${runtime.forge}`
  if (runtime.fabricLoader) return `Fabric ${runtime.fabricLoader}`
  if (runtime.quiltLoader) return `Quilt ${runtime.quiltLoader}`
  if (runtime.neoForged) return `NeoForge ${runtime.neoForged}`
  if (runtime.labyMod) return `LabyMod ${runtime.labyMod}`
  return ''
}

function domainService(contentType: 'mod' | 'resourcepack') {
  return contentType === 'mod' ? modsService : resourcePacksService
}

/**
 * The instance state arrives over IPC and is `undefined` right after a window
 * reload. Wait (bounded) for the state itself — not for a non-empty list, so
 * a user with zero instances still gets the empty state immediately.
 */
async function waitForInstances(timeout = 15000): Promise<Instance[]> {
  const deadline = Date.now() + timeout
  while (!instancesReady.value && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  return instances.value
}

/** Per-load sequence so late timers from a previous open cannot patch new rows. */
let loadSeq = 0

async function load() {
  const p = payload.value
  if (!p) return
  const seq = ++loadSeq
  loadingRows.value = true
  rows.value = []
  selectedPaths.value = new Set()
  try {
    // The shared instance state arrives over IPC; right after a window
    // reload it can still be empty. Without this wait the dialog would show
    // an empty list forever, because rows only resolve on open.
    const insts = await waitForInstances()

    // One metadata fetch for the whole dialog:
    // - Modrinth: every version of the project, filtered locally per instance.
    // - CurseForge: files per unique Minecraft version, loader filtered locally.
    let modrinthVersions: ProjectVersion[] = []
    const curseforgeFilesByMc = new Map<string, File[]>()
    if (p.market === 'modrinth') {
      modrinthVersions = await clientModrinthV2.getProjectVersions(p.projectId)
    } else {
      const modId = Number(p.projectId)
      const mcs = Array.from(new Set(insts.map(i => i.runtime.minecraft).filter(Boolean)))
      await Promise.all(mcs.map(async (mc) => {
        try {
          const { data } = await clientCurseforgeV1.getModFiles({ modId, gameVersion: mc })
          curseforgeFilesByMc.set(mc, data)
        } catch {
          curseforgeFilesByMc.set(mc, [])
        }
      }))
    }

    await loadWatchedStates(p, insts)

    const result: TargetRow[] = insts.map((inst) => {
      const minecraft = inst.runtime.minecraft || ''
      const loaderLabel = loaderLabelOf(inst.runtime)
      let compatible = false
      let reason: 'no-version' | 'loader-mismatch' | undefined
      let versionName: string | undefined
      let version: ProjectVersion | undefined
      let file: File | undefined
      if (p.market === 'modrinth') {
        const pick = pickModrinthVersion(modrinthVersions, minecraft, getModrinthModLoaders(inst.runtime, false), p.contentType)
        if (pick.status === 'ok') {
          compatible = true
          version = pick.target
          versionName = pick.target.name
        } else {
          reason = pick.status
        }
      } else {
        const loaderType = isNoModLoader(inst.runtime) ? undefined : getCurseforgeModLoaderTypeFromRuntime(inst.runtime)
        const pick = pickCurseforgeFile(curseforgeFilesByMc.get(minecraft) || [], loaderType, p.contentType, getModLoaderTypesForFile)
        if (pick.status === 'ok') {
          compatible = true
          file = pick.target
          versionName = pick.target.displayName || pick.target.fileName
        } else {
          reason = pick.status
        }
      }
      const row: TargetRow = {
        path: inst.path,
        name: inst.name,
        icon: getInstanceIcon(inst, undefined),
        minecraft,
        loaderLabel,
        runtime: inst.runtime,
        compatible,
        reason,
        versionName,
        version,
        file,
        installed: isProjectInstalled(p, inst.path),
        running: isRunning(inst.path),
      }
      return row
    })

    rows.value = result

    // Exactly one compatible target: preselect it, but still ask.
    const compatible = result.filter(r => r.compatible)
    if (compatible.length === 1) {
      selectedPaths.value = new Set([compatible[0].path])
    }

    // Market metadata for files installed seconds ago resolves in the
    // background; the "installed" flags above can lag behind. Re-read the
    // watched states once, shortly after the dialog opens, so the badge
    // shows up without the user having to reopen the dialog.
    setTimeout(() => {
      if (seq !== loadSeq || !isShown.value || loadingRows.value) return
      if (!rows.value.some(r => r.compatible && !r.installed)) return
      rows.value = rows.value.map(r => ({ ...r, installed: isProjectInstalled(p, r.path) }))
    }, 6000)
  } finally {
    loadingRows.value = false
  }
}

/** Hold every instance's resource watch state so installed checks are local. */
async function loadWatchedStates(p: NonNullable<typeof payload.value>, insts: Instance[]) {
  const service = domainService(p.contentType)
  await Promise.all(insts.map(async (inst) => {
    try {
      const state = await service.watch(inst.path)
      watchedStates.set(inst.path, state)
    } catch {
      // Unwatchable instance: treat as nothing installed.
    }
  }))
}

/** Whether THIS project is already installed on the instance. */
function isProjectInstalled(p: NonNullable<typeof payload.value>, instancePath: string) {
  return isProjectIdInstalled(p.market, p.projectId, instancePath)
}

/** Whether a project id (same market) is installed on the instance. */
function isProjectIdInstalled(market: 'modrinth' | 'curseforge', projectId: string, instancePath: string) {
  const state = watchedStates.get(instancePath)
  if (!state) return false
  const id = market === 'curseforge' ? Number(projectId) : projectId
  return state.files.some((f) => {
    const meta = f.metadata
    return market === 'modrinth'
      ? meta?.modrinth?.projectId === id
      : meta?.curseforge?.projectId === id
  })
}

function toggleRow(row: TargetRow) {
  if (!row.compatible || installing.value) return
  const next = new Set(selectedPaths.value)
  if (next.has(row.path)) {
    next.delete(row.path)
  } else {
    next.add(row.path)
  }
  selectedPaths.value = next
}

async function onConfirmTargets() {
  if (selectedRows.value.length === 0) return
  loadingDeps.value = true
  try {
    await resolveDependencies()
    // Required dependencies exist for at least one target: confirm them first.
    if (requiredDeps.value.length > 0) {
      step.value = 'deps'
    } else {
      await performInstall()
    }
  } catch (e) {
    notify({ level: 'error', title: t('storeInstall.depsFailed'), body: (e as Error).message })
  } finally {
    loadingDeps.value = false
  }
}

/**
 * Resolve the required dependencies of the selected targets, per instance,
 * through the same dependency models the market detail pages use. A
 * dependency already installed on an instance is skipped for that instance.
 */
async function resolveDependencies() {
  const p = payload.value
  if (!p) return
  const perPath = new Map<string, ResolvedDepFile[]>()
  const display = new Map<string, RequiredDep>()

  await Promise.all(selectedRows.value.map(async (row) => {
    const list: ResolvedDepFile[] = []
    if (p.market === 'modrinth' && row.version) {
      // The config must be passed explicitly: the model's default parameter
      // calls injection() when it evaluates, which is illegal outside setup.
      const deps = await getSWRV(getModrinthDependenciesModel(ref(row.version), loaderNameOf(row), swrvConfig), swrvConfig)
      for (const dep of deps) {
        if (dep.type !== 'required') continue
        const versionId = dep.recommendedVersion.id
        if (!versionId) continue
        if (isProjectIdInstalled('modrinth', dep.project.id, row.path)) continue
        list.push({ versionId, icon: dep.project.icon_url })
        const key = `modrinth:${dep.project.id}`
        const entry = display.get(key)
        if (entry) {
          entry.count += 1
        } else {
          display.set(key, { key, title: dep.project.title, icon: dep.project.icon_url, count: 1 })
        }
      }
    } else if (p.market === 'curseforge' && row.file) {
      const loaderType: FileModLoaderType = p.contentType === 'mod'
        ? getCurseforgeModLoaderTypeFromRuntime(row.runtime)
        : FileModLoaderType.Any
      const deps = await getSWRV(getCurseforgeDependenciesModel(
        ref(row.file),
        ref(row.minecraft || undefined),
        ref(loaderType),
        swrvConfig,
      ), swrvConfig)
      for (const dep of deps) {
        if (dep.type !== FileRelationType.RequiredDependency) continue
        if (isProjectIdInstalled('curseforge', String(dep.project.id), row.path)) continue
        list.push({ fileId: dep.file.id, icon: dep.project.logo?.url })
        const key = `curseforge:${dep.project.id}`
        const entry = display.get(key)
        if (entry) {
          entry.count += 1
        } else {
          display.set(key, { key, title: dep.project.name, icon: dep.project.logo?.url, count: 1 })
        }
      }
    }
    perPath.set(row.path, list)
  }))

  depsByPath.value = perPath
  requiredDeps.value = Array.from(display.values())
}

function loaderNameOf(row: TargetRow) {
  const first = row.loaderLabel.split(' ')[0]
  return first ? first.toLocaleLowerCase() : undefined
}

async function performInstall() {
  const p = payload.value
  if (!p || installing.value) return
  installing.value = true
  const service = domainService(p.contentType)
  const targets = selectedRows.value

  const results = await Promise.allSettled(targets.map(async (row) => {
    // The project itself.
    if (p.market === 'modrinth' && row.version) {
      await service.installFromMarket({ market: MarketType.Modrinth, version: { versionId: row.version.id, icon: p.icon }, instancePath: row.path })
    } else if (p.market === 'curseforge' && row.file) {
      await service.installFromMarket({ market: MarketType.CurseForge, file: { fileId: row.file.id, icon: p.icon }, instancePath: row.path })
    }
    // Its required dependencies for this instance.
    for (const dep of depsByPath.value.get(row.path) || []) {
      if (p.market === 'modrinth' && dep.versionId) {
        await service.installFromMarket({ market: MarketType.Modrinth, version: { versionId: dep.versionId, icon: dep.icon }, instancePath: row.path })
      } else if (p.market === 'curseforge' && dep.fileId) {
        await service.installFromMarket({ market: MarketType.CurseForge, file: { fileId: dep.fileId, icon: dep.icon }, instancePath: row.path })
      }
    }
  }))

  const succeeded = results.filter(r => r.status === 'fulfilled').map((_, i) => targets[i].name)
  const failed = results
    .map((r, i) => ({ r, name: targets[i].name }))
    .filter(({ r }) => r.status === 'rejected')
    .map(({ r, name }) => ({ name, error: (r as PromiseRejectedResult).reason as Error }))

  installing.value = false
  isShown.value = false

  if (succeeded.length > 0) {
    notify({
      level: 'success',
      icon: p.contentType === 'mod' ? 'extension' : 'texture',
      title: t('storeInstall.done', { project: p.title }),
      body: succeeded.join(', '),
    })
  }
  for (const f of failed) {
    notify({
      level: 'error',
      title: t('storeInstall.failed', { instance: f.name }),
      body: f.error.message,
    })
  }
}

function onCancel() {
  if (installing.value) return
  isShown.value = false
}

function onCreateInstance() {
  isShown.value = false
  showAddInstance()
}

function onEnter() {
  const el = document.activeElement as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON')) return
  if (installing.value || loadingRows.value || loadingDeps.value) return
  if (step.value === 'targets') {
    if (selectedRows.value.length > 0) {
      onConfirmTargets()
    }
  } else {
    performInstall()
  }
}

// Registered last on purpose: the immediate callback runs synchronously
// during setup, and when the dialog mounts already open it calls load(),
// which needs every declaration above (loadSeq especially) to be
// initialized. Registering the watcher before those declarations leaves
// loadSeq in its temporal dead zone and load() throws a ReferenceError.
watch(isShown, (shown) => {
  if (shown) {
    load()
  } else {
    for (const state of watchedStates.values()) state.unref()
    watchedStates.clear()
    step.value = 'targets'
    filterKeyword.value = ''
    selectedPaths.value = new Set()
    requiredDeps.value = []
    depsByPath.value = new Map()
  }
}, { immediate: true })
</script>

<style scoped>
.store-install-targets {
  border-radius: var(--surface-dialog-radius, 6px);
}

.targets-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 10px;
}

.targets-header__icon {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.targets-header__text {
  min-width: 0;
}

.targets-header__content {
  color: rgba(var(--v-theme-on-surface), 0.65);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.targets-header__name {
  color: rgba(var(--v-theme-on-surface), 0.9);
  font-weight: 500;
}

.targets-header__dot {
  margin: 0 4px;
}

.targets-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
  text-align: center;
}

.targets-list {
  max-height: 380px;
  overflow-y: auto;
  padding: 8px;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: var(--card-item-radius, 3px);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.target-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.target-row--selected {
  background: rgba(var(--v-theme-primary), 0.08);
}

.target-row--disabled,
.target-row--disabled:hover {
  cursor: default;
  opacity: 0.5;
  background: transparent;
}

.target-row__icon {
  width: 32px;
  height: 32px;
  border-radius: 3px;
  image-rendering: pixelated;
  object-fit: cover;
  flex-shrink: 0;
}

.target-row__body {
  flex: 1 1 auto;
  min-width: 0;
}

.target-row__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.target-row__name {
  font-size: 0.9rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-row__meta {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.75rem;
}

.target-row__status {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.75rem;
}

.target-row__status--error {
  color: rgba(var(--v-theme-error, 255, 82, 82), 0.9);
}

.target-badge {
  padding: 1px 6px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 2px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.target-badge--running {
  border-color: rgba(var(--v-theme-warning), 0.5);
  color: rgba(var(--v-theme-warning), 0.9);
}

/* Square checkbox, matching the flat prism boxes elsewhere in the market. */
.target-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.35);
  border-radius: 2px;
  color: #fff;
  flex-shrink: 0;
}

.target-check--checked {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}

.target-check--disabled {
  opacity: 0.4;
}

.targets-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  color: rgba(var(--v-theme-warning), 0.9);
  font-size: 0.75rem;
}

.targets-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
}

.deps-body {
  max-height: 380px;
  overflow-y: auto;
  padding: 14px 16px;
}

.dep-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
}

.dep-row__icon {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  object-fit: cover;
}

.dep-row__text {
  min-width: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
}

.theme--dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
