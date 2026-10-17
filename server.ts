/**
 * APPLICATION ENTRY POINT: server.ts
 * Slim bootstrap launcher adhering to Single Responsibility Principle (SRP)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './server/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = createApp();

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
