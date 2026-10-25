<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    palette?: string[]
    editable?: boolean
  }>(),
  {
    palette: () => ['#c1c0c3', '#607894', '#3e5976', '#1b334f', '#000000'],
    editable: false
  }
)

const emit = defineEmits<{
  'update:palette': [colors: string[]]
  'change': [index: number, color: string]
}>()

function updateColor(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const updated = [...props.palette]
  updated[index] = input.value
  emit('update:palette', updated)
  emit('change', index, input.value)
}
</script>

<template>
  <div class="palette-bar" role="group" aria-label="Paleta de cores">
    <div
      v-for="(color, index) in palette"
      :key="index"
      class="swatch"
      :style="{ backgroundColor: color }"
    >
      <input
        v-if="editable"
        type="color"
        :value="color"
        class="swatch-picker"
        :aria-label="`Cor ${index + 1}`"
        @input="updateColor(index, $event)"
      >
    </div>
  </div>
</template>

<style scoped>
.palette-bar {
  display: flex;
  inline-size: 100%;
  block-size: 28px;
  overflow: hidden;
}
.swatch {
  flex: 1;
  block-size: 100%;
  position: relative;
}
.swatch-picker {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  opacity: 0;
  cursor: pointer;
  border: 0;
  padding: 0;
}
</style>
