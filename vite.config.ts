import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/travelplanner/',
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore'
            if (id.includes('firebase/auth')) return 'vendor-firebase-auth'
            if (id.includes('firebase/storage')) return 'vendor-firebase-storage'
            if (id.includes('firebase/app')) return 'vendor-firebase-app'
            if (id.includes('date-fns')) return 'vendor-dates'
            if (id.includes('@amplitude')) return 'vendor-amplitude'
            if (id.includes('lucide-react')) return 'vendor-lucide'
          }
        },
      },
    },
  },
})