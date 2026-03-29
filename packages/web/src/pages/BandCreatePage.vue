<template>
  <q-page class="q-pa-md flex flex-center">
    <q-card class="q-pa-lg" style="min-width: 360px">
      <q-card-section>
        <div class="text-h6 q-mb-md">Create a new band</div>

        <q-input
          v-model="form.name"
          label="Band name"
          outlined
          dense
          class="q-mb-md"
        />
        <div class="text-caption text-grey-7 q-mb-md">URL slug is generated automatically after creation.</div>

        <q-btn
          label="Create band"
          color="primary"
          unelevated
          class="full-width"
          :loading="loading"
          :disable="!form.name"
          @click="submit"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiJson } from '../boot/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)

const form = reactive({ name: '' })

async function submit() {
  loading.value = true
  try {
    const band = await apiJson<{ id: number; name: string; slug: string; plan: string }>('/bands', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    // Refresh band list and switch to new band
    const bands = await apiJson<typeof authStore.bands>('/bands')
    authStore.setBands(bands)
    authStore.setActiveBand(band.id)
    router.push('/')
  } finally {
    loading.value = false
  }
}
</script>
