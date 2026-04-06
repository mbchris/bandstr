<template>
  <q-page class="q-pa-md delete-account-page">
    <div class="delete-account-wrap">
      <div class="text-h5 q-mb-sm">{{ t('deleteAccount.title') }}</div>
      <div class="text-body2 text-grey-6 q-mb-lg">
        {{ t('deleteAccount.subtitle') }}
      </div>

      <q-banner class="bg-red-10 text-white rounded-borders q-mb-md">
        {{ t('deleteAccount.warning') }}
      </q-banner>

      <q-input
        v-model="confirmText"
        outlined
        :label="t('deleteAccount.confirmInput')"
        :disable="loading"
      />

      <div class="row q-mt-md q-gutter-sm">
        <q-btn
          color="negative"
          icon="delete_forever"
          :label="t('deleteAccount.deleteMyAccount')"
          :disable="!isPhraseValid || loading"
          :loading="loading"
          @click="showDialog = true"
        />
        <q-btn
          flat
          :label="t('common.cancel')"
          :disable="loading"
          @click="goBack"
        />
      </div>
    </div>

    <q-dialog v-model="showDialog">
      <q-card style="min-width: 320px; max-width: 460px">
        <q-card-section class="text-h6">
          {{ t('deleteAccount.finalConfirmation') }}
        </q-card-section>
        <q-card-section>
          {{ t('deleteAccount.finalPrompt') }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('deleteAccount.no')" :disable="loading" v-close-popup />
          <q-btn
            color="negative"
            :label="t('deleteAccount.yesDelete')"
            :loading="loading"
            @click="deleteAccount"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter } from 'vue-router'
import { api } from '../boot/api'
import { authClient } from '../boot/auth'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../composables/useI18n'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const confirmText = ref('')
const showDialog = ref(false)
const loading = ref(false)

const isPhraseValid = computed(() => confirmText.value.trim() === 'DELETE')

function goBack() {
  void router.push('/')
}

async function deleteAccount() {
  if (!isPhraseValid.value || loading.value) return
  loading.value = true
  try {
    const apiBase = (process.env.API_URL || '').replace(/\/+$/, '').replace(/\/api$/, '')
    const res = await api('/account', { method: 'DELETE' })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      throw new Error(body?.error ?? `Failed to delete account (${res.status})`)
    }

    // Explicitly invalidate cookie and bearer sessions after account deletion.
    await authClient.signOut().catch(() => undefined)
    await fetch(`${apiBase}/api/auth/sign-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{}',
    }).catch(() => undefined)

    if (authStore.token) {
      await fetch(`${apiBase}/api/mobile-auth/revoke-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        credentials: 'omit',
      }).catch(() => undefined)
    }

    authStore.clearSession()
    window.location.href = '/login'
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : t('deleteAccount.deletionFailed'),
    })
  } finally {
    loading.value = false
    showDialog.value = false
  }
}
</script>

<style scoped>
.delete-account-page {
  display: flex;
  justify-content: center;
}

.delete-account-wrap {
  width: 100%;
  max-width: 640px;
}
</style>
