<template>
  <q-page class="error-page">
    <div class="error-body text-center">
      <div class="text-h1 text-weight-thin q-mb-md">404</div>
      <div class="text-h6 q-mb-lg">Page not found</div>
      <q-btn color="primary" label="Go home" unelevated to="/" />
    </div>
    <div class="error-footer">
      <router-link to="/impress" class="impress-link">Impress</router-link>
    </div>
  </q-page>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.error-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.error-footer {
  min-height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.impress-link {
  font-size: 12px;
  color: rgba(100, 116, 139, 1);
  text-decoration: none;
}

.impress-link:hover {
  text-decoration: underline;
}
</style>
