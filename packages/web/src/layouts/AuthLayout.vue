<script setup lang="ts">
import { Notify, copyToClipboard } from 'quasar'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

async function copyWebAppLink() {
  try {
    await copyToClipboard('https://bandstr.apps.4ki.app')
    Notify.create({ type: 'positive', message: t('dashboard.linkCopied') })
  } catch {
    Notify.create({ type: 'negative', message: t('dashboard.failedCopyInvitationText') })
  }
}
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <video class="auth-video-bg" autoplay muted loop playsinline>
      <source src="/assets/rehearsal_dyn_v2.mp4" type="video/mp4" />
    </video>
    <div class="auth-bg-overlay" />

    <q-page-container>
      <q-page class="auth-start-page">
        <div class="auth-card">
          <div class="text-center q-mb-lg">
            <div class="text-h4 text-weight-bold text-white auth-title">bandstr</div>
            <div class="text-body2 text-grey-4 q-mt-xs">More music. Less chaos. Bandstr!</div>
          </div>
          <p class="text-body2 text-grey-2 q-mb-lg auth-lead">
            Manage your setlists, song votings, calendar entries and keep track of who is bringing the drinks. Bandstr brings the structure you need for focussing on jamming instead of having endless messenger conversations!
          </p>
          <p class="text-body2 text-grey-3 q-mb-md auth-support-copy">
          Please login with your account or create a new one to create or join a band and invite your friends. It's free! 
          </p>
          <p class="text-body2 text-grey-3 q-mb-lg auth-support-copy">
            {{ t('dashboard.shareWebAppPCPreLink') }}<a href="https://bandstr.apps.4ki.app" target="_blank" class="text-primary text-weight-medium" style="text-decoration: underline;">{{ t('dashboard.shareWebAppPCLinkText') }}</a>{{ t('dashboard.shareWebAppPCPostLink') }}
            <q-btn flat round dense size="xs" icon="content_copy" color="grey-4" @click="copyWebAppLink" style="display: inline-flex; vertical-align: middle; margin-left: 4px;">
              <q-tooltip>{{ t('dashboard.copyTooltip') }}</q-tooltip>
            </q-btn>
          </p>
          <router-view />
        </div>
      </q-page>
    </q-page-container>

    <q-footer bordered class="impress-footer">
      <router-link to="/impress" class="impress-link">Impress</router-link>
    </q-footer>
  </q-layout>
</template>

<style lang="scss" scoped>
.auth-video-bg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  z-index: 0;
}

.auth-bg-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, rgba(3, 8, 20, 0.7), rgba(16, 21, 35, 0.45));
  pointer-events: none;
  z-index: 0;
}

.auth-start-page {
  position: relative;
  z-index: 1;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: calc(env(safe-area-inset-top, 0px) + 24px) 16px calc(env(safe-area-inset-bottom, 0px) + 24px);
  background: transparent !important;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
}

.auth-card {
  width: 100%;
  max-width: 560px;
  margin: auto 0;
  padding: 24px;
  border-radius: 18px;
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(8, 13, 25, 0.6);
  box-sizing: border-box;
}

.auth-title {
  letter-spacing: -0.03em;
}

.auth-lead {
  line-height: 1.6;
}

.auth-support-copy {
  line-height: 1.55;
}

@media (max-width: 599px) {
  .auth-start-page {
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 12px calc(env(safe-area-inset-bottom, 0px) + 16px);
  }

  .auth-card {
    padding: 16px;
    border-radius: 14px;
  }
}

.impress-footer {
  min-height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(3, 8, 20, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.impress-link {
  font-size: 12px;
  line-height: 1;
  color: rgba(226, 232, 240, 0.9);
  text-decoration: none;
}

.impress-link:hover {
  text-decoration: underline;
}
</style>
