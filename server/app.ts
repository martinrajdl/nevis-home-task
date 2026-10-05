import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import clients from './data/clients.json' with { type: 'json' };

export function createApp(staticDirectory?: string) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/clients', (_request, response) => {
    response.json(clients);
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Endpoint not found.' });
  });

  if (staticDirectory && existsSync(join(staticDirectory, 'index.html'))) {
    app.use(express.static(staticDirectory));
    app.get('/', (_request, response) => response.sendFile(join(staticDirectory, 'index.html')));
  }

  return app;
}
