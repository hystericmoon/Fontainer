import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import {
  createApiApp,
  fetchLiveGoogleFontsCatalog,
  sweepExpiredCaches,
} from './server/apiApp.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApiApp({ enableCompression: true });

  // Mount Vite dev middleware in development, or serve dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: 'spa',
    });

    // In Vite 8 middlewareMode with ws/hmr disabled, /@vite/client still attempts
    // a WebSocket connection to port 24678 (unavailable behind Cloud Run proxies).
    // Serve a clean WebSocket-free client shim preserving CSS injection & HMR stubs.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  }
  style.textContent = content;
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    // Cache fingerprinted Vite asset bundles aggressively; keep HTML uncached for instant deploys
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      }),
    );
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const sweepTimer = setInterval(sweepExpiredCaches, 5 * 60_000);
  sweepTimer.unref();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fontainer server listening on http://0.0.0.0:${PORT}`);
  });

  // Pre-warm the Google Fonts catalog cache on startup without blocking listen
  void fetchLiveGoogleFontsCatalog().catch(() => {
    // Will retry lazily on the first client request
  });

  // Graceful shutdown for Cloud Run rolling deployments
  const shutdown = (signal: string) => {
    console.log(`[Fontainer] Received ${signal}, draining connections...`);
    clearInterval(sweepTimer);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void startServer();
