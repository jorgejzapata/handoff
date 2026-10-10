import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { PROD } from './src/firebaseProjects.ts'

// `npm run build:prod` builds with --mode prod for handoffsublease.com.
// Every other build (and `npm run dev`) is the dev project, which search
// engines are told not to index.
function noindexOutsideProd(mode: string): Plugin {
  return {
    name: 'handoff-noindex',
    transformIndexHtml: (html) =>
      mode === 'prod' ? html : html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>'),
  }
}

export default defineConfig(({ mode }) => {
  if (mode === 'prod' && !PROD.projectId)
    throw new Error('Paste the handoff-prod web config into src/firebaseProjects.ts before building for prod.')
  return { plugins: [react(), noindexOutsideProd(mode)] }
})
