<script setup lang="ts">
import { PAPER_FORMATS, buildLayout, type PaperFormatId } from '~/utils/layout'
import { ensureFonts, measureText } from '~/utils/assets'

useHead({
  htmlAttrs: { lang: 'pt-BR' },
  title: 'Spotiframe — pôsteres de capas de álbum'
})

const poster = usePoster()
const formatId = ref<PaperFormatId>('a3')
const fontsReady = ref(false)
const searchRef = ref<{ run: () => Promise<void>; query: string } | null>(null)

// Preview layout always uses the A-series proportions (A3 and A2 share them).
const layout = computed(() => {
  if (!fontsReady.value) return null
  return buildLayout(poster.content, PAPER_FORMATS[formatId.value], measureText)
})

const coverInfo = computed(() => {
  const c = poster.cover.value
  return c ? { width: c.width, height: c.height, source: poster.coverSource.value } : null
})

onMounted(async () => {
  await ensureFonts()
  fontsReady.value = true
  // Start with a sample so the preview is never empty.
  try {
    const results = await poster.search('Californication')
    if (results[0]) {
      if (searchRef.value) searchRef.value.query = 'Californication'
      await poster.selectAlbum(results[0].id)
    }
  } catch {
    /* search is optional on first load */
  }
})
</script>

<template>
  <div class="app">
    <header class="top">
      <h1>Spotiframe</h1>
      <p>Pôsteres de capa de álbum prontos para impressão.</p>
    </header>

    <div class="layout">
      <div class="panel">
        <p v-if="poster.isMock.value" class="notice" role="status">
          Modo demonstração: sem credenciais do Spotify, a busca usa dados de exemplo.
        </p>
        <AlbumSearch ref="searchRef" :search="poster.search" :busy="poster.loading.value" @select="poster.selectAlbum" />
        <p v-if="poster.loading.value" class="msg" role="status">Carregando álbum…</p>
        <p v-if="poster.error.value" class="msg error" role="alert">{{ poster.error.value }}</p>

        <PosterEditor
          :content="poster.content"
          :cover-info="coverInfo"
          @upload="poster.useUploadedCover"
          @recolor="poster.recomputePalette"
        />
        <ExportPanel
          v-model:format="formatId"
          :content="poster.content"
          :cover="poster.cover.value"
          :code="poster.code.value"
        />
      </div>

      <main class="stage" aria-label="Pré-visualização">
        <ClientOnly>
          <PosterPreview
            v-if="layout"
            :layout="layout"
            :cover-url="poster.cover.value?.objectUrl ?? null"
            :cover-size="poster.cover.value ? { width: poster.cover.value.width, height: poster.cover.value.height } : null"
            :code="poster.code.value"
          />
          <template #fallback><p class="msg">Carregando pré-visualização…</p></template>
        </ClientOnly>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  max-inline-size: 90rem;
  margin-inline: auto;
  padding: 1rem clamp(1rem, 3vw, 2rem) 3rem;
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 1rem;
  padding-block: 0.5rem 1.25rem;
}
.top h1 {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}
.top p {
  margin: 0;
  color: #555;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
  gap: clamp(1.5rem, 4vw, 3rem);
  align-items: start;
}
.panel {
  display: grid;
  gap: 2rem;
}
.stage {
  position: sticky;
  inset-block-start: 1rem;
  padding-block-end: 1rem;
}
.notice {
  margin: 0;
  padding: 0.6rem 0.75rem;
  background: #fff7e0;
  border: 1px solid #e8d48a;
  font-size: 0.8125rem;
}
@media (max-width: 56rem) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .stage {
    position: static;
    order: -1;
  }
}
</style>
