<template>
  <q-page class="q-pa-md delete-account-page">
    <div class="delete-account-wrap">
      <div class="text-h5 q-mb-sm">Delete account</div>
      <div class="text-body2 text-grey-6 q-mb-lg">
        This action permanently deletes your account and cannot be undone.
      </div>

      <q-banner class="bg-red-10 text-white rounded-borders q-mb-md">
        You will lose access to all your band data. If you are the last owner of a band with other members,
        deletion is blocked until ownership is transferred.
      </q-banner>

      <q-input
        v-model="confirmText"
        outlined
        label='Type "DELETE" to confirm'
        :disable="loading"
      />

      <div class="row q-mt-md q-gutter-sm">
        <q-btn
          color="negative"
          icon="delete_forever"
          label="Delete my account"
          :disable="!isPhraseValid || loading"
          :loading="loading"
          @click="showDialog = true"
        />
        <q-btn
          flat
          label="Cancel"
          :disable="loading"
          @click="goBack"
        />
      </div>
    </div>

    <q-dialog v-model="showDialog">
      <q-card style="min-width: 320px; max-width: 460px">
        <q-card-section class="text-h6">
          Final confirmation
        </q-card-section>
        <q-card-section>
          Do you really want to permanently delete your account?
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="No" :disable="loading" v-close-popup />
          <q-btn
            color="negative"
            label="Yes, delete account"
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
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

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
    const res = await api('/account', { method: 'DELETE' })
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      throw new Error(body?.error ?? `Failed to delete account (${res.status})`)
    }

    authStore.clearSession()
    window.location.href = '/login'
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Account deletion failed',
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
