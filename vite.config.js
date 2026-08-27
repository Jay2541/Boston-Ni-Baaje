import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        schedule: resolve(__dirname, 'schedule.html'),
        teams: resolve(__dirname, 'teams.html'),
        updates: resolve(__dirname, 'updates.html'),
        discover: resolve(__dirname, 'discover.html'),
        sponsors: resolve(__dirname, 'sponsors.html'),
        app: resolve(__dirname, 'app.html'),
        board: resolve(__dirname, 'board.html'),
        resources: resolve(__dirname, 'resources.html'),
      },
    },
  },
});
