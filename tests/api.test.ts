// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import fixture from '../server/data/clients.json';

let server: Server;
let baseUrl: string;
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createApp().listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

describe('Node REST API', () => {
  it('serves the complete unchanged source payload as JSON', async () => {
    const response = await fetch(`${baseUrl}/api/clients`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(fixture);
  });

  it('returns a JSON 404 for unknown API paths', async () => {
    const response = await fetch(`${baseUrl}/api/missing`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Endpoint not found.' });
  });
});
