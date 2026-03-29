<template>
  <div class="beer-rain-container" style="pointer-events: none; position: fixed; inset: 0; z-index: 10000; overflow: hidden">
    <div
      v-for="item in items"
      :key="item.id"
      class="beer-item"
      :style="{
        position: 'absolute',
        left: item.left + '%',
        top: '-50px',
        fontSize: '1.5rem',
        animationDelay: item.delay + 's',
        animationDuration: item.duration + 's',
      }"
    >
      {{ item.emoji }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ active: boolean }>()
const emit = defineEmits(['done'])

interface RainItem {
  id: number
  emoji: string
  left: number
  delay: number
  duration: number
}

const items = ref<RainItem[]>([])
const emojis = ['🍺', '🍻', '🍾', '😊', '🥳', '😎', '🎸', '🥁']

function triggerRain() {
  items.value = []
  for (let i = 0; i < 30; i++) {
    items.value.push({
      id: Math.random(),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
    })
  }
  setTimeout(() => {
    items.value = []
    emit('done')
  }, 5000)
}

watch(
  () => props.active,
  (val) => {
    if (val) triggerRain()
  },
)
</script>

<style scoped>
.beer-item {
  animation: drop linear forwards;
}
@keyframes drop {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(360deg);
    opacity: 0;
  }
}
</style>
