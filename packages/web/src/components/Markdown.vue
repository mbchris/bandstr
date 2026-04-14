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

const SAFE_TAGS = new Set([
  'A', 'P', 'BR', 'EM', 'STRONG', 'CODE', 'PRE', 'BLOCKQUOTE',
  'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
])

function isSafeUrl(raw: string) {
  const value = raw.trim()
  if (!value) return false
  if (value.startsWith('#') || value.startsWith('/')) return true
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

function sanitizeHtml(unsafeHtml: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(unsafeHtml, 'text/html')

  const removeNode = (node: Element) => {
    const parent = node.parentNode
    if (!parent) return
    while (node.firstChild) parent.insertBefore(node.firstChild, node)
    parent.removeChild(node)
  }

  const elements = Array.from(doc.body.querySelectorAll('*'))
  for (const el of elements) {
    const tag = el.tagName.toUpperCase()
    if (!SAFE_TAGS.has(tag)) {
      removeNode(el)
      continue
    }

    const attrs = Array.from(el.attributes)
    for (const attr of attrs) {
      const name = attr.name.toLowerCase()
      const value = attr.value

      // Strip event handlers and inline styling.
      if (name.startsWith('on') || name === 'style') {
        el.removeAttribute(attr.name)
        continue
      }

      // Only keep safe links.
      if (tag === 'A') {
        if (name === 'href') {
          if (!isSafeUrl(value)) {
            el.removeAttribute('href')
          } else {
            el.setAttribute('rel', 'noopener noreferrer nofollow')
            el.setAttribute('target', '_blank')
          }
          continue
        }
        if (name === 'title' || name === 'rel' || name === 'target') continue
      }

      // No other attributes are needed for current markdown rendering.
      if (!(tag === 'A' && (name === 'href' || name === 'title' || name === 'rel' || name === 'target'))) {
        el.removeAttribute(attr.name)
      }
    }
  }

  return doc.body.innerHTML
}

const rendered = computed(() => {
  if (!props.content) return ''
  const html = marked.parse(props.content, { async: false, breaks: props.breaks ?? false }) as string
  return sanitizeHtml(html)
})
</script>
