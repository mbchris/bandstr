<script setup lang="ts">
import { onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'

onMounted(() => {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    document.body.classList.add('is-android-native')
  }
})
</script>

<template>
  <router-view />
</template>
