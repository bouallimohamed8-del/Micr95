import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT for GitHub Pages:
// Change "mirc95-chat" below to match your repository name exactly.
// Example: if your repo is https://github.com/yourname/my-irc-app,
// then base should be '/my-irc-app/'
// If you deploy to Vercel/Netlify instead, you can leave base as '/'.
export default defineConfig({
  plugins: [react()],
  base: '/mirc95-chat/',
});
