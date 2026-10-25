// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-23',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Cloudflare Workers runtime deployment via Nitro
  nitro: {
    preset: 'cloudflare-module'
  },

  // Server-only runtime secrets (isolated from client bundle)
  runtimeConfig: {
    spotifyClientId: '',
    spotifyClientSecret: '',
    public: {}
  }
})
