import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': [
            '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover', '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip', '@radix-ui/react-select',
            '@radix-ui/react-accordion', '@radix-ui/react-checkbox',
            '@radix-ui/react-switch', '@radix-ui/react-label',
            '@radix-ui/react-scroll-area', '@radix-ui/react-separator',
            '@radix-ui/react-toast', '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group', '@radix-ui/react-slider',
            '@radix-ui/react-radio-group', '@radix-ui/react-progress',
            '@radix-ui/react-collapsible', '@radix-ui/react-hover-card',
            '@radix-ui/react-context-menu', '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu', '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar', '@radix-ui/react-aspect-ratio',
          ],
          'vendor-charts': ['recharts', 'd3-scale'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-dates': ['date-fns'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-markdown': ['react-markdown'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-misc': ['sonner', 'cmdk', 'vaul', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
}));
