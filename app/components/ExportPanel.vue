<script setup lang="ts">
import { PAPER_FORMATS, buildLayout, type PaperFormatId, type PosterContent } from '~/utils/layout'
import { downloadBlob, ensureFonts, measureText, slugify, type CoverAsset } from '~/utils/assets'
import type { VectorCode } from '~/utils/svgVector'
import { pixelSize } from '~/utils/exportPng'

const props = defineProps<{
  content: PosterContent
  cover: CoverAsset | null
  code: VectorCode | null
}>()

const formatId = defineModel<PaperFormatId>('format', { required: true })
const busy = ref<'pdf' | 'png' | ''>('')
const status = ref('')
const failure = ref('')

const dims = computed(() => pixelSize(PAPER_FORMATS[formatId.value], 300))

async function run(kind: 'pdf' | 'png') {
  if (!props.cover) {
    failure.value = 'Carregue um álbum ou envie uma capa antes de exportar.'
    return
  }
  busy.value = kind
  failure.value = ''
  status.value = kind === 'pdf' ? 'Gerando PDF vetorial…' : 'Renderizando PNG em 300 DPI…'
  try {
    await ensureFonts()
    const format = PAPER_FORMATS[formatId.value]
    const layout = buildLayout(props.content, format, measureText)
    const base = `${slugify(props.content.artist)}-${slugify(props.content.title)}-${format.id}`
    if (kind === 'pdf') {
      const { exportPdf } = await import('~/utils/exportPdf')
      const bytes = await exportPdf({ layout, format, cover: props.cover, code: props.code, title: props.content.title })
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${base}.pdf`)
    } else {
      const { exportPng } = await import('~/utils/exportPng')
      const blob = await exportPng({ layout, format, cover: props.cover, code: props.code, dpi: 300 })
      downloadBlob(blob, `${base}-300dpi.png`)
    }
    status.value = 'Pronto. Arquivo baixado.'
  } catch (e) {
    status.value = ''
    failure.value = e instanceof Error ? e.message : 'A exportação falhou.'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section aria-labelledby="export-h">
    <h2 id="export-h">3. Exportar para gráfica</h2>

    <fieldset>
      <legend>Tamanho do papel</legend>
      <div class="formats">
        <label v-for="f in PAPER_FORMATS" :key="f.id" class="fmt">
          <input v-model="formatId" type="radio" name="format" :value="f.id">
          <span>{{ f.label }}</span>
        </label>
      </div>
    </fieldset>

    <p class="hint">PNG: {{ dims.width }} × {{ dims.height }} px a 300 DPI. PDF: textos e código em vetor, capa na resolução original.</p>

    <div class="actions">
      <button type="button" class="primary" :disabled="!!busy" @click="run('pdf')">Baixar PDF vetorial</button>
      <button type="button" :disabled="!!busy" @click="run('png')">Baixar PNG 300 DPI</button>
    </div>

    <p class="msg" role="status" aria-live="polite">{{ status }}</p>
    <p v-if="failure" class="msg error" role="alert">{{ failure }}</p>
  </section>
</template>

<style scoped>
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
}
legend {
  padding: 0;
  font-weight: 600;
  font-size: 0.8125rem;
  margin-block-end: 0.35rem;
}
.formats {
  display: grid;
  gap: 0.25rem;
}
.fmt {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  min-block-size: 2.5rem;
  font-weight: 400;
}
.fmt input {
  accent-color: #000;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  min-block-size: 0;
}
.hint {
  font-size: 0.8125rem;
  color: #555;
  margin: 0.5rem 0 0.75rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
