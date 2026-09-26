<script setup lang="ts">
import { onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform()
    if (platform === 'android') {
      document.body.classList.add('is-android-native')
    } else if (platform === 'ios') {
      document.body.classList.add('is-ios-native')
    }
  }
})
</script>

<template>
  <router-view />
</template>
