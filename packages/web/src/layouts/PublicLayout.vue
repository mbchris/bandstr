<script setup lang="ts">
// Public layout
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer bordered class="impress-footer">
      <div class="footer-links">
        <router-link to="/impress" class="impress-link">Impress</router-link>
        <span class="footer-separator">|</span>
        <router-link to="/gdpr" class="impress-link">Datenschutz</router-link>
      </div>
    </q-footer>
  </q-layout>
</template>

<style lang="scss" scoped>
.impress-footer {
  min-height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.footer-links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.impress-link {
  font-size: 12px;
  line-height: 1;
  color: rgba(100, 116, 139, 1);
  text-decoration: none;
}

.impress-link:hover {
  text-decoration: underline;
}

.footer-separator {
  color: rgba(100, 116, 139, 0.6);
  font-size: 12px;
  line-height: 1;
}
</style>
