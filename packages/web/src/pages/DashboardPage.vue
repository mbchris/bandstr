<template>
  <q-page padding>
    <div class="dashboard-wrap">
      <div class="row items-center q-col-gutter-sm q-mb-lg">
        <div class="col-12 col-md">
          <div class="text-h4 text-weight-bold">Dashboard</div>
          <div class="text-body2 text-grey-7">Manage your bands, subscription, and invitation access.</div>
          <div class="text-caption text-grey-8 q-mt-xs">Logged in as {{ userIdentity }}</div>
        </div>
        <div class="col-12 col-md-auto">
          <q-btn color="primary" round dense icon="home" @click="openActiveBandApp">
            <q-tooltip>Open Band App</q-tooltip>
          </q-btn>
        </div>
      </div>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-lg-7">
          <q-card flat bordered class="q-mb-lg">
            <q-card-section class="row items-center justify-between q-gutter-sm">
              <div>
                <div class="text-h6">Manage Bands</div>
                <div class="text-caption text-grey-7">Select your active band, then open the main app.</div>
              </div>
              <div class="row q-gutter-xs">
                <q-btn flat round dense icon="refresh" @click="refreshBands">
                  <q-tooltip>Refresh</q-tooltip>
                </q-btn>
                <q-btn
                  color="primary"
                  round
                  dense
                  icon="add"
                  :disable="!canCreateBand"
                  :title="canCreateBand ? 'Create a new band' : 'Free plan supports only one created band'"
                  @click="showCreateBandDialog = true"
                >
                  <q-tooltip>Create Band</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>
            <q-separator />
            <q-list separator>
              <q-item v-for="band in authStore.bands" :key="band.id">
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ band.name }}</q-item-label>
                  <q-item-label caption>Slug: {{ band.slug }} | Role: {{ band.role }} | Pro access: {{ band.hasProPlan ? 'yes' : 'no' }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row q-gutter-xs">
                    <q-badge outline color="secondary" :label="formatPlanLabel(band.plan)" />
                    <q-badge v-if="authStore.activeBandId === band.id" color="primary" label="Active" />
                    <q-btn flat round dense icon="check_circle" @click="selectBandOnly(band.id)">
                      <q-tooltip>Select Band</q-tooltip>
                    </q-btn>
                    <q-btn color="primary" round dense icon="launch" @click="selectBandAndOpen(band.id)">
                      <q-tooltip>Open App</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="canManageBand(band.role)"
                      flat
                      round
                      dense
                      icon="edit"
                      @click="openEdit(band)"
                    >
                      <q-tooltip>Edit Band</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="canManageBand(band.role)"
                      flat
                      round
                      dense
                      icon="qr_code_2"
                      @click="openInviteManager(band)"
                    >
                      <q-tooltip>Invite</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="canDeleteBand(band.role)"
                      flat
                      round
                      dense
                      color="negative"
                      icon="delete"
                      @click="deleteBand(band.id)"
                    >
                      <q-tooltip>Delete Band</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>

          <q-card flat bordered>
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">Join Band</div>
                <div class="text-caption text-grey-7">Use a one-time invitation code from a band owner/admin.</div>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div class="row q-col-gutter-md items-end">
                <div class="col-12 col-md">
                  <q-input
                    v-model="joinCode"
                    label="Invitation code"
                    outlined
                    dense
                    placeholder="BND-XXXXXXXXXXXXXXXXXXXXXXXX"
                    @keyup.enter="joinBand"
                  />
                </div>
                <div class="col-12 col-md-auto">
                  <q-btn color="primary" round dense icon="group_add" :loading="joining" @click="joinBand">
                    <q-tooltip>Join Band</q-tooltip>
                  </q-btn>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-lg-5">
          <q-card flat bordered class="q-mb-lg">
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">Manage Subscriptions</div>
                <div class="text-caption text-grey-7">Current plan: {{ activePlanLabel }}</div>
                <div class="text-caption text-grey-7">Status: {{ activeSubscriptionStatusLabel }}</div>
              </div>
              <q-btn color="primary" round dense icon="payments" @click="router.push('/billing')">
                <q-tooltip>Open Billing</q-tooltip>
              </q-btn>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <q-dialog v-model="showCreateBandDialog">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Create Band</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-input v-model="newBandName" label="Band name" outlined dense autofocus />
          <div class="text-caption text-grey-7 q-mt-sm">URL slug is generated automatically.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Create" :loading="creatingBand" :disable="!newBandName.trim()" @click="createBand" />
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
          <q-btn color="primary" label="Save" :loading="creatingBand" @click="saveBand" />
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
            <q-btn flat round dense icon="refresh" :disable="!inviteBand" @click="refreshInviteCodes">
              <q-tooltip>Refresh</q-tooltip>
            </q-btn>
            <q-btn color="primary" round dense icon="add" :loading="creatingInvite" :disable="!inviteBand" @click="createInviteCode">
              <q-tooltip>Create Code</q-tooltip>
            </q-btn>
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
                <q-btn flat round dense icon="qr_code_2" @click="openQr(code.code)">
                  <q-tooltip>Show QR</q-tooltip>
                </q-btn>
                <q-btn flat round dense icon="content_copy" @click="copyInviteCode(code.code)">
                  <q-tooltip>Copy code</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  color="negative"
                  icon="block"
                  :disable="!inviteBand || !!code.usedAt || !!code.invalidatedAt || !!code.expired"
                  @click="invalidateInviteCode(code.id)"
                >
                  <q-tooltip>Invalidate</q-tooltip>
                </q-btn>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify, copyToClipboard, useQuasar } from 'quasar'
import { apiJson } from '../boot/api'
import { useAuthStore, type BandMembership } from '../stores/auth'
import { useBandStore } from '../stores/band'

const router = useRouter()
const authStore = useAuthStore()
const bandStore = useBandStore()
const $q = useQuasar()

const joining = ref(false)
const creatingBand = ref(false)
const showCreateBandDialog = ref(false)
const newBandName = ref('')
const joinCode = ref('')
const showEditModal = ref(false)
const showInvitesModal = ref(false)
const showQrDialog = ref(false)
const creatingInvite = ref(false)

const editForm = ref<{ id: number; name: string; slug: string } | null>(null)
const inviteBand = ref<BandMembership | null>(null)
const inviteCodes = ref<InviteCode[]>([])
const selectedInviteCode = ref('')
const qrImageUrl = ref('')

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

const activePlanLabel = computed(() => authStore.activeBand?.plan ?? 'free')
const userIdentity = computed(() => {
  const name = authStore.user?.name?.trim() || 'Unknown user'
  const email = authStore.user?.email?.trim() || 'no-email'
  return `${name}, ${email}`
})
const activeSubscriptionStatusLabel = computed(() => {
  const status = authStore.activeBand?.subscriptionStatus ?? 'none'
  if (status === 'active') return 'Active'
  if (status === 'trialing') return 'Trialing'
  if (status === 'past_due') return 'Past due'
  if (status === 'canceled') return 'Canceled'
  return 'No active subscription'
})
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

function formatPlanLabel(plan: string | null | undefined) {
  const normalized = (plan ?? 'free').toUpperCase()
  return `${normalized} plan`
}

async function refreshBands() {
  await authStore.loadBands()
}

async function createBand() {
  const name = newBandName.value.trim()
  if (!name) {
    Notify.create({ type: 'warning', message: 'Band name is required.' })
    return
  }
  creatingBand.value = true
  try {
    const band = await apiJson<{ id: number }>('/bands', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    await refreshBands()
    authStore.setActiveBand(band.id)
    newBandName.value = ''
    showCreateBandDialog.value = false
    Notify.create({ type: 'positive', message: 'Band created' })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to create band',
    })
  } finally {
    creatingBand.value = false
  }
}

function openEdit(band: BandMembership) {
  editForm.value = { id: band.id, name: band.name, slug: band.slug }
  showEditModal.value = true
}

async function saveBand() {
  if (!editForm.value) return
  creatingBand.value = true
  try {
    await apiJson(`/bands/${editForm.value.id}`, {
      method: 'PATCH',
      headers: bandHeaders(editForm.value.id),
      body: JSON.stringify({ name: editForm.value.name }),
    })
    await refreshBands()
    showEditModal.value = false
    Notify.create({ type: 'positive', message: 'Band updated' })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to update band',
    })
  } finally {
    creatingBand.value = false
  }
}

function deleteBand(bandId: number) {
  $q.dialog({ title: 'Delete Band', message: 'Delete this band permanently?', cancel: true }).onOk(async () => {
    creatingBand.value = true
    try {
      await apiJson(`/bands/${bandId}`, { method: 'DELETE', headers: bandHeaders(bandId) })
      await refreshBands()
      Notify.create({ type: 'positive', message: 'Band deleted' })
    } catch (error) {
      Notify.create({
        type: 'negative',
        message: error instanceof Error ? error.message : 'Failed to delete band',
      })
    } finally {
      creatingBand.value = false
    }
  })
}

function selectBandOnly(bandId: number) {
  authStore.setActiveBand(bandId)
  Notify.create({ type: 'positive', message: 'Active band selected' })
}

async function selectBandAndOpen(bandId: number) {
  authStore.setActiveBand(bandId)
  await bandStore.fetchMembers()
  await router.push('/')
}

async function openActiveBandApp() {
  if (!authStore.activeBandId && authStore.bands[0]) {
    authStore.setActiveBand(authStore.bands[0].id)
  }
  if (authStore.activeBandId) {
    await bandStore.fetchMembers()
    await router.push('/')
    return
  }
  Notify.create({ type: 'warning', message: 'No band selected yet.' })
}

async function joinBand() {
  if (!joinCode.value.trim()) {
    Notify.create({ type: 'warning', message: 'Enter an invitation code first.' })
    return
  }
  joining.value = true
  try {
    const joinedBand = await apiJson<BandMembership>('/bands/join', {
      method: 'POST',
      body: JSON.stringify({ code: joinCode.value.trim() }),
    })
    await refreshBands()
    authStore.setActiveBand(joinedBand.id)
    joinCode.value = ''
    Notify.create({ type: 'positive', message: `Joined ${joinedBand.name}` })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to join band',
    })
  } finally {
    joining.value = false
  }
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
    Notify.create({
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
    Notify.create({ type: 'positive', message: `Invitation code created: ${created.code}` })
  } catch (error) {
    Notify.create({
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
    Notify.create({ type: 'positive', message: 'Invitation code copied' })
  } catch {
    Notify.create({ type: 'negative', message: 'Failed to copy invitation code' })
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
      Notify.create({ type: 'positive', message: 'Invitation code invalidated' })
    } catch (error) {
      Notify.create({
        type: 'negative',
        message: error instanceof Error ? error.message : 'Failed to invalidate invitation code',
      })
    }
  })
}

onMounted(async () => {
  await refreshBands()
})
</script>

<style scoped>
.dashboard-wrap {
  max-width: 1240px;
  margin: 0 auto;
}

.qr-img {
  width: 300px;
  max-width: 100%;
  height: auto;
}
</style>

