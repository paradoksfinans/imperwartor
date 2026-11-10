import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite-Konfiguration für das Projekt "Empire Tactics".
export default defineConfig(({ command }) => ({
  /**
   * Beim Bauen werden alle Pfade relativ zur index.html gesetzt.
   * Dadurch läuft das Spiel sowohl unter github.io/empire-tactics/ als auch
   * direkt aus dem Ordner dist/, ohne dass Pfade angepasst werden müssen.
   */
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
}));
