<template>
  <div v-if="content" v-html="rendered" class="markdown-content" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps<{
  content?: string | null
  breaks?: boolean
}>()

const rendered = computed(() => {
  if (!props.content) return ''
  return marked.parse(props.content, { async: false, breaks: props.breaks ?? false }) as string
})
</script>
