import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, '../HTMLPrototype/src/engine'),
      '@filmstate': resolve(__dirname, '../HTMLPrototype/src/state.js'),
    },
  },
  base: '/FilmRecipe/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
    passWithNoTests: true,
  },
})
