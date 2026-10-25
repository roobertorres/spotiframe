<script setup lang="ts">
import type { PosterContent } from '~/utils/layout'

const props = defineProps<{
  content: PosterContent
  coverInfo: { width: number; height: number; source: string } | null
}>()
const emit = defineEmits<{ upload: [file: File]; recolor: [] }>()

const tracksText = computed({
  get: () => props.content.tracks.join('\n'),
  set: (v: string) => {
    props.content.tracks = v.split('\n')
  }
})

const lowRes = computed(() => !!props.coverInfo && Math.min(props.coverInfo.width, props.coverInfo.height) < 2000)

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload', file)
  input.value = ''
}
</script>

<template>
  <section aria-labelledby="edit-h">
    <h2 id="edit-h">2. Editar</h2>

    <div class="field">
      <label for="f-title">Nome do álbum</label>
      <input id="f-title" v-model="content.title" name="title" type="text" autocomplete="off">
    </div>

    <div class="field">
      <label for="f-artist">Artista</label>
      <input id="f-artist" v-model="content.artist" name="artist" type="text" autocomplete="off">
      <label class="check"><input v-model="content.showArtist" type="checkbox" name="showArtist"> Mostrar artista no pôster</label>
    </div>

    <div class="two">
      <div class="field">
        <label for="f-date">Data</label>
        <input id="f-date" v-model="content.releaseDate" name="date" type="text" autocomplete="off">
      </div>
      <div class="field">
        <label for="f-dur">Duração</label>
        <input id="f-dur" v-model="content.totalDuration" name="duration" type="text" autocomplete="off">
      </div>
    </div>

    <div class="field">
      <label for="f-tracks">Faixas (uma por linha)</label>
      <textarea id="f-tracks" v-model="tracksText" name="tracks" rows="8" spellcheck="false" />
    </div>

    <fieldset class="field">
      <legend>Paleta (claro → escuro)</legend>
      <div class="swatches">
        <label v-for="(_, i) in content.palette" :key="i" class="swatch">
          <span class="visually-hidden">Cor {{ i + 1 }}</span>
          <input v-model="content.palette[i]" type="color" :name="`palette-${i}`">
        </label>
        <button type="button" @click="emit('recolor')">Recalcular da capa</button>
      </div>
    </fieldset>

    <div class="field">
      <label for="f-cover">Substituir capa (ex.: do musichoarders)</label>
      <input id="f-cover" type="file" accept="image/*" @change="onFile">
      <p v-if="coverInfo" id="cover-info" class="hint">
        Capa atual: {{ coverInfo.width }}×{{ coverInfo.height }} px ({{ coverInfo.source }})
      </p>
      <p v-if="lowRes" class="hint warn" role="status">
        Resolução baixa para impressão em A3 ou maior (ideal: 3000 px ou mais). Considere enviar uma capa maior.
      </p>
    </div>
  </section>
</template>

<style scoped>
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-weight: 400;
  margin-block-start: 0.5rem;
}
.check input {
  inline-size: 1.125rem;
  block-size: 1.125rem;
  min-block-size: 0;
  accent-color: #000;
}
fieldset {
  border: 0;
  padding: 0;
  margin-inline: 0;
}
legend {
  padding: 0;
  font-weight: 600;
  font-size: 0.8125rem;
  margin-block-end: 0.35rem;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.swatch input {
  inline-size: 2.75rem;
  block-size: 2.75rem;
  padding: 0;
  border: 1px solid var(--line);
  background: none;
  cursor: pointer;
}
.hint {
  margin: 0.4rem 0 0;
  font-size: 0.8125rem;
  color: #555;
}
.warn {
  color: #9a4a00;
}
</style>
