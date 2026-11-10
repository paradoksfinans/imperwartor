import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite-Konfiguration fuer das Projekt "Empire Tactics".
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});
