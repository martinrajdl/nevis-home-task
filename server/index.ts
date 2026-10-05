import { resolve } from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const server = createApp(resolve('dist/client')).listen(port, '127.0.0.1', () => {
  console.info(`Clients API: http://127.0.0.1:${port}/api/clients`);
});

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close());
}
