<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify, copyToClipboard, useQuasar } from 'quasar'
import { apiJson } from '../boot/api'
import { useAuthStore, type BandMembership } from '../stores/auth'
import { useBandStore } from '../stores/band'
import { useNotificationsStore } from '../stores/notifications'
import { isAndroidNative } from '../plugins/playBilling'
import { useI18n } from '../composables/useI18n'
import { usePlatform } from '../composables/usePlatform'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const bandStore = useBandStore()
const notificationsStore = useNotificationsStore()
const $q = useQuasar()
const { t } = useI18n()
const { isIos, pIcon } = usePlatform()

const joining = ref(false)
const creatingBand = ref(false)
const loadingManage = ref(false)
const showCreateBandDialog = ref(false)
const newBandName = ref('')
const joinCode = ref('')
const showEditModal = ref(false)
const showInvitesModal = ref(false)
const showQrDialog = ref(false)
const creatingInvite = ref(false)
const updatingNotifications = ref(false)

const editForm = ref<{ id: number; name: string; slug: string } | null>(null)
const inviteBand = ref<BandMembership | null>(null)
const inviteCodes = ref<InviteCode[]>([])
const selectedInviteCode = ref('')
const qrImageUrl = ref('')
const APP_INVITE_BASE_URL = 'org.capacitor.bandstr://localhost/#/dashboard'

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

const activePlanLabel = computed(() =>
  formatPlanLabel(authStore.activeBand?.plan, authStore.activeBand?.hasProPlan),
)
const activeSubscriptionProvider = computed(() => authStore.activeBand?.subscriptionProvider ?? null)
const userIdentity = computed(() => {
  const name = authStore.user?.name?.trim() || t('dashboard.unknownUser')
  const email = authStore.user?.email?.trim() || t('dashboard.noEmail')
  return `${name}, ${email}`
})
const activeSubscriptionStatusLabel = computed(() => {
  const status = authStore.activeBand?.subscriptionStatus ?? 'none'
  if (status === 'active') return t('dashboard.subscriptionStatusActive')
  if (status === 'trialing') return t('dashboard.subscriptionStatusTrialing')
  if (status === 'past_due') return t('dashboard.subscriptionStatusPastDue')
  if (status === 'canceled') return t('dashboard.subscriptionStatusCanceled')
  return t('dashboard.subscriptionStatusNone')
})
const notificationSettings = computed(() => notificationsStore.settings)
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

function formatPlanLabel(plan: string | null | undefined, hasProPlan?: boolean) {
  const normalized = (hasProPlan ? 'pro' : (plan ?? 'free')).toUpperCase()
  return t('dashboard.planLabel', { plan: normalized })
}

function buildInviteDeepLink(invitationCode: string) {
  return `${APP_INVITE_BASE_URL}?inviteCode=${encodeURIComponent(invitationCode)}`
}

function buildInviteShareText(invitationCode: string) {
  const bandName = inviteBand.value?.name ?? t('dashboard.yourBand')
  const deepLink = buildInviteDeepLink(invitationCode)
  return t('dashboard.inviteShareText', { bandName, deepLink, invitationCode })
}

function prefillJoinCodeFromRoute() {
  const queryValue = route.query.inviteCode ?? route.query.invitationCode
  const inviteCode = Array.isArray(queryValue) ? queryValue[0] : queryValue
  if (typeof inviteCode === 'string' && inviteCode.trim()) {
    joinCode.value = inviteCode.trim().toUpperCase()
  }
}

async function refreshBands() {
  await authStore.loadBands()
}

async function createBand() {
  const name = newBandName.value.trim()
  if (!name) {
    Notify.create({ type: 'warning', message: t('dashboard.bandNameRequired') })
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
    Notify.create({ type: 'positive', message: t('dashboard.bandCreated') })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('dashboard.failedCreateBand'),
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
    Notify.create({ type: 'positive', message: t('dashboard.bandUpdated') })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('dashboard.failedUpdateBand'),
    })
  } finally {
    creatingBand.value = false
  }
}

function deleteBand(bandId: number) {
  $q.dialog({ title: t('dashboard.deleteBand'), message: t('dashboard.deleteBandConfirm'), cancel: true }).onOk(async () => {
    creatingBand.value = true
    try {
      await apiJson(`/bands/${bandId}`, { method: 'DELETE', headers: bandHeaders(bandId) })
      await refreshBands()
      Notify.create({ type: 'positive', message: t('dashboard.bandDeleted') })
    } catch (error) {
      Notify.create({
        type: 'negative',
        message: error instanceof Error ? error.message : t('dashboard.failedDeleteBand'),
      })
    } finally {
      creatingBand.value = false
    }
  })
}

function selectBandOnly(bandId: number) {
  authStore.setActiveBand(bandId)
  Notify.create({ type: 'positive', message: t('dashboard.activeBandSelected') })
}

async function selectBandAndOpen(bandId: number) {
  authStore.setActiveBand(bandId)
  await bandStore.fetchMembers()
  await router.push('/')
}

async function joinBand() {
  if (!joinCode.value.trim()) {
    Notify.create({ type: 'warning', message: t('dashboard.enterInviteCodeFirst') })
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
    Notify.create({ type: 'positive', message: t('dashboard.joinedBand', { name: joinedBand.name }) })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('dashboard.failedJoinBand'),
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
      message: error instanceof Error ? error.message : t('dashboard.failedLoadInvitationCodes'),
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
    Notify.create({ type: 'positive', message: t('dashboard.invitationCodeCreated', { code: created.code }) })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('dashboard.failedCreateInvitationCode'),
    })
  } finally {
    creatingInvite.value = false
  }
}

function openQr(code: string) {
  selectedInviteCode.value = code
  qrImageUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(buildInviteDeepLink(code))}`
  showQrDialog.value = true
}

async function copyWebAppLink() {
  try {
    await copyToClipboard('https://bandstr.apps.4ki.app')
    Notify.create({ type: 'positive', message: t('dashboard.linkCopied') })
  } catch {
    Notify.create({ type: 'negative', message: t('dashboard.failedCopyInvitationText') })
  }
}

async function copyInviteCode(code: string) {
  try {
    await copyToClipboard(buildInviteShareText(code))
    Notify.create({ type: 'positive', message: t('dashboard.invitationTextCopied') })
  } catch {
    Notify.create({ type: 'negative', message: t('dashboard.failedCopyInvitationText') })
  }
}

async function shareInviteCode(code: string) {
  const text = buildInviteShareText(code)
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch {
      // Fall back to clipboard if native share is canceled/unavailable.
    }
  }
  try {
    await copyToClipboard(text)
    Notify.create({ type: 'positive', message: t('dashboard.invitationTextCopied') })
  } catch {
    Notify.create({ type: 'negative', message: t('dashboard.failedShareInvitationText') })
  }
}
function invalidateInviteCode(inviteId: number) {
  if (!inviteBand.value) return
  $q.dialog({
    title: t('dashboard.invalidateInvitation'),
    message: t('dashboard.invalidateInvitationConfirm'),
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
      Notify.create({ type: 'positive', message: t('dashboard.invitationCodeInvalidated') })
    } catch (error) {
      Notify.create({
        type: 'negative',
        message: error instanceof Error ? error.message : t('dashboard.failedInvalidateInvitationCode'),
      })
    }
  })
}

async function openGooglePlayManagement() {
  loadingManage.value = true
  try {
    const data = await apiJson<{
      currentSubscription: { managementUrl: string | null }
    }>('/billing/plans')
    const url = data.currentSubscription.managementUrl
    if (url) {
      window.open(url, '_blank')
      return
    }
    if (isAndroidNative()) {
      const { openPlaySubscriptions } = await import('../plugins/playBilling')
      await openPlaySubscriptions()
      return
    }
    Notify.create({ type: 'info', message: t('dashboard.openGooglePlayManageSubscription') })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('dashboard.failedOpenGooglePlaySubscriptionManagement'),
    })
  } finally {
    loadingManage.value = false
  }
}

async function toggleNotificationSetting(key: 'notifyAbsence' | 'notifyGig' | 'notifyRehearsal' | 'notifySongSuggestion', value: boolean) {
  updatingNotifications.value = true
  try {
    await notificationsStore.updateSettings({ [key]: value })
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('dashboard.failedUpdateNotificationSettings'),
    })
  } finally {
    updatingNotifications.value = false
  }
}

onMounted(async () => {
  prefillJoinCodeFromRoute()
  await Promise.all([refreshBands(), notificationsStore.fetchSettings()])
})
</script>

<template>
  <q-page padding>
    <div class="dashboard-wrap">
      <div class="row items-center q-col-gutter-sm q-mb-lg">
        <div class="col-12 col-md">
          <div class="text-h4 text-weight-bold">{{ t('dashboard.title') }}</div>
          <div class="text-body2 text-grey-7">{{ t('dashboard.subtitle') }}</div>
          <div class="row items-center q-gutter-sm q-mt-xs">
            <span class="text-caption text-grey-8">{{ t('dashboard.loggedInAs', { identity: userIdentity }) }}</span>
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              color="negative"
              icon="delete_forever"
              :label="t('nav.deleteAccount')"
              @click="router.push('/delete-account')"
            />
          </div>
        </div>
      </div>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-lg-7">
          <q-card flat bordered class="q-mb-lg">
            <q-card-section class="q-gutter-sm">
              <div class="row items-center justify-between">
                <div class="text-h6">{{ t('dashboard.manageBands') }}</div>
                <div class="row q-gutter-xs">
                  <q-btn flat round dense icon="refresh" @click="refreshBands">
                    <q-tooltip>{{ t('dashboard.refresh') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    color="primary"
                    round
                    dense
                    icon="add"
                    :disable="!canCreateBand"
                    :title="canCreateBand ? t('dashboard.createBandHint') : t('dashboard.freePlanOneBand')"
                    @click="showCreateBandDialog = true"
                  >
                    <q-tooltip>{{ t('dashboard.createBand') }}</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div class="text-caption text-grey-7">{{ t('dashboard.selectBandHint') }}</div>
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ t('dashboard.shareWebAppPCPreLink') }}<a href="https://bandstr.apps.4ki.app" target="_blank" class="text-primary text-weight-medium" style="text-decoration: underline;">{{ t('dashboard.shareWebAppPCLinkText') }}</a>{{ t('dashboard.shareWebAppPCPostLink') }}
                <q-btn flat round dense size="xs" icon="content_copy" color="grey-7" @click="copyWebAppLink" style="display: inline-flex; vertical-align: middle; margin-left: 4px;">
                  <q-tooltip>{{ t('dashboard.copyTooltip') }}</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>
            <q-separator />
            <q-list separator>
              <q-item v-for="band in authStore.bands" :key="band.id">
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ band.name }}</q-item-label>
                  <div class="row items-center q-gutter-xs q-mt-xs">
                    <q-badge outline color="secondary" :label="formatPlanLabel(band.plan, band.hasProPlan)" />
                    <q-badge v-if="authStore.activeBandId === band.id" color="primary" :label="t('dashboard.active')" />
                  </div>
                </q-item-section>
                <q-item-section side>
                  <div class="row q-gutter-xs">
                    <q-btn
                      v-if="canManageBand(band.role)"
                      flat
                      round
                      dense
                      icon="qr_code_2"
                      @click="openInviteManager(band)"
                    >
                      <q-tooltip>{{ t('dashboard.invite') }}</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="canManageBand(band.role)"
                      flat
                      round
                      dense
                      icon="edit"
                      @click="openEdit(band)"
                    >
                      <q-tooltip>{{ t('dashboard.editBand') }}</q-tooltip>
                    </q-btn>
                    <q-btn flat round dense icon="check_circle" @click="selectBandOnly(band.id)">
                      <q-tooltip>{{ t('dashboard.selectBand') }}</q-tooltip>
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
                      <q-tooltip>{{ t('dashboard.deleteBand') }}</q-tooltip>
                    </q-btn>
                    <q-btn color="primary" round dense icon="launch" @click="selectBandAndOpen(band.id)">
                      <q-tooltip>{{ t('dashboard.openApp') }}</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>

          <q-card flat bordered>
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">{{ t('dashboard.joinBand') }}</div>
                <div class="text-caption text-grey-7">{{ t('dashboard.joinBandHint') }}</div>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <div class="col">
                  <q-input
                    v-model="joinCode"
                    :label="t('dashboard.invitationCode')"
                    outlined
                    dense
                    :placeholder="t('dashboard.invitationCodePlaceholder')"
                    @keyup.enter="joinBand"
                  />
                </div>
                <div>
                  <q-btn color="primary" dense :label="t('dashboard.join')" :loading="joining" @click="joinBand" />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-lg-5">
          <q-card flat bordered class="q-mb-lg">
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">{{ t('dashboard.manageSubscriptions') }}</div>
                <div class="text-caption text-grey-7">{{ t('dashboard.currentPlan', { plan: activePlanLabel }) }}</div>
                <div class="text-caption text-grey-7">{{ t('dashboard.statusLabel', { status: activeSubscriptionStatusLabel }) }}</div>
                <div v-if="activeSubscriptionProvider === 'google_play'" class="text-caption text-grey-7">
                  {{ t('dashboard.providerGoogle') }}
                </div>
                <div v-else-if="activeSubscriptionProvider === 'app_store'" class="text-caption text-grey-7">
                  {{ t('dashboard.providerApple') }}
                </div>
                <div v-else-if="activeSubscriptionProvider === 'stripe'" class="text-caption text-grey-7">
                  {{ t('dashboard.providerStripe') }}
                </div>
              </div>
              <div class="column q-gutter-xs items-end">
                <q-btn
                  v-if="activeSubscriptionProvider === 'google_play'"
                  color="primary"
                  round
                  dense
                  icon="open_in_new"
                  :loading="loadingManage"
                  @click="openGooglePlayManagement"
                >
                  <q-tooltip>{{ t('dashboard.manageInGooglePlay') }}</q-tooltip>
                </q-btn>
                <q-btn color="primary" round dense icon="payments" @click="router.push('/billing')">
                  <q-tooltip>{{ t('dashboard.openBilling') }}</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="q-mb-lg">
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">{{ t('dashboard.manageAccount') }}</div>
                <div class="text-caption text-grey-7">{{ t('dashboard.manageAccountHint') }}</div>
              </div>
              <q-btn color="primary" round dense icon="manage_accounts" @click="router.push('/account/security')">
                <q-tooltip>{{ t('dashboard.openAccountSettings') }}</q-tooltip>
              </q-btn>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="q-mb-lg">
            <q-card-section>
              <div class="text-h6">{{ t('dashboard.pushNotifications') }}</div>
              <div class="text-caption text-grey-7 q-mb-md">{{ t('dashboard.pushNotificationsHint') }}</div>
              <div v-if="notificationSettings" class="column q-gutter-sm">
                <q-toggle
                  :model-value="notificationSettings.notifyAbsence"
                  :disable="updatingNotifications"
                  :label="t('dashboard.notifyAbsence')"
                  @update:model-value="(value) => toggleNotificationSetting('notifyAbsence', !!value)"
                />
                <q-toggle
                  :model-value="notificationSettings.notifyGig"
                  :disable="updatingNotifications"
                  :label="t('dashboard.notifyGig')"
                  @update:model-value="(value) => toggleNotificationSetting('notifyGig', !!value)"
                />
                <q-toggle
                  :model-value="notificationSettings.notifyRehearsal"
                  :disable="updatingNotifications"
                  :label="t('dashboard.notifyRehearsal')"
                  @update:model-value="(value) => toggleNotificationSetting('notifyRehearsal', !!value)"
                />
                <q-toggle
                  :model-value="notificationSettings.notifySongSuggestion"
                  :disable="updatingNotifications"
                  :label="t('dashboard.notifySongSuggestion')"
                  @update:model-value="(value) => toggleNotificationSetting('notifySongSuggestion', !!value)"
                />
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered>
            <q-card-section class="row items-center justify-between">
              <div>
                <div class="text-h6">{{ t('dashboard.deleteAccount') }}</div>
                <div class="text-caption text-grey-7">{{ t('dashboard.deleteAccountHint') }}</div>
              </div>
              <q-btn color="negative" round dense icon="delete_forever" @click="router.push('/delete-account')">
                <q-tooltip>{{ t('dashboard.openDeleteAccount') }}</q-tooltip>
              </q-btn>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <q-dialog v-model="showCreateBandDialog" :position="isIos ? 'bottom' : 'standard'">
      <q-card style="min-width: 420px">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('dashboard.createBand') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-input v-model="newBandName" :label="t('dashboard.bandName')" outlined dense autofocus />
          <div class="text-caption text-grey-7 q-mt-sm">{{ t('dashboard.slugAuto') }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.add')" :loading="creatingBand" :disable="!newBandName.trim()" @click="createBand" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showEditModal" :position="isIos ? 'bottom' : 'standard'">
      <q-card style="min-width: 420px" v-if="editForm">
        <div v-if="isIos" class="ios-sheet-grabber" />
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('dashboard.editBand') }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="editForm.name" :label="t('dashboard.bandName')" outlined dense />
          <q-banner class="bg-widget-surface rounded-borders">
            {{ t('dashboard.slugImmutable') }}
          </q-banner>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('common.save')" :loading="creatingBand" @click="saveBand" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showInvitesModal">
      <q-card style="min-width: 760px; max-width: 95vw">
        <q-card-section class="row items-center justify-between">
          <div>
            <div class="text-h6">{{ t('dashboard.invitationCodes') }}</div>
            <div class="text-caption text-grey-7">{{ t('dashboard.inviteBandRow', { band: inviteBand?.name ?? '-', days: 30 }) }}</div>
          </div>
          <div class="row q-gutter-xs">
            <q-btn flat round dense icon="refresh" :disable="!inviteBand" @click="refreshInviteCodes">
              <q-tooltip>{{ t('dashboard.refresh') }}</q-tooltip>
            </q-btn>
            <q-btn color="primary" round dense icon="add" :loading="creatingInvite" :disable="!inviteBand" @click="createInviteCode">
              <q-tooltip>{{ t('dashboard.createCode') }}</q-tooltip>
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
                {{ t('dashboard.createdAt', { value: formatDateTime(code.createdAt) }) }}
                | {{ t('dashboard.expiresAt', { value: formatDateTime(code.expiresAt) }) }}
                <span v-if="code.usedAt"> | {{ t('dashboard.usedAt', { value: formatDateTime(code.usedAt) }) }}</span>
                <span v-if="code.invalidatedAt"> | {{ t('dashboard.invalidatedAt', { value: formatDateTime(code.invalidatedAt) }) }}</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-badge v-if="code.usedAt" color="positive" :label="t('dashboard.used')" />
                <q-badge v-else-if="code.invalidatedAt" color="negative" :label="t('dashboard.invalidated')" />
                <q-badge v-else-if="code.expired" color="warning" text-color="dark" :label="t('dashboard.expired')" />
                <q-badge v-else color="info" :label="t('dashboard.active')" />
                <q-btn flat round dense icon="qr_code_2" @click="openQr(code.code)">
                  <q-tooltip>{{ t('dashboard.showQr') }}</q-tooltip>
                </q-btn>
                <q-btn flat round dense icon="content_copy" @click="copyInviteCode(code.code)">
                  <q-tooltip>{{ t('dashboard.copyInviteText') }}</q-tooltip>
                </q-btn>
                <q-btn flat round dense icon="share" @click="shareInviteCode(code.code)">
                  <q-tooltip>{{ t('dashboard.shareInvite') }}</q-tooltip>
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
                  <q-tooltip>{{ t('dashboard.invalidate') }}</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
          <q-item v-if="inviteCodes.length === 0">
            <q-item-section>
              <q-item-label caption>{{ t('dashboard.noInvitationCodes') }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showQrDialog">
      <q-card style="min-width: 340px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ t('dashboard.invitationQrCode') }}</div>
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

<style lang="scss" scoped>
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
