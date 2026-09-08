import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'vendor-monaco';
            }
            if (id.includes('pixi.js') || id.includes('pixi-viewport')) {
              return 'vendor-pixi';
            }
            if (id.includes('d3-force') || id.includes('d3-polygon')) {
              return 'vendor-d3';
            }
            if (id.includes('@xyflow')) {
              return 'vendor-xyflow';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-resizable-panels')) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  }
})