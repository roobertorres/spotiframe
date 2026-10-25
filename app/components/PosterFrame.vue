<script setup lang="ts">
// Realistic black frame moulding component with ISO 216 proportional geometry
</script>

<template>
  <div class="frame" role="region" aria-label="Moldura do pôster">
    <slot />
  </div>
</template>

<style scoped>
.frame {
  inline-size: min(100%, calc((100dvh - 3rem) * 0.68));
  margin-inline: auto;
  padding: 6.2%;
  background: linear-gradient(145deg, #232326, #131315);
  box-shadow:
    0 1.5rem 3rem -1rem rgb(0 0 0 / 0.45),
    inset 0 0 0 1px rgb(255 255 255 / 0.06);
}
</style>
