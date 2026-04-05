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
      <div class="impress-rev q-mt-md text-caption text-grey-5">Build: {{ gitRev }}</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Markdown from '../components/Markdown.vue'

const router = useRouter()
const gitRev = ref((process.env.GIT_REV ?? 'unknown').trim() || 'unknown')

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}

function goToPrivacy() {
  void router.push('/gdpr')
}

onMounted(async () => {
  try {
    const base = (process.env.API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
    const response = await fetch(`${base}/api/health`)
    if (!response.ok) return
    const payload = (await response.json()) as { version?: string }
    const runtimeRev = (payload.version ?? '').trim()
    if (runtimeRev) {
      gitRev.value = runtimeRev
    }
  } catch {
    // Keep build-time fallback when runtime version cannot be fetched.
  }
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

<style scoped>
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
