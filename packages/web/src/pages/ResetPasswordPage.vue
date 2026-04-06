<template>
  <div class="reset-password-wrap">
    <q-card flat bordered class="q-pa-lg">
      <div class="text-h6 q-mb-sm">Reset password</div>
      <div class="text-body2 text-grey-6 q-mb-md">
        Set a new password for your account.
      </div>

      <q-form class="column q-gutter-md" @submit.prevent="submitReset">
        <q-input
          v-model="newPassword"
          label="New password"
          type="password"
          outlined
          dense
          autocomplete="new-password"
          :rules="[requiredRule, minPasswordRule]"
        />
        <q-input
          v-model="confirmPassword"
          label="Confirm new password"
          type="password"
          outlined
          dense
          autocomplete="new-password"
          :rules="[requiredRule, confirmRule]"
        />

        <q-banner v-if="error" dense rounded class="bg-negative text-white">
          {{ error }}
        </q-banner>

        <q-banner v-if="success" dense rounded class="bg-positive text-white">
          {{ success }}
        </q-banner>

        <div class="row justify-end q-gutter-sm">
          <q-btn flat label="Back to login" @click="router.push('/login')" />
          <q-btn color="primary" label="Save new password" type="submit" :loading="loading" />
        </div>
      </q-form>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const apiBase = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const requiredRule = (value: string) => (!!value && value.trim().length > 0) || 'Required'
const minPasswordRule = (value: string) => value.length >= 8 || 'Password must be at least 8 characters'
const confirmRule = (value: string) => value === newPassword.value || 'Passwords do not match'

function getToken(): string {
  return typeof route.query.token === 'string' ? route.query.token : ''
}

async function submitReset() {
  error.value = ''
  success.value = ''

  const token = getToken()
  if (!token) {
    error.value = 'Missing or invalid reset token.'
    return
  }
  if (!newPassword.value || newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  try {
    const response = await fetch(`${apiBase}/api/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        token,
        newPassword: newPassword.value,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } }
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? payload?.message ?? `Reset failed (${response.status})`)
    }

    success.value = 'Password reset successful. You can now sign in.'
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Password reset failed.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reset-password-wrap {
  max-width: 480px;
}
</style>

