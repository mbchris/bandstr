<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    peekPercent?: number
    fadeMask?: boolean
    gap?: number
  }>(),
  {
    peekPercent: 16,
    fadeMask: true,
    gap: 14,
  }
)

const containerStyle = computed(() => {
  return {
    gap: `${props.gap}px`,
  }
})
</script>

<template>
  <div class="bleeding-edge-carousel">
    <div
      class="bleeding-edge-container"
      :class="{ 'edge-fade-mask': fadeMask }"
      :style="containerStyle"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.bleeding-edge-carousel {
  position: relative;
  width: 100%;
}
</style>
