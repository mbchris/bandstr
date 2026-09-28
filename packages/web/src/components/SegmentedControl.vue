<script setup lang="ts">
export interface SegmentOption {
  label: string
  value: string
  badge?: number | string | null
  badgeColor?: string
}

defineProps<{
  modelValue: string
  options: SegmentOption[]
  dense?: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="segmented-control row no-wrap items-center">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="segmented-control__btn row items-center justify-center no-wrap cursor-pointer"
      :class="{
        'segmented-control__btn--active': modelValue === opt.value,
        'segmented-control__btn--dense': dense,
      }"
      @click="$emit('update:modelValue', opt.value)"
    >
      <span class="segmented-control__label">{{ opt.label }}</span>
      <q-badge
        v-if="opt.badge !== undefined && opt.badge !== null"
        :color="opt.badgeColor || (modelValue === opt.value ? 'primary' : 'grey-7')"
        rounded
        class="q-ml-xs text-weight-bold"
      >
        {{ opt.badge }}
      </q-badge>
    </button>
  </div>
</template>

<style scoped lang="scss">
.segmented-control {
  background: rgba(118, 118, 128, 0.12);
  border-radius: 10px;
  padding: 3px;
  display: inline-flex;
  width: fit-content;
  user-select: none;
  border: none;

  &__btn {
    border: none;
    background: transparent;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    line-height: 1.2;

    &:hover:not(&--active) {
      color: var(--text);
    }

    &--dense {
      padding: 4px 10px;
      font-size: 12px;
    }

    &--active {
      background: var(--surface) !important;
      color: var(--text) !important;
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }
  }

  &__label {
    white-space: nowrap;
  }
}

body.body--dark {
  .segmented-control {
    background: rgba(255, 255, 255, 0.08);

    &__btn--active {
      background: var(--surface-raised) !important;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    }
  }
}
</style>
