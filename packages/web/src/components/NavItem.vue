<template>
  <q-item :to="to" :exact="exact" clickable v-ripple active-class="text-white bg-grey-9">
    <q-item-section avatar>
      <q-icon :name="icon" />
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ label }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  to: string
  exact?: boolean
}>()
</script>
