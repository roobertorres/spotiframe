<script setup lang="ts">
import type { SearchResultItem } from '#shared/types'

const props = defineProps<{
  search: (q: string) => Promise<SearchResultItem[]>
  busy: boolean
}>()
const emit = defineEmits<{ select: [id: string] }>()

const query = ref('')
const results = ref<SearchResultItem[]>([])
const searching = ref(false)
const failed = ref(false)
const searched = ref(false)

async function run() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  failed.value = false
  try {
    results.value = await props.search(q)
    searched.value = true
  } catch {
    failed.value = true
    results.value = []
  } finally {
    searching.value = false
  }
}

defineExpose({ run, query })
</script>

<template>
  <section aria-labelledby="search-h">
    <h2 id="search-h">1. Álbum</h2>
    <form class="row" role="search" @submit.prevent="run">
      <div class="field grow">
        <label for="album-q">Buscar álbum ou artista</label>
        <input
          id="album-q"
          v-model="query"
          type="search"
          name="q"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="search"
          placeholder="Californication"
          required
        >
      </div>
      <button type="submit" class="primary" :disabled="searching">{{ searching ? 'Buscando…' : 'Buscar' }}</button>
    </form>

    <p v-if="failed" class="msg error" role="alert">A busca falhou. Tente novamente.</p>
    <p v-else-if="searched && !results.length" class="msg" role="status">Nenhum álbum encontrado.</p>

    <ul v-if="results.length" class="results" aria-label="Resultados da busca">
      <li v-for="r in results" :key="r.id">
        <button type="button" :disabled="busy" @click="emit('select', r.id)">
          <img :src="r.coverUrl" alt="" width="48" height="48" loading="lazy">
          <span class="meta">
            <strong>{{ r.name }}</strong>
            <span>{{ r.artist }} · {{ r.releaseDate?.slice(0, 4) }} · {{ r.totalTracks }} faixas</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  gap: 0.5rem;
  align-items: end;
}
.grow {
  flex: 1;
}
.results {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
  max-block-size: 18rem;
  overflow-y: auto;
}
.results button {
  inline-size: 100%;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  text-align: start;
  background: #fff;
  border: 1px solid var(--line);
  padding: 0.4rem;
  min-block-size: 3rem;
}
.results button:hover:not(:disabled) {
  border-color: #000;
}
.results img {
  inline-size: 48px;
  block-size: 48px;
  object-fit: cover;
  background: #ddd;
}
.meta {
  display: grid;
  min-inline-size: 0;
  font-size: 0.8125rem;
  color: #555;
}
.meta strong {
  color: #000;
  font-size: 0.9375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
