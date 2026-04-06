<template>
  <q-page class="q-pa-md account-security-page">
    <div class="account-security-wrap">
      <div class="text-h5 q-mb-sm">Account security</div>
      <div class="text-body2 text-grey-5 q-mb-md">
        Manage email verification, email address and password.
      </div>

      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Email verification</div>
        <div class="text-body2 q-mb-sm">
          Current email: <strong>{{ currentEmail || '-' }}</strong>
        </div>
        <div class="text-body2 q-mb-md">
          Status:
          <strong :class="isEmailVerified ? 'text-positive' : 'text-warning'">
            {{ isEmailVerified ? 'Verified' : 'Not verified' }}
          </strong>
        </div>
        <q-btn
          color="primary"
          outline
          label="Resend verification email"
          :loading="loadingResendVerification"
          :disable="!currentEmail"
          @click="resendVerificationEmail"
        />
      </q-card>

      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Change email</div>
        <q-form class="column q-gutter-md" @submit.prevent="changeEmail">
          <q-input
            v-model="newEmail"
            label="New email"
            type="email"
            outlined
            dense
            autocomplete="email"
            :rules="[requiredRule, emailRule]"
          />
          <div class="row justify-end">
            <q-btn color="primary" label="Change email" type="submit" :loading="loadingChangeEmail" />
          </div>
        </q-form>
      </q-card>

      <q-card flat bordered class="q-pa-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Password</div>
        <div class="text-body2 text-grey-6 q-mb-md">
          Provide your current password if you already set one. Leave it empty to set a password for social login.
        </div>
        <q-form class="column q-gutter-md" @submit.prevent="savePassword">
          <q-input
            v-model="currentPassword"
            label="Current password (optional)"
            type="password"
            outlined
            dense
            autocomplete="current-password"
          />
          <q-input
            v-model="newPassword"
            label="New password"
            type="password"
            outlined
            dense
            autocomplete="new-password"
            :rules="[requiredRule, minPasswordRule]"
          />
          <div class="row justify-end">
            <q-btn color="primary" label="Save password" type="submit" :loading="loadingPassword" />
          </div>
        </q-form>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const apiBase = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

const newEmail = ref('')
const currentPassword = ref('')
const newPassword = ref('')

const loadingResendVerification = ref(false)
const loadingChangeEmail = ref(false)
const loadingPassword = ref(false)

const currentEmail = computed(() => authStore.user?.email ?? '')
const isEmailVerified = computed(() => !!authStore.user?.emailVerified)

const requiredRule = (value: string) => (!!value && value.trim().length > 0) || 'Required'
const emailRule = (value: string) => /.+@.+\..+/.test(value) || 'Please provide a valid email'
const minPasswordRule = (value: string) => value.length >= 8 || 'Password must be at least 8 characters'

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

async function resendVerificationEmail() {
  if (!currentEmail.value) return
  loadingResendVerification.value = true
  try {
    await postAuth('/send-verification-email', {
      email: currentEmail.value,
      callbackURL: `${window.location.origin}/account/security?verified=1`,
    })
    Notify.create({ type: 'positive', message: 'Verification email sent.' })
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : 'Failed to send email.' })
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
      message: 'Confirmation mail sent to your current address. Verify both steps to complete the change.',
    })
    newEmail.value = ''
    await refreshSession()
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : 'Email change failed.' })
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

    Notify.create({ type: 'positive', message: 'Password saved.' })
    currentPassword.value = ''
    newPassword.value = ''
  } catch (error: unknown) {
    Notify.create({ type: 'negative', message: error instanceof Error ? error.message : 'Password update failed.' })
  } finally {
    loadingPassword.value = false
  }
}

onMounted(async () => {
  await refreshSession()

  if (route.query.verified === '1') {
    Notify.create({ type: 'positive', message: 'Email verification completed.' })
  }
  if (typeof route.query.error === 'string' && route.query.error) {
    Notify.create({ type: 'negative', message: `Verification failed: ${route.query.error}` })
  }
})
</script>

<style scoped>
.account-security-page {
  display: flex;
  justify-content: center;
}

.account-security-wrap {
  width: min(680px, 100%);
}
</style>

