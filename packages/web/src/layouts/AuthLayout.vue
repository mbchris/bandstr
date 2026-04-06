<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="auth-start-page">
        <video class="auth-video-bg" autoplay muted loop playsinline>
          <source src="/assets/rehearsal_dyn_v2.mp4" type="video/mp4" />
        </video>

        <div class="auth-overlay">
          <div class="q-pa-lg auth-card">
            <div class="text-center q-mb-lg">
              <div class="text-h4 text-weight-bold text-white auth-title">bandstr</div>
              <div class="text-body2 text-grey-4 q-mt-xs">Manage. Your. Band.</div>
            </div>
            <p class="text-body2 text-grey-2 q-mb-lg auth-lead">
              Manage your setlists, song votings, calendar entries and keep track of who is bringing the drinks. Bandstr brings the structure you need for focussing on jamming instead of having endless messenger conversations!
              rebum.
            </p>
            <p>
            More music. Less chaos. Bandstr!
            </p>
            <router-view />
          </div>
        </div>
      </q-page>
    </q-page-container>

    <q-footer bordered class="impress-footer">
      <router-link to="/impress" class="impress-link">Impress</router-link>
    </q-footer>
  </q-layout>
</template>

<style scoped>
.auth-start-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.auth-video-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(145deg, rgba(3, 8, 20, 0.7), rgba(16, 21, 35, 0.45));
}

.auth-card {
  width: 100%;
  max-width: 560px;
  border-radius: 18px;
  backdrop-filter: blur(7px);
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(8, 13, 25, 0.6);
}

.auth-title {
  letter-spacing: -0.03em;
}

.auth-lead {
  line-height: 1.6;
}

@media (max-width: 599px) {
  .auth-overlay {
    padding: 14px;
  }
}

.impress-footer {
  min-height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(3, 8, 20, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
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
