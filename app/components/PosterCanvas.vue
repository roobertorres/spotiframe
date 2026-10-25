<script setup lang="ts">
import type { PosterLayout } from '~/utils/layout'
import type { VectorCode } from '~/utils/svgVector'
import { FONT_FAMILY } from '~/utils/assets'

const props = withDefaults(
  defineProps<{
    layout?: PosterLayout | null
    coverUrl?: string | null
    code?: VectorCode | null
    coverSize?: { width: number; height: number } | null
  }>(),
  {
    layout: null,
    coverUrl: null,
    code: null,
    coverSize: null
  }
)

const clipId = useId()

function coverRect(op: { x: number; y: number; w: number; h: number }) {
  const size = props.coverSize
  if (!size || size.width <= 0 || size.height <= 0) return { x: op.x, y: op.y, w: op.w, h: op.h }
  const s = op.w / Math.min(size.width, size.height)
  const w = size.width * s
  const h = size.height * s
  return { x: op.x - (w - op.w) / 2, y: op.y - (h - op.h) / 2, w, h }
}
</script>

<template>
  <svg
    v-if="layout && layout.width > 0 && layout.height > 0"
    class="paper"
    :viewBox="`0 0 ${layout.width} ${layout.height}`"
    role="img"
    aria-label="Área do pôster"
    :font-family="`${FONT_FAMILY}, sans-serif`"
  >
    <template v-for="(op, i) in layout.ops" :key="i">
      <rect v-if="op.type === 'rect'" :x="op.x" :y="op.y" :width="op.w" :height="op.h" :fill="op.fill" />
      <line
        v-else-if="op.type === 'line'"
        :x1="op.x1"
        :y1="op.y1"
        :x2="op.x2"
        :y2="op.y2"
        :stroke="op.stroke"
        :stroke-width="Math.max(1, op.width)"
      />
      <text
        v-else-if="op.type === 'text'"
        :x="op.x"
        :y="op.y"
        :font-size="op.size"
        :font-weight="op.weight"
        :text-anchor="op.anchor"
        :fill="op.fill"
      >{{ op.text }}</text>
      <g v-else-if="op.type === 'cover'">
        <clipPath :id="clipId"><rect :x="op.x" :y="op.y" :width="op.w" :height="op.h" /></clipPath>
        <rect :x="op.x" :y="op.y" :width="op.w" :height="op.h" fill="#bdbdc0" />
        <image
          v-if="coverUrl"
          :href="coverUrl"
          :x="coverRect(op).x"
          :y="coverRect(op).y"
          :width="coverRect(op).w"
          :height="coverRect(op).h"
          preserveAspectRatio="none"
          :clip-path="`url(#${clipId})`"
        />
        <text v-else :x="op.x + op.w / 2" :y="op.y + op.h / 2" text-anchor="middle" font-size="44" font-weight="500" fill="#000">Capa do Álbum</text>
      </g>
      <g v-else-if="op.type === 'code' && code" :transform="`translate(${op.x} ${op.y}) scale(${op.w / code.width})`">
        <path v-for="(shape, j) in code.shapes" :key="j" :d="shape.d" :fill="shape.fill" :transform="`translate(${shape.tx} ${shape.ty})`" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.paper {
  display: block;
  inline-size: 100%;
  block-size: auto;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
}
</style>
