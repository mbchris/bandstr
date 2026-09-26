<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Markdown from '../components/Markdown.vue'
import { fetchRuntimeBuildId, resolveBuildIdFromEnv } from '../composables/buildInfo'

const router = useRouter()
const gitRev = ref(resolveBuildIdFromEnv('unknown'))

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}

onMounted(async () => {
  const runtimeRev = await fetchRuntimeBuildId()
  if (runtimeRev) gitRev.value = runtimeRev
})

const gdprMarkdown = `

## Datenschutzerklärung
Stand: 30.03.2026

### 1. Verantwortlicher
Four Keys Interactive GbR  
Seestr. 110  
71067 Sindelfingen  
Deutschland  
E-Mail: contact@4ki.app  
Telefon: +49 (0)7031 / 68 80 421

### 2. Zweck und Umfang der Datenverarbeitung
Wir verarbeiten personenbezogene Daten, um die bandstr-App technisch bereitzustellen, Nutzer zu authentifizieren, Bandfunktionen auszuführen und (optional) kostenpflichtige Tarife abzuwickeln.

Die Verarbeitung erfolgt insbesondere für:
- Anmeldung und Kontoverwaltung
- Verwaltung von Bands und Mitgliedschaften
- Funktionen für Songs, Voting, Setlist, Proben/Kalender und persönliche Notizen
- Abrechnung von Pro-Funktionen
- IT-Sicherheit, Missbrauchserkennung und Fehleranalyse

### 3. Welche Daten wir verarbeiten
Je nach Nutzung verarbeiten wir folgende Datenkategorien:

**a) Kontodaten (Login)**
- Name
- E-Mail-Adresse
- optional Profilbild
- technische Konto-/Providerkennungen (bei Google/GitHub-Anmeldung)

**b) Sitzungs- und Sicherheitsdaten**
- Session-Token
- Ablaufzeitpunkte von Sessions
- IP-Adresse
- User-Agent (Browser-/App-Informationen)

**c) Band- und Mitgliedsdaten**
- Bandname, Band-Slug, ggf. Bandlogo
- Rollen und Mitgliedschaften (Owner/Admin/Member)
- bandinterne Status-/Sortierinformationen

**d) Inhaltsdaten innerhalb der App**
- Songs (Titel, Artist, Links, Notizen, Reihenfolgen)
- Votes und Kommentare
- Kalender-/Terminangaben (z. B. Proben, Gigs, Verfügbarkeiten)
- persönliche Song-Notizen

**e) Abrechnungsdaten (falls Pro gebucht wird)**
- gewählter Plan und Abo-Status
- Stripe-Kunden-ID und Stripe-Subscription-ID
- bei Android In-App-Billing: Produkt-ID sowie ein technischer Kauf-Token-Ausschnitt zur Zuordnung

### 4. Lokale Speicherung auf deinem Endgerät
Die Web-/App-Anwendung speichert erforderliche Informationen lokal (z. B. Token, aktive Band, Spracheinstellungen), um die Nutzung und Anmeldung zu ermöglichen.
Diese Speicherung erfolgt auf Grundlage von § 25 Abs. 2 TDDDG (technisch erforderlich) sowie Art. 6 Abs. 1 lit. b und f DSGVO.

### 5. Rechtsgrundlagen (Art. 6 DSGVO)
Wir verarbeiten Daten auf folgenden Rechtsgrundlagen:
- Art. 6 Abs. 1 lit. b DSGVO (Vertrag / vorvertragliche Maßnahmen): Betrieb der App-Funktionen
- Art. 6 Abs. 1 lit. c DSGVO (rechtliche Pflichten): z. B. handels-/steuerrechtliche Aufbewahrung
- Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse): IT-Sicherheit, Stabilität, Missbrauchsprävention

Soweit eine Einwilligung erforderlich ist, verarbeiten wir auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO.

### 6. Empfänger und Dienstleister
Wir setzen zur Leistungserbringung Dienstleister ein, insbesondere:
- Hosting-/Infrastruktur-Anbieter (Betrieb der Anwendung)
- Better Auth (Authentifizierungs-Framework im Backend)
- OAuth-Anbieter: Google und/oder GitHub (nur bei Nutzung der Social-Login-Funktion)
- Stripe (Zahlungsabwicklung für Web-Abos)
- Google Play Billing (Abrechnung in der Android-App, falls genutzt)
- Spotify oEmbed (wenn Spotify-Links zur Metadaten-Abfrage genutzt werden)

Eine Übermittlung in Drittländer (insbesondere USA) kann bei einzelnen Diensten nicht ausgeschlossen werden. Sofern erforderlich, erfolgt sie auf Basis geeigneter Garantien (z. B. EU-Standardvertragsklauseln oder Angemessenheitsbeschluss).

### 7. Speicherdauer
Wir speichern personenbezogene Daten nur so lange, wie sie für die genannten Zwecke erforderlich sind.
- Konten-/Banddaten: bis zur Löschung des Kontos bzw. der Band, soweit keine gesetzlichen Pflichten entgegenstehen
- Sessions/Token: bis Logout, Widerruf oder Ablauf
- Abrechnungsbezogene Daten: nach gesetzlichen Aufbewahrungsfristen

### 8. Betroffenenrechte
Du hast nach DSGVO insbesondere das Recht auf:
- Auskunft (Art. 15 DSGVO)
- Berichtigung (Art. 16 DSGVO)
- Löschung (Art. 17 DSGVO)
- Einschränkung der Verarbeitung (Art. 18 DSGVO)
- Datenübertragbarkeit (Art. 20 DSGVO)
- Widerspruch gegen Verarbeitungen auf Basis von Art. 6 Abs. 1 lit. e/f DSGVO (Art. 21 DSGVO)
- Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft

Zur Ausübung deiner Rechte kontaktiere uns unter: contact@4ki.app

### 9. Beschwerderecht bei einer Aufsichtsbehörde
Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren.
Zuständig für uns ist insbesondere:
Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg.

### 10. Änderung dieser Datenschutzerklärung
Wir können diese Datenschutzerklärung aktualisieren, wenn sich Funktionen, rechtliche Anforderungen oder Datenverarbeitungen ändern. Es gilt jeweils die hier veröffentlichte Fassung.
`
</script>

<template>
  <q-page class="gdpr-page">
    <div class="gdpr-content q-pa-md">
      <div class="row items-center q-mb-md gdpr-back-row">
        <q-btn flat icon="arrow_back" label="Back" @click="goBack" />
      </div>
      <div class="gdpr-card">
        <Markdown :content="gdprMarkdown" :breaks="true" />
      </div>
      <div class="gdpr-rev q-mt-md text-caption text-grey-5">Build: {{ gitRev }}</div>
    </div>
  </q-page>
</template>

<style lang="scss" scoped>
.gdpr-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.gdpr-content {
  flex: 1;
  max-width: 980px;
  margin: 0 auto;
  width: 100%;
}

.gdpr-back-row {
  padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
}

.gdpr-card {
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  padding: 24px;
}

.gdpr-rev {
  text-align: right;
}
</style>
