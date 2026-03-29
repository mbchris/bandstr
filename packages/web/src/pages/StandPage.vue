<template>
  <q-page padding class="flex flex-center">
    <div class="column items-center q-gutter-lg" style="max-width: 500px; width: 100%">
      <div class="text-center">
        <div class="text-h4 text-weight-black text-primary">Bend a Stand</div>
        <div class="text-caption text-grey" style="max-width: 400px">
          Focus your strength! Only the area you touch will warp under the pressure. The more you bend, the more strength points you earn!
        </div>
      </div>

      <!-- Score -->
      <div class="text-center">
        <div class="text-overline text-grey">Strength Points</div>
        <div class="text-h2 text-weight-black text-primary" :class="{ 'scale-up': isBending }">
          {{ Math.floor(score) }}
        </div>
      </div>

      <!-- Game Area -->
      <div
        ref="gameArea"
        class="game-area"
        @mousedown="startBend"
        @mousemove="handleMouseMove"
        @mouseleave="stopBend"
        @mouseup="stopBend"
        @touchstart="startBend"
        @touchmove="handleTouchMove"
        @touchend="stopBend"
      >
        <div class="stand-container">
          <!-- Ghost layer -->
          <svg fill="currentColor" class="stand-ghost" viewBox="0 0 201.862 201.862" xmlns="http://www.w3.org/2000/svg">
            <path d="M100.931,201.861c-1.104,0-2-0.896-2-2V167.03l-36.146,34.282c-0.801,0.761-2.068,0.727-2.828-0.075c-0.76-0.801-0.727-2.067,0.075-2.827l38.899-36.893V80.284H37.464c-0.288,0-0.561-0.061-0.808-0.17c-0.234-0.104-0.452-0.253-0.639-0.45c-0.022-0.023-0.044-0.047-0.065-0.071c-0.155-0.179-0.272-0.377-0.354-0.586c0,0,0-0.003-0.001-0.005c-0.071-0.186-0.116-0.385-0.129-0.592v-0.002l0-0.003c-0.002-0.043-0.003-0.086-0.003-0.129V17.632c0-1.104,0.896-2,2-2H70.56V2c0-1.104,0.896-2,2-2h56.742c1.104,0,2,0.896,2,2v13.632h33.095c1.104,0,2,0.896,2,2v60.646c0,0.029,0,0.059-0.001,0.089c-0.001,0.002,0,0.003,0,0.005c-0.01,0.228-0.058,0.444-0.137,0.646c-0.091,0.231-0.228,0.449-0.409,0.641l0,0.001c-0.001,0.001-0.002,0.002-0.004,0.004l0,0c-0.001,0.002-0.003,0.003-0.004,0.004h0l-0.001,0.002c-0.189,0.197-0.409,0.347-0.644,0.448c-0.244,0.107-0.514,0.166-0.798,0.166h-61.466v81.233l38.741,36.742c0.801,0.76,0.835,2.026,0.075,2.827c-0.76,0.802-2.025,0.836-2.828,0.075l-35.988-34.132v32.831C102.931,200.966,102.036,201.861,100.931,201.861z M131.302,76.284h28.13l-28.13-27.048V76.284z M74.56,76.284h52.742V4H74.56V76.284z M42.531,76.284H70.56V50.068L42.531,76.284z M39.464,19.632v54.043L70.56,44.592v-24.96H39.464z M131.302,43.688l31.095,29.899V19.632h-31.095V43.688z M114.148,34.102H87.767c-1.104,0-2-0.896-2-2s0.896-2,2-2h26.381c1.104,0,2,0.896,2,2S115.253,34.102,114.148,34.102z M120.648,24.262H81.267c-1.104,0-2-0.896-2-2s0.896-2,2-2h39.381c1.104,0,2,0.896,2,2S121.753,24.262,120.648,24.262z" />
          </svg>

          <!-- Bent layer -->
          <div
            class="stand-bent"
            :style="{
              clipPath: `circle(400px at ${mouseXRel}px ${mouseYRel}px)`,
              transform: `skewX(${bendDepth}deg)`,
              transformOrigin: `${mouseXRel}px ${mouseYRel}px`,
              filter: isBending ? 'brightness(1.2) contrast(1.1)' : 'none',
            }"
          >
            <svg fill="currentColor" class="stand-primary" viewBox="0 0 201.862 201.862" xmlns="http://www.w3.org/2000/svg">
              <path d="M100.931,201.861c-1.104,0-2-0.896-2-2V167.03l-36.146,34.282c-0.801,0.761-2.068,0.727-2.828-0.075c-0.76-0.801-0.727-2.067,0.075-2.827l38.899-36.893V80.284H37.464c-0.288,0-0.561-0.061-0.808-0.17c-0.234-0.104-0.452-0.253-0.639-0.45c-0.022-0.023-0.044-0.047-0.065-0.071c-0.155-0.179-0.272-0.377-0.354-0.586c0,0,0-0.003-0.001-0.005c-0.071-0.186-0.116-0.385-0.129-0.592v-0.002l0-0.003c-0.002-0.043-0.003-0.086-0.003-0.129V17.632c0-1.104,0.896-2,2-2H70.56V2c0-1.104,0.896-2,2-2h56.742c1.104,0,2,0.896,2,2v13.632h33.095c1.104,0,2,0.896,2,2v60.646c0,0.029,0,0.059-0.001,0.089c-0.001,0.002,0,0.003,0,0.005c-0.01,0.228-0.058,0.444-0.137,0.646c-0.091,0.231-0.228,0.449-0.409,0.641l0,0.001c-0.001,0.001-0.002,0.002-0.004,0.004l0,0c-0.001,0.002-0.003,0.003-0.004,0.004h0l-0.001,0.002c-0.189,0.197-0.409,0.347-0.644,0.448c-0.244,0.107-0.514,0.166-0.798,0.166h-61.466v81.233l38.741,36.742c0.801,0.76,0.835,2.026,0.075,2.827c-0.76,0.802-2.025,0.836-2.828,0.075l-35.988-34.132v32.831C102.931,200.966,102.036,201.861,100.931,201.861z M131.302,76.284h28.13l-28.13-27.048V76.284z M74.56,76.284h52.742V4H74.56V76.284z M42.531,76.284H70.56V50.068L42.531,76.284z M39.464,19.632v54.043L70.56,44.592v-24.96H39.464z M131.302,43.688l31.095,29.899V19.632h-31.095V43.688z M114.148,34.102H87.767c-1.104,0-2-0.896-2-2s0.896-2,2-2h26.381c1.104,0,2,0.896,2,2S115.253,34.102,114.148,34.102z M120.648,24.262H81.267c-1.104,0-2-0.896-2-2s0.896-2,2-2h39.381c1.104,0,2,0.896,2,2S121.753,24.262,120.648,24.262z" />
            </svg>
          </div>
        </div>

        <!-- Hint -->
        <div class="hint-text" :class="{ 'opacity-0': isBending }">
          <q-icon name="pan_tool" class="q-mr-xs" /> Click & Pull to Bend
        </div>
      </div>

      <!-- Disclaimer -->
      <q-banner rounded class="bg-orange-1 text-orange-9 text-caption text-weight-bold">
        <template #avatar><q-icon name="warning" color="orange" /></template>
        No actual music stands were harmed in the making of this feature.
      </q-banner>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const score = ref(0)
const bendDepth = ref(0)
const mouseXRel = ref(128)
const mouseYRel = ref(128)
const isBending = ref(false)
const startX = ref(0)
const gameArea = ref<HTMLElement | null>(null)
let scoreInterval: ReturnType<typeof setInterval> | null = null

// Audio
let audioCtx: AudioContext | null = null
let lastHammerTime = 0

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
}

function playHammer() {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(100 + Math.abs(bendDepth.value) * 2, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.1)
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.1)

  const bufferSize = audioCtx.sampleRate * 0.1
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noise = audioCtx.createBufferSource()
  noise.buffer = buffer
  const noiseGain = audioCtx.createGain()
  noiseGain.gain.setValueAtTime(0.1, audioCtx.currentTime)
  noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05)
  noise.connect(noiseGain)
  noiseGain.connect(audioCtx.destination)
  noise.start()
}

function playSqueal(depth: number) {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  const baseFreq = 2000 + Math.abs(depth) * 50
  osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, audioCtx.currentTime + 0.2)
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime)
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.2)
}

function updateMousePosition(clientX: number, clientY: number) {
  if (!gameArea.value) return
  const rect = gameArea.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  mouseXRel.value = clientX - centerX + 128
  mouseYRel.value = clientY - centerY + 128
}

function startScoreAccumulation() {
  if (scoreInterval) clearInterval(scoreInterval)
  scoreInterval = setInterval(() => {
    if (isBending.value) {
      const currentBend = Math.abs(bendDepth.value)
      if (currentBend > 5) {
        score.value += currentBend / 20
        const now = Date.now()
        const hammerInterval = Math.max(100, 400 - currentBend * 5)
        if (now - lastHammerTime > hammerInterval) {
          playHammer()
          lastHammerTime = now
          if (currentBend > 25 && Math.random() > 0.7) playSqueal(currentBend)
        }
      }
    }
  }, 50)
}

function startBend(e: MouseEvent | TouchEvent) {
  initAudio()
  const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX
  const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY
  isBending.value = true
  startX.value = clientX
  updateMousePosition(clientX, clientY)
  playSqueal(0)
  startScoreAccumulation()
}

function handleMouseMove(e: MouseEvent) {
  if (!isBending.value) {
    updateMousePosition(e.clientX, e.clientY)
    return
  }
  const deltaX = e.clientX - startX.value
  const prevDepth = bendDepth.value
  bendDepth.value = Math.max(-45, Math.min(45, deltaX / 5))
  if (Math.abs(bendDepth.value - prevDepth) > 2 && Math.random() > 0.8) playSqueal(bendDepth.value)
  updateMousePosition(e.clientX, e.clientY)
}

function handleTouchMove(e: TouchEvent) {
  if (!isBending.value) return
  const clientX = e.touches[0].clientX
  const clientY = e.touches[0].clientY
  const deltaX = clientX - startX.value
  bendDepth.value = Math.max(-45, Math.min(45, deltaX / 5))
  updateMousePosition(clientX, clientY)
}

function stopBend() {
  if (!isBending.value) return
  isBending.value = false
  playSqueal(bendDepth.value)

  const resetInterval = setInterval(() => {
    if (Math.abs(bendDepth.value) < 1) {
      bendDepth.value = 0
      clearInterval(resetInterval)
    } else {
      bendDepth.value *= 0.8
    }
  }, 20)

  if (scoreInterval) {
    clearInterval(scoreInterval)
    scoreInterval = null
  }
}

onUnmounted(() => {
  if (scoreInterval) clearInterval(scoreInterval)
  if (audioCtx) audioCtx.close()
})
</script>

<style scoped>
.game-area {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 400px;
  background: #f9f9f9;
  border: 2px dashed #e0e0e0;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  overflow: hidden;
  user-select: none;
}
.game-area:active {
  cursor: grabbing;
}
.stand-container {
  position: relative;
  width: 256px;
  height: 256px;
}
.stand-ghost {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: #9e9e9e;
  opacity: 0.2;
  filter: blur(1px);
}
.stand-bent {
  position: absolute;
  inset: 0;
  transition: all 75ms ease-out;
  will-change: transform;
}
.stand-primary {
  width: 100%;
  height: 100%;
  color: var(--q-primary);
}
.hint-text {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9e9e9e;
  pointer-events: none;
  transition: opacity 0.3s;
}
.opacity-0 {
  opacity: 0;
}
.scale-up {
  transform: scale(1.1);
  transition: transform 75ms;
}
</style>
