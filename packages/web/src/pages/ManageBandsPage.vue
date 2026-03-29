<template>
  <q-page padding>
    <div style="max-width: 1100px; margin: 0 auto">
      <div class="row items-center q-gutter-sm q-mb-lg">
        <q-icon name="groups" size="30px" color="primary" />
        <div class="text-h5 text-weight-bold">Manage Bands</div>
      </div>

      <q-card flat bordered class="q-mb-lg">
        <q-card-section class="row items-center justify-between">
          <div class="text-subtitle1 text-weight-bold">All Bands</div>
          <q-btn
            color="primary"
            icon="add"
            label="Create Band"
            :disable="!canCreateBand"
            :title="canCreateBand ? 'Create a new band' : 'Free plan supports only one created band'"
            @click="showCreateModal = true"
          />
        </q-card-section>

        <q-list separator>
          <q-item v-for="band in authStore.bands" :key="band.id">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ band.name }}</q-item-label>
              <q-item-label caption>Slug: {{ band.slug }} | Role: {{ band.role }} | Pro access: {{ band.hasProPlan ? 'yes' : 'no' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-badge outline color="secondary" :label="formatPlanLabel(band.plan)" />
                <q-btn flat dense icon="check_circle" label="Select" @click="switchBand(band.id)" />
                <q-btn
                  v-if="canManageBand(band.role)"
                  flat
                  dense
                  icon="qr_code_2"
                  label="Invites"
                  @click="openInviteManager(band)"
                />
                <q-btn
                  v-if="canManageBand(band.role)"
                  flat
                  dense
                  icon="settings"
                  label="Settings"
                  @click="openSettings(band.id)"
                />
                <q-btn
                  v-if="canManageBand(band.role)"
                  flat
                  dense
                  icon="edit"
                  label="Edit"
                  @click="openEdit(band)"
                />
                <q-btn
                  v-if="canDeleteBand(band.role)"
                  flat
                  dense
                  color="negative"
                  icon="delete"
                  label="Delete"
                  @click="deleteBand(band.id)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>

    <q-dialog v-model="showCreateModal">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Create Band</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="createForm.name" label="Band name" outlined dense />
          <div class="text-caption text-grey-7">URL slug is generated automatically.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Create" :loading="saving" @click="createBand" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showEditModal">
      <q-card style="min-width: 420px" v-if="editForm">
        <q-card-section class="row items-center">
          <div class="text-h6">Edit Band</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editForm.name" label="Band name" outlined dense />
          <q-banner class="bg-widget-surface rounded-borders">
            URL slug is system-generated and cannot be changed.
          </q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" :loading="saving" @click="saveBand" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showInvitesModal">
      <q-card style="min-width: 760px; max-width: 95vw">
        <q-card-section class="row items-center justify-between">
          <div>
            <div class="text-h6">Invitation Codes</div>
            <div class="text-caption text-grey-7">Band: {{ inviteBand?.name ?? '-' }} | Unused codes expire after 30 days.</div>
          </div>
          <div class="row q-gutter-xs">
            <q-btn flat icon="refresh" label="Refresh" :disable="!inviteBand" @click="refreshInviteCodes" />
            <q-btn color="primary" icon="add" label="Create Code" :loading="creatingInvite" :disable="!inviteBand" @click="createInviteCode" />
            <q-btn flat round dense icon="close" v-close-popup />
          </div>
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item v-for="code in inviteCodes" :key="code.id">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ code.code }}</q-item-label>
              <q-item-label caption>
                Created: {{ formatDateTime(code.createdAt) }}
                | Expires: {{ formatDateTime(code.expiresAt) }}
                <span v-if="code.usedAt"> | Used: {{ formatDateTime(code.usedAt) }}</span>
                <span v-if="code.invalidatedAt"> | Invalidated: {{ formatDateTime(code.invalidatedAt) }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-badge v-if="code.usedAt" color="positive" label="Used" />
                <q-badge v-else-if="code.invalidatedAt" color="negative" label="Invalidated" />
                <q-badge v-else-if="code.expired" color="warning" text-color="dark" label="Expired" />
                <q-badge v-else color="info" label="Active" />
                <q-btn flat dense icon="qr_code_2" label="QR" @click="openQr(code.code)" />
                <q-btn flat dense icon="content_copy" label="Copy" @click="copyInviteCode(code.code)" />
                <q-btn
                  flat
                  dense
                  color="negative"
                  icon="block"
                  label="Invalidate"
                  :disable="!inviteBand || !!code.usedAt || !!code.invalidatedAt || !!code.expired"
                  @click="invalidateInviteCode(code.id)"
                />
              </div>
            </q-item-section>
          </q-item>
          <q-item v-if="inviteCodes.length === 0">
            <q-item-section>
              <q-item-label caption>No invitation codes yet.</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showQrDialog">
      <q-card style="min-width: 340px">
        <q-card-section class="row items-center">
          <div class="text-h6">Invitation QR Code</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="text-center">
          <img v-if="qrImageUrl" :src="qrImageUrl" alt="Invitation QR" class="qr-img" />
          <div class="text-body2 q-mt-sm">{{ selectedInviteCode }}</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { copyToClipboard, useQuasar } from 'quasar'
import { apiJson } from '../boot/api'
import { useAuthStore, type BandMembership } from '../stores/auth'
import { useBandStore } from '../stores/band'

type InviteCode = {
  id: number
  code: string
  createdBy: string
  usedBy: string | null
  invalidatedBy: string | null
  createdAt: string
  usedAt: string | null
  invalidatedAt: string | null
  expiresAt: string
  expired: boolean
}

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const bandStore = useBandStore()

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showInvitesModal = ref(false)
const showQrDialog = ref(false)
const saving = ref(false)
const creatingInvite = ref(false)

const createForm = ref({ name: '' })
const editForm = ref<{ id: number; name: string; slug: string } | null>(null)
const inviteBand = ref<BandMembership | null>(null)
const inviteCodes = ref<InviteCode[]>([])
const selectedInviteCode = ref('')
const qrImageUrl = ref('')

const canCreateBand = computed(() => {
  const ownedBands = authStore.bands.filter((band) => band.role === 'owner')
  if (ownedBands.length === 0) return true
  return ownedBands.some((band) => band.hasProPlan)
})

function canManageBand(role: string) {
  return role === 'owner' || role === 'admin'
}

function canDeleteBand(role: string) {
  return role === 'owner'
}

function bandHeaders(bandId: number) {
  return { 'X-Band-Id': String(bandId) }
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

async function refreshBands() {
  await authStore.loadBands()
}

function formatPlanLabel(plan: string | null | undefined) {
  const normalized = (plan ?? 'free').toUpperCase()
  return `${normalized} plan`
}

function switchBand(bandId: number) {
  authStore.setActiveBand(bandId)
  void bandStore.fetchMembers()
  $q.notify({ message: 'Active band switched', color: 'positive' })
}

function openSettings(bandId: number) {
  switchBand(bandId)
  void router.push('/admin')
}

function openEdit(band: BandMembership) {
  editForm.value = { id: band.id, name: band.name, slug: band.slug }
  showEditModal.value = true
}

async function createBand() {
  if (!createForm.value.name.trim()) {
    $q.notify({ message: 'Band name is required', color: 'negative' })
    return
  }
  saving.value = true
  try {
    const band = await apiJson<{ id: number }>('/bands', {
      method: 'POST',
      body: JSON.stringify({ name: createForm.value.name.trim() }),
    })
    await refreshBands()
    authStore.setActiveBand(band.id)
    createForm.value = { name: '' }
    showCreateModal.value = false
    $q.notify({ message: 'Band created', color: 'positive' })
  } catch (e: unknown) {
    $q.notify({ message: e instanceof Error ? e.message : 'Failed to create band', color: 'negative' })
  } finally {
    saving.value = false
  }
}

async function saveBand() {
  if (!editForm.value) return
  saving.value = true
  try {
    await apiJson(`/bands/${editForm.value.id}`, {
      method: 'PATCH',
      headers: bandHeaders(editForm.value.id),
      body: JSON.stringify({ name: editForm.value.name }),
    })
    await refreshBands()
    showEditModal.value = false
    $q.notify({ message: 'Band updated', color: 'positive' })
  } catch (e: unknown) {
    $q.notify({ message: e instanceof Error ? e.message : 'Failed to update band', color: 'negative' })
  } finally {
    saving.value = false
  }
}

function deleteBand(bandId: number) {
  $q.dialog({ title: 'Delete Band', message: 'Delete this band permanently?', cancel: true }).onOk(async () => {
    saving.value = true
    try {
      await apiJson(`/bands/${bandId}`, { method: 'DELETE', headers: bandHeaders(bandId) })
      await refreshBands()
      $q.notify({ message: 'Band deleted', color: 'positive' })
    } catch (e: unknown) {
      $q.notify({ message: e instanceof Error ? e.message : 'Failed to delete band', color: 'negative' })
    } finally {
      saving.value = false
    }
  })
}

async function openInviteManager(band: BandMembership) {
  inviteBand.value = band
  showInvitesModal.value = true
  await refreshInviteCodes()
}

async function refreshInviteCodes() {
  if (!inviteBand.value) return
  try {
    const codes = await apiJson<InviteCode[]>(`/bands/${inviteBand.value.id}/invite-codes`, {
      headers: bandHeaders(inviteBand.value.id),
    })
    inviteCodes.value = codes.filter((code) => !code.invalidatedAt)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to load invitation codes',
    })
  }
}

async function createInviteCode() {
  if (!inviteBand.value) return
  creatingInvite.value = true
  try {
    const created = await apiJson<InviteCode>(`/bands/${inviteBand.value.id}/invite-codes`, {
      method: 'POST',
      headers: bandHeaders(inviteBand.value.id),
    })
    inviteCodes.value = [created, ...inviteCodes.value]
    $q.notify({ type: 'positive', message: `Invitation code created: ${created.code}` })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to create invitation code',
    })
  } finally {
    creatingInvite.value = false
  }
}

function openQr(code: string) {
  selectedInviteCode.value = code
  qrImageUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(code)}`
  showQrDialog.value = true
}

async function copyInviteCode(code: string) {
  try {
    await copyToClipboard(code)
    $q.notify({ type: 'positive', message: 'Invitation code copied' })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to copy invitation code' })
  }
}
function invalidateInviteCode(inviteId: number) {
  if (!inviteBand.value) return
  $q.dialog({
    title: 'Invalidate Invitation',
    message: 'Invalidate this invitation code?',
    cancel: true,
  }).onOk(async () => {
    if (!inviteBand.value) return
    try {
      await apiJson<InviteCode>(
        `/bands/${inviteBand.value.id}/invite-codes/${inviteId}/invalidate`,
        {
          method: 'POST',
          headers: bandHeaders(inviteBand.value.id),
        },
      )
      const idx = inviteCodes.value.findIndex((entry) => entry.id === inviteId)
      if (idx !== -1) inviteCodes.value.splice(idx, 1)
      $q.notify({ type: 'positive', message: 'Invitation code invalidated' })
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: error instanceof Error ? error.message : 'Failed to invalidate invitation code',
      })
    }
  })
}

void refreshBands()
</script>

<style scoped>
.qr-img {
  width: 300px;
  max-width: 100%;
  height: auto;
}
</style>

