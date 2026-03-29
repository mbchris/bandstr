<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer bordered class="impress-footer">
      <router-link to="/impress" class="impress-link">Impress</router-link>
    </q-footer>
  </q-layout>
</template>

<style scoped>
.impress-footer {
  min-height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
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
</style>
