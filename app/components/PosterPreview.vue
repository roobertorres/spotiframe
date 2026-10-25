<script setup lang="ts">
import type { PosterLayout } from '~/utils/layout'
import type { VectorCode } from '~/utils/svgVector'
import PosterFrame from '~/components/PosterFrame.vue'
import PosterCanvas from '~/components/PosterCanvas.vue'

defineProps<{
  layout: PosterLayout
  coverUrl: string | null
  code: VectorCode | null
  coverSize: { width: number; height: number } | null
}>()
</script>

<template>
  <PosterFrame>
    <PosterCanvas
      :layout="layout"
      :cover-url="coverUrl"
      :code="code"
      :cover-size="coverSize"
    />
  </PosterFrame>
</template>
