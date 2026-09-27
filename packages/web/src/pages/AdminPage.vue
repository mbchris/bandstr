<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useQuasar, type QTableColumn } from 'quasar'
import { Capacitor } from '@capacitor/core'
import { useBandStore } from '../stores/band'
import { useAuthStore } from '../stores/auth'
import { apiJson, api } from '../boot/api'
import { useI18n } from '../composables/useI18n'

const $q = useQuasar()
const bandStore = useBandStore()
const authStore = useAuthStore()
const { t } = useI18n()

const columns = computed<QTableColumn[]>(() => [
  { name: 'name', label: t('admin.name'), field: 'name', align: 'left' },
  { name: 'email', label: t('admin.emailWhitelist'), field: 'email', align: 'left' },
  { name: 'role', label: t('admin.role'), field: 'role', align: 'left' },
  { name: 'isHidden', label: t('admin.isHidden'), field: 'isHidden', align: 'center' },
  { name: 'beerCount', label: t('admin.beerCount'), field: 'beerCount', align: 'center' },
  { name: 'actions', label: '', field: 'actions', align: 'right' },
])

const visibleColumns = computed(() => (
  $q.screen.lt.md ? ['name', 'role', 'actions'] : ['name', 'email', 'role', 'isHidden', 'beerCount', 'actions']
))
const sysStatus = ref<any>(null)
const isSubmitting = ref(false)
const isImporting = ref(false)
const isCalendarImporting = ref(false)
const removingId = ref<string | null>(null)
const importInputRef = ref<HTMLInputElement | null>(null)
const calendarImportRef = ref<HTMLInputElement | null>(null)
const logoDarkInputRef = ref<HTMLInputElement | null>(null)
const logoBrightInputRef = ref<HTMLInputElement | null>(null)
const logoDarkProcessing = ref(false)
const logoBrightProcessing = ref(false)
const logoDarkUploading = ref(false)
const logoBrightUploading = ref(false)
const pendingLogoDarkDataUrl = ref<string | null>(null)
const pendingLogoBrightDataUrl = ref<string | null>(null)

type LogoVariant = 'dark' | 'bright'

const logoDarkPreviewSrc = computed(() => pendingLogoDarkDataUrl.value ?? authStore.activeBand?.logoDark ?? authStore.activeBand?.logo ?? null)
const logoBrightPreviewSrc = computed(() => pendingLogoBrightDataUrl.value ?? authStore.activeBand?.logoBright ?? authStore.activeBand?.logo ?? null)
const MAX_LOGO_BYTES = 150 * 1024

// Add member
const showAddModal = ref(false)
const newMember = ref({ name: '', email: '', role: 'member', isHidden: false, beerCount: 0 })

async function addMember() {
  isSubmitting.value = true
  try {
    await apiJson('/users', { method: 'POST', body: JSON.stringify(newMember.value) })
    showAddModal.value = false
    newMember.value = { name: '', email: '', role: 'member', isHidden: false, beerCount: 0 }
    await bandStore.fetchMembers()
  } catch (e: any) { $q.notify({ message: e.message || t('admin.failedAdd'), color: 'negative' }) }
  finally { isSubmitting.value = false }
}

// Edit member
const showEditModal = ref(false)
const editingMember = ref<any>(null)

function openEdit(member: any) {
  editingMember.value = { ...member }
  showEditModal.value = true
}

async function updateMember() {
  if (!editingMember.value) return
  isSubmitting.value = true
  try {
    await bandStore.updateMember(editingMember.value.id, {
      name: editingMember.value.name,
      role: editingMember.value.role,
      isHidden: editingMember.value.isHidden,
    })
    showEditModal.value = false
    await bandStore.fetchMembers()
  } catch (e: any) { $q.notify({ message: e.message || t('admin.failedUpdate'), color: 'negative' }) }
  finally { isSubmitting.value = false }
}

async function removeMember(id: string) {
  $q.dialog({ title: t('admin.removeMember'), message: t('admin.removeConfirm'), cancel: true }).onOk(async () => {
    removingId.value = id
    try {
      await apiJson(`/users/${id}`, { method: 'DELETE' })
      await bandStore.fetchMembers()
    } catch (e: any) { $q.notify({ message: e.message || t('admin.failedRemove'), color: 'negative' }) }
    finally { removingId.value = null }
  })
}

// System status
async function fetchStatus() {
  try { sysStatus.value = await apiJson<any>('/admin/status') } catch {}
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read image'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to encode logo image'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

async function createCroppedLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Invalid image file'))
      image.src = url
    })

    const width = 830
    const height = 460
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to process image')

    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
    const drawWidth = img.naturalWidth * scale
    const drawHeight = img.naturalHeight * scale
    const offsetX = (width - drawWidth) / 2
    const offsetY = (height - drawHeight) / 2
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

    const qualities = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56]
    for (const quality of qualities) {
      const blob = await canvasToWebpBlob(canvas, quality)
      if (blob.size <= MAX_LOGO_BYTES) {
        return blobToDataUrl(blob)
      }
    }
    throw new Error('Image is too detailed to fit 150KB after cropping')
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function handleLogoSelected(event: Event, variant: LogoVariant) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    $q.notify({ message: 'Please select an image file', color: 'negative' })
    return
  }

  const isDark = variant === 'dark'
  if (isDark) {
    logoDarkProcessing.value = true
  } else {
    logoBrightProcessing.value = true
  }
  try {
    const logoDataUrl = await createCroppedLogo(file)
    if (isDark) {
      pendingLogoDarkDataUrl.value = logoDataUrl
    } else {
      pendingLogoBrightDataUrl.value = logoDataUrl
    }
  } catch (e: any) {
    $q.notify({ message: e.message || 'Failed to process logo', color: 'negative' })
  } finally {
    if (isDark) {
      logoDarkProcessing.value = false
    } else {
      logoBrightProcessing.value = false
    }
  }
}

async function uploadLogo(variant: LogoVariant) {
  const pendingLogo = variant === 'dark' ? pendingLogoDarkDataUrl.value : pendingLogoBrightDataUrl.value
  if (!pendingLogo) return
  if (variant === 'dark') {
    logoDarkUploading.value = true
  } else {
    logoBrightUploading.value = true
  }
  try {
    const result = await apiJson<{ logo: string | null, logoDark: string | null, logoBright: string | null }>('/admin/logo', {
      method: 'PUT',
      body: JSON.stringify({ variant, logoDataUrl: pendingLogo }),
    })
    authStore.setActiveBandLogos({
      logo: result.logo ?? null,
      logoDark: result.logoDark ?? null,
      logoBright: result.logoBright ?? null,
    })
    if (variant === 'dark') {
      pendingLogoDarkDataUrl.value = null
    } else {
      pendingLogoBrightDataUrl.value = null
    }
    $q.notify({ message: t('admin.logoUpdated'), color: 'positive' })
  } catch (e: any) {
    $q.notify({ message: e.message || t('admin.failedImport'), color: 'negative' })
  } finally {
    if (variant === 'dark') {
      logoDarkUploading.value = false
    } else {
      logoBrightUploading.value = false
    }
  }
}

async function removeLogo(variant: LogoVariant) {
  $q.dialog({ title: t('admin.removeLogo'), message: t('admin.removeLogoConfirm'), cancel: true }).onOk(async () => {
    if (variant === 'dark') {
      logoDarkUploading.value = true
    } else {
      logoBrightUploading.value = true
    }
    try {
      const result = await apiJson<{ logo: string | null, logoDark: string | null, logoBright: string | null }>(`/admin/logo?variant=${variant}`, { method: 'DELETE' })
      authStore.setActiveBandLogos({
        logo: result.logo ?? null,
        logoDark: result.logoDark ?? null,
        logoBright: result.logoBright ?? null,
      })
      if (variant === 'dark') {
        pendingLogoDarkDataUrl.value = null
      } else {
        pendingLogoBrightDataUrl.value = null
      }
      $q.notify({ message: t('admin.logoRemoved'), color: 'positive' })
    } catch (e: any) {
      $q.notify({ message: e.message || t('admin.failedRemove'), color: 'negative' })
    } finally {
      if (variant === 'dark') {
        logoDarkUploading.value = false
      } else {
        logoBrightUploading.value = false
      }
    }
  })
}

// DB export/import
async function downloadExport(path: string, fallbackFilename: string) {
  const isNative = Capacitor.isNativePlatform()
  // In WebViews, opening a new window must happen in the original user gesture.
  const nativeWindow = isNative ? window.open('about:blank', '_blank') : null
  if (nativeWindow && nativeWindow.document) {
    nativeWindow.document.title = fallbackFilename
    nativeWindow.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 16px;">Preparing export...</p>'
  }

  try {
    const res = await api(path, { method: 'GET' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((err as { error?: string }).error || res.statusText)
    }

    const blob = await res.blob()
    const contentDisposition = res.headers.get('content-disposition') || ''
    const match = contentDisposition.match(/filename=\"?([^"]+)\"?/)
    const filename = match?.[1] || fallbackFilename

    // Capacitor WebViews often ignore <a download>; try native share and/or pre-opened window.
    if (isNative) {
      try {
        const exportFile = new File([blob], filename, {
          type: blob.type || 'application/json',
          lastModified: Date.now(),
        })
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [exportFile] })) {
          await navigator.share({ files: [exportFile], title: filename })
          nativeWindow?.close()
          return
        }
      } catch (shareError: any) {
        // Ignore canceled shares; otherwise fall back to opening blob URL.
        if (shareError?.name === 'AbortError') {
          nativeWindow?.close()
          return
        }
      }
    }

    const url = URL.createObjectURL(blob)
    if (isNative) {
      if (nativeWindow) {
        nativeWindow.location.href = url
      } else {
        window.open(url, '_blank')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return
    }

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    nativeWindow?.close()
    $q.notify({ message: e.message || t('admin.exportFailed'), color: 'negative' })
  }
}

function exportDb() {
  downloadExport('/admin/db/export', 'bandstr-backup.v1.json')
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.json')) {
    $q.notify({ message: t('admin.invalidBackupFile'), color: 'negative' })
    ;(event.target as HTMLInputElement).value = ''
    return
  }

  $q.dialog({ title: t('admin.importBackup'), message: t('admin.importWarningConfirm'), cancel: true }).onOk(async () => {
    isImporting.value = true
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api('/admin/db/import', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const errorMessage = typeof data.error === 'string' ? data.error : t('admin.failedImport')
        throw new Error(errorMessage)
      }
      $q.notify({ message: t('admin.importSuccess'), color: 'positive' })
      await bandStore.fetchMembers()
    } catch (e: any) { $q.notify({ message: e.message || t('admin.failedImport'), color: 'negative' }) }
    finally {
      isImporting.value = false
      ;(event.target as HTMLInputElement).value = ''
    }
  })
}

// Calendar export/import
function exportCalendar() {
  downloadExport('/admin/calendar/export', 'calendar_export.json')
}

async function handleCalendarImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  isCalendarImporting.value = true
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await api('/admin/calendar/import', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Import failed')
    const data = await res.json()
    $q.notify({ message: t('admin.importJsonSuccess', { count: data.count || 0 }), color: 'positive' })
  } catch (e: any) { $q.notify({ message: e.message || t('admin.failedJsonImport'), color: 'negative' }) }
  finally {
    isCalendarImporting.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

// Event time defaults
const isSavingDefaults = ref(false)
const defaultRehearsalStartTime = ref(authStore.activeBand?.defaultRehearsalStartTime || '20:00')
const defaultRehearsalEndTime = ref(authStore.activeBand?.defaultRehearsalEndTime || '23:00')
const defaultGigStartTime = ref(authStore.activeBand?.defaultGigStartTime || '20:00')
const defaultGigEndTime = ref(authStore.activeBand?.defaultGigEndTime || '23:00')

watch(
  () => authStore.activeBand,
  (band) => {
    if (band) {
      if (band.defaultRehearsalStartTime) defaultRehearsalStartTime.value = band.defaultRehearsalStartTime
      if (band.defaultRehearsalEndTime) defaultRehearsalEndTime.value = band.defaultRehearsalEndTime
      if (band.defaultGigStartTime) defaultGigStartTime.value = band.defaultGigStartTime
      if (band.defaultGigEndTime) defaultGigEndTime.value = band.defaultGigEndTime
    }
  },
  { immediate: true, deep: true },
)

async function saveEventTimeDefaults() {
  if (!authStore.activeBandId) return
  isSavingDefaults.value = true
  try {
    const updated = await apiJson<{
      defaultRehearsalStartTime?: string
      defaultRehearsalEndTime?: string
      defaultGigStartTime?: string
      defaultGigEndTime?: string
    }>(`/bands/${authStore.activeBandId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        defaultRehearsalStartTime: defaultRehearsalStartTime.value,
        defaultRehearsalEndTime: defaultRehearsalEndTime.value,
        defaultGigStartTime: defaultGigStartTime.value,
        defaultGigEndTime: defaultGigEndTime.value,
      }),
    })
    authStore.updateActiveBandDefaults({
      defaultRehearsalStartTime: updated.defaultRehearsalStartTime ?? defaultRehearsalStartTime.value,
      defaultRehearsalEndTime: updated.defaultRehearsalEndTime ?? defaultRehearsalEndTime.value,
      defaultGigStartTime: updated.defaultGigStartTime ?? defaultGigStartTime.value,
      defaultGigEndTime: updated.defaultGigEndTime ?? defaultGigEndTime.value,
    })
    $q.notify({ message: t('admin.defaultsSaved'), color: 'positive' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : (typeof e === 'string' ? e : t('admin.failedSaveDefaults'))
    $q.notify({ message: message || t('admin.failedSaveDefaults'), color: 'negative' })
  } finally {
    isSavingDefaults.value = false
  }
}

onMounted(async () => {
  bandStore.fetchMembers()
  fetchStatus()
  const freshBand = await authStore.fetchActiveBandDetails()
  if (freshBand) {
    if (freshBand.defaultRehearsalStartTime) defaultRehearsalStartTime.value = freshBand.defaultRehearsalStartTime
    if (freshBand.defaultRehearsalEndTime) defaultRehearsalEndTime.value = freshBand.defaultRehearsalEndTime
    if (freshBand.defaultGigStartTime) defaultGigStartTime.value = freshBand.defaultGigStartTime
    if (freshBand.defaultGigEndTime) defaultGigEndTime.value = freshBand.defaultGigEndTime
  }
})
</script>

<template>
  <q-page padding>
    <div style="max-width: 1200px; margin: 0 auto">
      <div class="row items-center q-gutter-sm q-mb-lg">
        <q-icon name="settings" size="32px" color="primary" />
        <div class="text-h5 text-weight-bold">{{ t('admin.heading') }}</div>
      </div>

      <div class="row q-gutter-lg">
        <!-- Band Members Table -->
        <div class="col-12 col-lg-7">
          <q-card flat bordered>
            <q-card-section>
              <div class="row items-center justify-between">
                <div class="text-subtitle1 text-weight-bold">{{ t('admin.bandMembers') }}</div>
                <q-btn size="sm" color="primary" round dense icon="person_add" @click="showAddModal = true">
                  <q-tooltip>{{ t('admin.addMember') }}</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>
            <q-table
              class="admin-members-table"
              flat
              :rows="bandStore.members"
              :columns="columns"
              :visible-columns="visibleColumns"
              row-key="id"
              :pagination="{ rowsPerPage: 0 }"
              :dense="$q.screen.lt.md"
              hide-pagination
            >
              <template #body-cell-isHidden="props">
                <q-td :props="props">
                  <q-badge v-if="props.row.isHidden" color="grey">{{ t('admin.isHidden') }}</q-badge>
                  <span v-else>-</span>
                </q-td>
              </template>
              <template #body-cell-actions="props">
                <q-td :props="props">
                  <div class="row q-gutter-xs">
                    <q-btn flat round dense icon="edit" size="sm" @click="openEdit(props.row)" />
                    <q-btn flat round dense icon="delete" color="red" size="sm" :loading="removingId === props.row.id" @click="removeMember(props.row.id)" />
                  </div>
                </q-td>
              </template>
            </q-table>
          </q-card>

          <!-- Event Time Defaults -->
          <q-card flat bordered class="q-mt-lg">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">{{ t('admin.eventTimeDefaults') }}</div>
              <div class="text-caption text-grey">{{ t('admin.eventTimeDefaultsHint') }}</div>
            </q-card-section>
            <q-card-section class="q-gutter-md">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="defaultRehearsalStartTime"
                    type="time"
                    outlined
                    dense
                    :label="t('admin.defaultRehearsalStart')"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="defaultRehearsalEndTime"
                    type="time"
                    outlined
                    dense
                    :label="t('admin.defaultRehearsalEnd')"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="defaultGigStartTime"
                    type="time"
                    outlined
                    dense
                    :label="t('admin.defaultGigStart')"
                  />
                </div>
                <div class="col-12 col-sm-6">
                  <q-input
                    v-model="defaultGigEndTime"
                    type="time"
                    outlined
                    dense
                    :label="t('admin.defaultGigEnd')"
                  />
                </div>
              </div>
              <div class="row justify-end q-mt-md">
                <q-btn
                  color="primary"
                  icon="save"
                  :label="t('admin.saveDefaults')"
                  :loading="isSavingDefaults"
                  @click="saveEventTimeDefaults"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Sidebar -->
        <div class="col-12 col-lg">
          <!-- Band Logo -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">{{ t('admin.bandLogo') }}</div>
            </q-card-section>
            <q-card-section class="q-gutter-sm">
              <div class="text-subtitle2 text-weight-medium">{{ t('admin.darkModeLogo') }}</div>
              <div class="text-caption text-grey q-mb-xs">{{ t('admin.darkModeLogoHint') }}</div>
              <q-img
                v-if="logoDarkPreviewSrc"
                :src="logoDarkPreviewSrc"
                style="width: 100%; max-width: 420px; aspect-ratio: 830 / 460; border-radius: 10px"
                fit="contain"
              />
              <div v-else class="text-caption text-grey">{{ t('admin.noLogo') }}</div>
              <div class="row q-col-gutter-sm q-mb-md">
                <div class="col-12 col-sm-auto">
                  <q-btn color="primary" round dense icon="image" :loading="logoDarkProcessing" @click="logoDarkInputRef?.click()">
                    <q-tooltip>{{ pendingLogoDarkDataUrl ? t('admin.changeLogo') : t('admin.selectLogo') }}</q-tooltip>
                  </q-btn>
                </div>
                <div class="col-12 col-sm-auto" v-if="pendingLogoDarkDataUrl">
                  <q-btn color="positive" round dense icon="save" :loading="logoDarkUploading" @click="uploadLogo('dark')">
                    <q-tooltip>{{ t('admin.saveLogo') }}</q-tooltip>
                  </q-btn>
                </div>
                <div class="col-12 col-sm-auto" v-if="authStore.activeBand?.logoDark">
                  <q-btn color="negative" outline round dense icon="delete" :loading="logoDarkUploading" @click="removeLogo('dark')">
                    <q-tooltip>{{ t('admin.removeLogo') }}</q-tooltip>
                  </q-btn>
                </div>
              </div>

              <div class="text-subtitle2 text-weight-medium">{{ t('admin.brightModeLogo') }}</div>
              <div class="text-caption text-grey q-mb-xs">{{ t('admin.brightModeLogoHint') }}</div>
              <q-img
                v-if="logoBrightPreviewSrc"
                :src="logoBrightPreviewSrc"
                style="width: 100%; max-width: 420px; aspect-ratio: 830 / 460; border-radius: 10px"
                fit="contain"
              />
              <div v-else class="text-caption text-grey">{{ t('admin.noLogo') }}</div>
              <div class="row q-col-gutter-sm">
                <div class="col-12 col-sm-auto">
                  <q-btn color="primary" round dense icon="image" :loading="logoBrightProcessing" @click="logoBrightInputRef?.click()">
                    <q-tooltip>{{ pendingLogoBrightDataUrl ? t('admin.changeLogo') : t('admin.selectLogo') }}</q-tooltip>
                  </q-btn>
                </div>
                <div class="col-12 col-sm-auto" v-if="pendingLogoBrightDataUrl">
                  <q-btn color="positive" round dense icon="save" :loading="logoBrightUploading" @click="uploadLogo('bright')">
                    <q-tooltip>{{ t('admin.saveLogo') }}</q-tooltip>
                  </q-btn>
                </div>
                <div class="col-12 col-sm-auto" v-if="authStore.activeBand?.logoBright">
                  <q-btn color="negative" outline round dense icon="delete" :loading="logoBrightUploading" @click="removeLogo('bright')">
                    <q-tooltip>{{ t('admin.removeLogo') }}</q-tooltip>
                  </q-btn>
                </div>
              </div>

              <input ref="logoDarkInputRef" type="file" accept="image/*" class="hidden" style="display:none" @change="(e) => handleLogoSelected(e, 'dark')" />
              <input ref="logoBrightInputRef" type="file" accept="image/*" class="hidden" style="display:none" @change="(e) => handleLogoSelected(e, 'bright')" />
              <div class="text-caption text-grey">
                {{ t('admin.logoHint') }}
              </div>
            </q-card-section>
          </q-card>

          <!-- System Status -->
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">{{ t('admin.systemStatus') }}</div>
            </q-card-section>
            <q-list dense separator>
              <q-item>
                <q-item-section>{{ t('admin.database') }}</q-item-section>
                <q-item-section side><q-badge color="green">{{ t('admin.connected') }}</q-badge></q-item-section>
              </q-item>
              <q-item>
                <q-item-section>OIDC Google</q-item-section>
                <q-item-section side>
                  <q-badge :color="sysStatus?.google ? 'green' : 'grey'">{{ sysStatus?.google ? t('admin.connected') : t('admin.pending') }}</q-badge>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>OIDC GitHub</q-item-section>
                <q-item-section side>
                  <q-badge :color="sysStatus?.github ? 'green' : 'grey'">{{ sysStatus?.github ? t('admin.connected') : t('admin.pending') }}</q-badge>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>

          <!-- DB Management -->
          <q-card flat bordered class="q-mt-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">{{ t('admin.dbManagement') }}</div>
            </q-card-section>
            <q-card-section class="q-gutter-sm">
              <q-banner v-if="authStore.isFreePlan" rounded class="bg-orange-1 text-orange-9 q-mb-sm">
                <template #avatar><q-icon name="lock" color="orange" /></template>
                PRO feature — upgrade to access import/export
              </q-banner>
              <q-btn class="full-width" color="grey-8" icon="download" :disable="authStore.isFreePlan" @click="exportDb">{{ t('admin.downloadBackup') }}</q-btn>
              <q-btn class="full-width" color="orange" outline icon="upload" :loading="isImporting" :disable="authStore.isFreePlan" @click="importInputRef?.click()">{{ t('admin.importBackup') }}</q-btn>
              <input ref="importInputRef" type="file" accept=".json" class="hidden" style="display:none" @change="handleImport" />
              <div class="text-caption text-grey text-center">{{ t('admin.backupWarning') }}</div>
            </q-card-section>
          </q-card>

          <!-- Calendar Management -->
          <q-card flat bordered class="q-mt-md">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">{{ t('admin.calendarMgmt') }}</div>
            </q-card-section>
            <q-card-section class="q-gutter-sm">
              <q-btn class="full-width" color="grey-8" icon="download" :disable="authStore.isFreePlan" @click="exportCalendar">{{ t('admin.exportJson') }}</q-btn>
              <q-btn class="full-width" color="blue" outline icon="upload" :loading="isCalendarImporting" :disable="authStore.isFreePlan" @click="calendarImportRef?.click()">{{ t('admin.importJson') }}</q-btn>
              <input ref="calendarImportRef" type="file" accept=".json" class="hidden" style="display:none" @change="handleCalendarImport" />
              <div class="text-caption text-grey text-center">{{ t('admin.jsonHint') }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Add Member Dialog -->
    <q-dialog v-model="showAddModal">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('admin.addMember') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="newMember.name" :label="t('admin.name')" outlined dense autofocus />
          <q-input v-model="newMember.email" :label="t('admin.emailWhitelist')" type="email" outlined dense />
          <q-select v-model="newMember.role" :options="['member', 'admin']" :label="t('admin.role')" outlined dense />
          <q-toggle v-model="newMember.isHidden" :label="t('admin.isHidden')" />
          <q-input v-model.number="newMember.beerCount" :label="t('admin.beerCount')" type="number" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="isSubmitting" @click="addMember" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Member Dialog -->
    <q-dialog v-model="showEditModal">
      <q-card v-if="editingMember" style="min-width: 400px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('admin.editMember') }}</div>
          <q-space /><q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editingMember.name" :label="t('admin.name')" outlined dense />
          <q-input v-model="editingMember.email" :label="t('admin.emailWhitelist')" type="email" outlined dense />
          <q-select v-model="editingMember.role" :options="['member', 'admin']" :label="t('admin.role')" outlined dense />
          <q-toggle v-model="editingMember.isHidden" :label="t('admin.isHidden')" />
          <q-input v-model.number="editingMember.beerCount" :label="t('admin.beerCount')" type="number" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.save')" :loading="isSubmitting" @click="updateMember" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style lang="scss" scoped>
@media (max-width: 600px) {
  .admin-members-table :deep(table) {
    font-size: 0.8rem;
  }

  .admin-members-table :deep(.q-table th),
  .admin-members-table :deep(.q-table td) {
    padding: 6px 8px;
  }
}
</style>

