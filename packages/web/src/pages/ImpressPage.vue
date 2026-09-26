<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'vue-router'
import Markdown from '../components/Markdown.vue'
import { fetchRuntimeBuildId, resolveBuildIdFromEnv } from '../composables/buildInfo'

const router = useRouter()
const gitRev = ref(resolveBuildIdFromEnv('unknown'))
const appVersion = ref(Capacitor.isNativePlatform() ? (process.env.APP_VERSION ?? 'unknown').trim() || 'unknown' : 'web')

function goBack() {
  void router.push('/')
}

function goToPrivacy() {
  void router.push('/gdpr')
}

onMounted(async () => {
  const runtimeRev = await fetchRuntimeBuildId()
  if (runtimeRev) gitRev.value = runtimeRev
})

const impressMarkdown = `

## Impressum
**Angaben gemäß § 5 TMG**
Four Keys Interactive GbR
Seestr. 110
71067 Sindelfingen

**Vertreten durch:**
Michael Mew
Christian Schneider
Niklas Arens
Christian Muellerschoen

**Kontakt**
Telefon: +49 (0)7031 / 68 80 421
E-Mail: contact@4ki.app

**Umsatzsteuer-ID**
Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:
beantragt

**Wirtschafts-ID**
Wirtschaftsidentifikationsnummer gemäß § 139 c Abgabenordnung:
beantragt

**Redaktionell Verantwortlicher**
Christian Schneider und Christian Müllerschön
Seestr. 110
71067 Sindelfingen

**EU-Streitschlichtung**
Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/.
Unsere E-Mail-Adresse finden Sie oben im Impressum.

**Verbraucher­streit­beilegung/Universalschlichtungs­stelle**
Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.`
</script>

<template>
  <q-page class="impress-page">
    <div class="impress-content q-pa-md">
      <div class="row items-center q-mb-md impress-back-row">
        <q-btn flat icon="arrow_back" label="Back" @click="goBack" />
      </div>
      <div class="impress-card">
        <Markdown :content="impressMarkdown" :breaks="true" />
      </div>
      <div class="q-mt-md">
        <q-btn
          outline
          color="primary"
          icon="privacy_tip"
          label="Zur Datenschutzerklärung"
          @click="goToPrivacy"
        />
      </div>
      <div class="impress-rev q-mt-md text-caption text-grey-5">
        Build: {{ gitRev }} | App Version: {{ appVersion }}
      </div>
    </div>
  </q-page>
</template>

<style lang="scss" scoped>
.impress-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.impress-content {
  flex: 1;
  max-width: 980px;
  margin: 0 auto;
  width: 100%;
}

.impress-back-row {
  padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
}

.impress-card {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 24px;
}

.impress-rev {
  text-align: right;
}
</style>
