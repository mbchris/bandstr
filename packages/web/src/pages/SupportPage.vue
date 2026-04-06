<template>
  <q-page class="q-pa-md support-page">
    <div class="support-wrap">
      <div class="text-h5 q-mb-sm">Support</div>
      <div class="text-body2 text-grey-5 q-mb-md">
        Report bugs, suggest features, or leave a comment for the development team.
      </div>

      <q-card flat bordered class="q-pa-md">
        <q-form class="column q-gutter-md" @submit.prevent="submit">
          <q-select
            v-model="kind"
            outlined
            dense
            label="Type"
            emit-value
            map-options
            :options="typeOptions"
          />

          <q-chip dense square color="primary" text-color="white">
            {{ tagPreview }}
          </q-chip>

          <q-input
            v-model="email"
            outlined
            dense
            label="Email (optional)"
            type="email"
            autocomplete="email"
          />

          <q-file
            v-model="screenshotFile"
            outlined
            dense
            clearable
            accept="image/*"
            label="Screenshot (optional)"
          />

          <q-input
            v-model="message"
            outlined
            autogrow
            type="textarea"
            label="Message"
            :rules="[messageRule]"
          />

          <div class="text-caption text-grey-6">
            Build: <strong>{{ buildId }}</strong> |
            Environment: <strong>{{ environment }}</strong>
          </div>

          <div class="row justify-end">
            <q-btn color="primary" label="Send to GitHub" type="submit" :loading="submitting" />
          </div>
        </q-form>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Notify } from 'quasar'
import { api } from '../boot/api'

type SupportType = 'bug' | 'feature' | 'comment'

const kind = ref<SupportType>('bug')
const message = ref('')
const email = ref('')
const screenshotFile = ref<File | null>(null)
const submitting = ref(false)
const buildId = ref((process.env.GIT_REV ?? 'dev').trim() || 'dev')
const environment = ref((process.env.NODE_ENV ?? 'development').trim() || 'development')

const typeOptions = [
  { label: 'Report a bug', value: 'bug' },
  { label: 'Suggest a feature', value: 'feature' },
  { label: 'Leave a comment', value: 'comment' },
]

const tagPreview = computed(() => {
  if (kind.value === 'bug') return 'Tags: support, type:bug'
  if (kind.value === 'feature') return 'Tags: support, type:feature'
  return 'Tags: support, type:comment'
})

const messageRule = (value: string) => value.trim().length >= 10 || 'Please provide at least 10 characters'

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read screenshot'))
    reader.readAsDataURL(file)
  })
}

async function loadConfig() {
  const response = await api('/support/config', { method: 'GET' })
  if (!response.ok) return
  const payload = (await response.json().catch(() => ({}))) as {
    buildId?: string
    environment?: string
    githubEnabled?: boolean
  }
  if (payload.buildId) buildId.value = payload.buildId
  if (payload.environment) environment.value = payload.environment
  if (payload.githubEnabled === false) {
    Notify.create({
      type: 'warning',
      message: 'Support backend is not configured with GitHub token yet.',
    })
  }
}

async function submit() {
  const trimmedMessage = message.value.trim()
  if (trimmedMessage.length < 10) return

  submitting.value = true
  try {
    const screenshotDataUrl = screenshotFile.value ? await fileToDataUrl(screenshotFile.value) : undefined

    const response = await api('/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Build-Id': buildId.value,
        'X-Client-Environment': environment.value,
      },
      body: JSON.stringify({
        type: kind.value,
        message: trimmedMessage,
        email: email.value.trim(),
        screenshotDataUrl,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as { issueUrl?: string; error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? `Support request failed (${response.status})`)
    }

    Notify.create({ type: 'positive', message: 'Support ticket created on GitHub.' })
    if (payload.issueUrl) {
      window.open(payload.issueUrl, '_blank', 'noopener,noreferrer')
    }
    message.value = ''
    email.value = ''
    screenshotFile.value = null
  } catch (error: unknown) {
    Notify.create({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Could not create support ticket.',
    })
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadConfig()
})
</script>

<style scoped>
.support-page {
  display: flex;
  justify-content: center;
}

.support-wrap {
  width: min(760px, 100%);
}
</style>

