import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Temporarily disable react-compiler to see if it's causing issues
      // babel: {
      //   plugins: [['babel-plugin-react-compiler']],
      // },
    }),
  ],
  server: {
    port: 5174,
    open: true,
  },
})
