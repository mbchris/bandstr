<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { Capacitor } from '@capacitor/core'
import { api } from '../boot/api'
import { fetchRuntimeBuildId, resolveBuildIdFromEnv } from '../composables/buildInfo'

type SupportType = 'bug' | 'feature' | 'comment'

const router = useRouter()

function isUsableBuildId(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return Boolean(normalized) && normalized !== 'unknown' && normalized !== 'dev'
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}

const kind = ref<SupportType>('bug')
const message = ref('')
const email = ref('')
const submitting = ref(false)
const buildId = ref(resolveBuildIdFromEnv('dev'))
const appVersion = ref(Capacitor.isNativePlatform() ? (process.env.APP_VERSION ?? 'unknown').trim() || 'unknown' : 'web')
const environment = ref((process.env.NODE_ENV ?? 'development').trim() || 'development')
const lastSubmission = ref<{
  type: SupportType
  email: string
  message: string
} | null>(null)

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

async function loadConfig() {
  const response = await api('/support/config', { method: 'GET' })
  if (!response.ok) return
  const payload = (await response.json().catch(() => ({}))) as {
    buildId?: string
    environment?: string
    githubEnabled?: boolean
  }
  if (payload.buildId && isUsableBuildId(payload.buildId)) buildId.value = payload.buildId
  if (payload.environment) environment.value = payload.environment
  if (payload.githubEnabled === false) {
    Notify.create({
      type: 'warning',
      message: 'Support backend is not configured with GitHub token yet.',
    })
  }
}

async function loadRuntimeBuildId() {
  const runtimeRev = await fetchRuntimeBuildId()
  if (runtimeRev) buildId.value = runtimeRev
}

async function submit() {
  const trimmedMessage = message.value.trim()
  if (trimmedMessage.length < 10) return

  submitting.value = true
  try {
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
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? `Support request failed (${response.status})`)
    }

    Notify.create({ type: 'positive', message: 'Your inquiry was submitted successfully.' })
    lastSubmission.value = {
      type: kind.value,
      email: email.value.trim(),
      message: trimmedMessage,
    }
    message.value = ''
    email.value = ''
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
  await Promise.all([loadConfig(), loadRuntimeBuildId()])
})

function prettyType(value: SupportType): string {
  if (value === 'bug') return 'Report a bug'
  if (value === 'feature') return 'Suggest a feature'
  return 'Leave a comment'
}

function summarize(value: string): string {
  const singleLine = value.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= 180) return singleLine
  return `${singleLine.slice(0, 180)}...`
}
</script>

<template>
  <q-page class="q-pa-md support-page">
    <div class="support-wrap">
      <div class="row items-center q-mb-md support-back-row">
        <q-btn flat icon="arrow_back" label="Back" @click="goBack" />
      </div>

      <div class="text-h5 q-mb-sm">Support</div>
      <div class="text-body2 text-grey-5 q-mb-md">
        Get assistance, explore frequent questions, or contact the bandstr development team.
      </div>

      <!-- Direct Contact Card -->
      <q-card flat bordered class="q-pa-md q-mb-lg support-contact-card">
        <div class="row items-center q-gutter-sm q-mb-xs">
          <q-icon name="mail" size="22px" color="primary" />
          <div class="text-subtitle1 text-weight-medium">Direct Contact</div>
        </div>
        <div class="text-body2 text-grey-5">
          Have questions or need help with your account? Contact us directly at
          <a href="mailto:support@4ki.app" class="support-email-link">support@4ki.app</a>.
        </div>
      </q-card>

      <!-- FAQ Section -->
      <div class="text-h6 q-mb-sm">Frequently Asked Questions</div>
      <q-list bordered class="rounded-borders q-mb-xl faq-list">
        <q-expansion-item
          group="faq"
          icon="login"
          label="Login & Account Access"
          header-class="text-weight-medium"
        >
          <q-card>
            <q-card-section class="text-body2 text-grey-4">
              <div class="text-weight-bold q-mb-xs">How do I sign in or create an account?</div>
              <p class="q-mb-sm">
                You can sign in using email and password, or use Google or Apple sign-in. New accounts can be registered directly from the login screen.
              </p>
              <div class="text-weight-bold q-mb-xs">How do I reset my password?</div>
              <p class="q-mb-none">
                If you forgot your password, visit the <router-link to="/reset-password" class="text-primary">Reset Password</router-link> page to receive a password reset link by email.
              </p>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-separator />

        <q-expansion-item
          group="faq"
          icon="group"
          label="Band Invites & Collaboration"
          header-class="text-weight-medium"
        >
          <q-card>
            <q-card-section class="text-body2 text-grey-4">
              <div class="text-weight-bold q-mb-xs">How do I invite members to my band?</div>
              <p class="q-mb-sm">
                Band owners and administrators can create invitation links or QR codes in the band management settings. Share the invite link with your bandmates to allow them to join.
              </p>
              <div class="text-weight-bold q-mb-xs">Can I belong to multiple bands?</div>
              <p class="q-mb-none">
                Yes! Your user account can belong to multiple bands, and you can switch between active bands from the navigation bar.
              </p>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-separator />

        <q-expansion-item
          group="faq"
          icon="credit_card"
          label="Subscriptions & Billing"
          header-class="text-weight-medium"
        >
          <q-card>
            <q-card-section class="text-body2 text-grey-4">
              <div class="text-weight-bold q-mb-xs">What plans are available?</div>
              <p class="q-mb-sm">
                Bandstr provides both Free and Pro plans. The Free plan includes basic song library management, setlist organization, and scheduling. The Pro plan unlocks multiple active bands, expanded storage, and premium tools.
              </p>
              <div class="text-weight-bold q-mb-xs">How do I manage or cancel a subscription?</div>
              <p class="q-mb-none">
                Subscriptions created on the web can be managed via the Billing section. If you subscribed through Apple App Store In-App Purchases, you can manage or cancel your subscription at any time in your Apple ID Account Settings.
              </p>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>

      <!-- Ticket Submission Form -->
      <div class="text-h6 q-mb-sm">Submit a Support Ticket</div>
      <div class="text-body2 text-grey-5 q-mb-md">
        Report a bug, suggest a feature, or leave feedback for the development team.
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
            label="Email (optional, for replies)"
            type="email"
            autocomplete="email"
          />

          <q-input
            v-model="message"
            outlined
            autogrow
            type="textarea"
            label="Message"
            input-style="min-height: 180px;"
            :rules="[messageRule]"
          />

          <div class="text-caption text-grey-6">
            Build: <strong>{{ buildId }}</strong> |
            App Version: <strong>{{ appVersion }}</strong> |
            Environment: <strong>{{ environment }}</strong>
          </div>

          <div class="row justify-end">
            <q-btn color="primary" label="Send" type="submit" :loading="submitting" />
          </div>
        </q-form>
      </q-card>

      <q-card v-if="lastSubmission" flat bordered class="q-pa-md q-mt-md bg-positive text-white">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Your inquiry was sent</div>
        <div class="text-body2 q-mb-sm">
          Thanks for your message. The development team will review it and contact you.
        </div>
        <div class="text-body2">
          <div><strong>Type:</strong> {{ prettyType(lastSubmission.type) }}</div>
          <div><strong>Reply email:</strong> {{ lastSubmission.email || 'not provided' }}</div>
          <div><strong>Summary:</strong> {{ summarize(lastSubmission.message) }}</div>
        </div>
      </q-card>

      <!-- Legal Links -->
      <div class="row justify-center items-center q-gutter-md q-mt-xl legal-links">
        <router-link to="/impress" class="legal-link">Impressum / Legal Notice</router-link>
        <span class="text-grey-6">•</span>
        <router-link to="/gdpr" class="legal-link">Datenschutz / Privacy Policy</router-link>
      </div>
    </div>
  </q-page>
</template>

<style lang="scss" scoped>
.support-page {
  display: flex;
  justify-content: center;
  min-height: 100vh;
}

.support-wrap {
  width: min(760px, 100%);
  padding-bottom: 48px;
}

.support-back-row {
  padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
}

.support-contact-card {
  background: rgba(148, 163, 184, 0.08);
}

.support-email-link {
  color: var(--q-primary);
  text-decoration: underline;
  font-weight: 500;
}

.faq-list {
  background: rgba(148, 163, 184, 0.05);
}

.legal-links {
  font-size: 13px;
}

.legal-link {
  color: rgba(148, 163, 184, 0.9);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    color: var(--q-primary);
  }
}
</style>
