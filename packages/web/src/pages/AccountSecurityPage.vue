<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../composables/useI18n'

const authStore = useAuthStore()
const route = useRoute()
const { t } = useI18n()
const apiBase = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

const newEmail = ref('')
const newName = ref('')
const currentPassword = ref('')
const newPassword = ref('')

const loadingChangeName = ref(false)
const loadingResendVerification = ref(false)
const loadingChangeEmail = ref(false)
const loadingPassword = ref(false)

const currentEmail = computed(() => authStore.user?.email ?? '')
const isEmailVerified = computed(() => !!authStore.user?.emailVerified)

const requiredRule = (value: string) => (!!value && value.trim().length > 0) || t('accountSecurity.required')
const emailRule = (value: string) => /.+@.+\..+/.test(value) || t('accountSecurity.invalidEmail')
const minPasswordRule = (value: string) => value.length >= 8 || t('accountSecurity.minPassword')

function authEndpoint(path: string): string {
  return `${apiBase}/api/auth${path}`
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(authEndpoint(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? `Request failed (${response.status})`)
  }
}

async function refreshSession() {
  await authStore.loadSession()
}

async function changeName() {
  const name = newName.value.trim()
  if (!name) return

  loadingChangeName.value = true
  try {
    await postAuth('/update-user', { name })
    await refreshSession()
    Notify.create({ type: 'positive', message: t('accountSecurity.displayNameUpdated') })
    newName.value = authStore.user?.name ?? ''
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : t('accountSecurity.nameUpdateFailed') })
  } finally {
    loadingChangeName.value = false
  }
}

async function resendVerificationEmail() {
  if (!currentEmail.value) return
  loadingResendVerification.value = true
  try {
    await postAuth('/send-verification-email', {
      email: currentEmail.value,
      callbackURL: `${window.location.origin}/account/security?verified=1`,
    })
    Notify.create({ type: 'positive', message: t('accountSecurity.verificationSent') })
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : t('accountSecurity.failedSendEmail') })
  } finally {
    loadingResendVerification.value = false
  }
}

async function changeEmail() {
  const email = newEmail.value.trim()
  if (!/.+@.+\..+/.test(email)) return
  loadingChangeEmail.value = true
  try {
    await postAuth('/change-email', {
      newEmail: email,
      callbackURL: `${window.location.origin}/account/security?verified=1`,
    })
    Notify.create({
      type: 'positive',
      message: t('accountSecurity.emailChangeConfirmationSent'),
    })
    newEmail.value = ''
    await refreshSession()
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : t('accountSecurity.emailChangeFailed') })
  } finally {
    loadingChangeEmail.value = false
  }
}

async function savePassword() {
  if (newPassword.value.length < 8) return
  loadingPassword.value = true
  try {
    if (currentPassword.value.trim()) {
      await postAuth('/change-password', {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      })
    } else {
      await postAuth('/set-password', {
        newPassword: newPassword.value,
      })
    }

    Notify.create({ type: 'positive', message: t('accountSecurity.passwordSaved') })
    currentPassword.value = ''
    newPassword.value = ''
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : t('accountSecurity.passwordUpdateFailed') })
  } finally {
    loadingPassword.value = false
  }
}

onMounted(async () => {
  await refreshSession()
  newName.value = authStore.user?.name ?? ''

  if (route.query.verified === '1') {
    Notify.create({ type: 'positive', message: t('accountSecurity.emailVerificationCompleted') })
  }
  if (typeof route.query.error === 'string' && route.query.error) {
    Notify.create({ type: 'negative', message: t('accountSecurity.verificationFailed', { error: route.query.error }) })
  }
})
</script>

<template>
  <q-page class="q-pa-md account-security-page">
    <div class="account-security-wrap">
      <div class="text-h5 q-mb-sm">{{ t('accountSecurity.title') }}</div>
      <div class="text-body2 text-grey-5 q-mb-md">
        {{ t('accountSecurity.subtitle') }}
      </div>

      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('accountSecurity.changeName') }}</div>
        <q-form class="column q-gutter-md" @submit.prevent="changeName">
          <q-input
            v-model="newName"
            :label="t('accountSecurity.displayName')"
            type="text"
            outlined
            dense
            autocomplete="name"
            :rules="[requiredRule]"
          />
          <div class="row justify-end">
            <q-btn color="primary" :label="t('accountSecurity.changeName')" type="submit" :loading="loadingChangeName" />
          </div>
        </q-form>
      </q-card>

      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('accountSecurity.emailVerification') }}</div>
        <div class="text-body2 q-mb-sm">
          {{ t('accountSecurity.currentEmail') }} <strong>{{ currentEmail || '-' }}</strong>
        </div>
        <div class="text-body2 q-mb-md">
          {{ t('accountSecurity.status') }}
          <strong :class="isEmailVerified ? 'text-positive' : 'text-warning'">
            {{ isEmailVerified ? t('accountSecurity.verified') : t('accountSecurity.notVerified') }}
          </strong>
        </div>
        <q-btn
          color="primary"
          outline
          :label="t('accountSecurity.resendVerification')"
          :loading="loadingResendVerification"
          :disable="!currentEmail"
          @click="resendVerificationEmail"
        />
      </q-card>

      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('accountSecurity.changeEmail') }}</div>
        <q-form class="column q-gutter-md" @submit.prevent="changeEmail">
          <q-input
            v-model="newEmail"
            :label="t('accountSecurity.newEmail')"
            type="email"
            outlined
            dense
            autocomplete="email"
            :rules="[requiredRule, emailRule]"
          />
          <div class="row justify-end">
            <q-btn color="primary" :label="t('accountSecurity.changeEmail')" type="submit" :loading="loadingChangeEmail" />
          </div>
        </q-form>
      </q-card>

      <q-card flat bordered class="q-pa-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ t('accountSecurity.password') }}</div>
        <div class="text-body2 text-grey-6 q-mb-md">
          {{ t('accountSecurity.passwordHint') }}
        </div>
        <q-form class="column q-gutter-md" @submit.prevent="savePassword">
          <q-input
            v-model="currentPassword"
            :label="t('accountSecurity.currentPasswordOptional')"
            type="password"
            outlined
            dense
            autocomplete="current-password"
          />
          <q-input
            v-model="newPassword"
            :label="t('accountSecurity.newPassword')"
            type="password"
            outlined
            dense
            autocomplete="new-password"
            :rules="[requiredRule, minPasswordRule]"
          />
          <div class="row justify-end">
            <q-btn color="primary" :label="t('accountSecurity.savePassword')" type="submit" :loading="loadingPassword" />
          </div>
        </q-form>
      </q-card>
    </div>
  </q-page>
</template>

<style lang="scss" scoped>
.account-security-page {
  display: flex;
  justify-content: center;
}

.account-security-wrap {
  width: min(680px, 100%);
}
</style>
