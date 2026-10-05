import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../server/data/clients.json';
import { App } from './App';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('dashboard request states', () => {
  it('announces loading while the API request is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderApp();
    expect(screen.getByRole('status', { name: 'Loading client data' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('recovers from an API error using the retry button', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture)));
    vi.stubGlobal('fetch', fetchMock);
    renderApp();
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('The server couldn’t return your client data. Please try again.');
    expect(error).not.toHaveTextContent('Check your connection');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Expand Branch 1' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clients',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('treats malformed successful responses as a visible error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...fixture, values: [1] }))),
    );
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'incomplete or has an unexpected format',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('uses connection guidance only when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t reach the server. Check your connection and try again.',
    );
  });

  it('treats invalid JSON as invalid data, not a connection problem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Unexpected response</html>')));
    renderApp();
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('incomplete or has an unexpected format');
    expect(error).not.toHaveTextContent('Check your connection');
  });

  it('does not blame connectivity for a missing API endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server couldn’t return your client data. Please try again.',
    );
  });
});

describe('chart scope', () => {
  it('drills from company to branch, advisor and channel, then returns using breadcrumbs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture)));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderApp();
    const branch = await screen.findByRole('button', { name: 'Show Branch 1 in chart' });
    branch.focus();
    await user.keyboard('{Enter}');
    expect(branch).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Branch 1 clients by advisor' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Branch 1 clients by advisor' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Expand Branch 1' })).toBeInTheDocument();
    const branchChart = screen.getByRole('table', { name: 'Chart values for Branch 1' });
    expect(within(branchChart).getByRole('row', { name: /^August 2024/ })).toHaveTextContent('216214');
    await user.click(screen.getByRole('button', { name: 'Expand Branch 1' }));
    await user.click(screen.getByRole('button', { name: 'Show Anna Blackwood in chart' }));
    expect(screen.getByRole('heading', { name: 'Anna Blackwood clients by acquisition channel' })).toBeVisible();
    const path = screen.getByRole('navigation', { name: 'Chart scope' });
    expect(path).toHaveTextContent('Company/Branch 1/Anna Blackwood');
    await user.click(screen.getByRole('button', { name: 'Expand Anna Blackwood' }));
    await user.click(screen.getByRole('button', { name: 'Show New paid in chart' }));
    expect(screen.getByRole('heading', { name: 'New paid clients' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Expand New paid' })).not.toBeInTheDocument();
    const chartTable = screen.getByRole('table', { name: 'Chart values for New paid' });
    expect(within(chartTable).getAllByRole('row').slice(1).map((row) =>
      within(row).getAllByRole('cell')[0]!.textContent,
    )).toEqual(['0', '0', '1', '1', '2', '1', '0', '2', '1', '1', '1', '2']);

    await user.click(screen.getByRole('button', { name: 'Collapse Company' }));
    expect(screen.getByRole('heading', { name: 'New paid clients' })).toBeVisible();
    await user.click(within(path).getByRole('button', { name: 'Company' }));
    expect(screen.getByRole('heading', { name: 'Company clients by branch' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Expand Company' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['Branch 2', 'Branch 3', 'James Walker'])('charts %s without fabricating missing children', async (name) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture))));
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Expand Branch 1' }));
    await user.click(screen.getByRole('button', { name: `Show ${name} in chart` }));
    expect(screen.getByRole('heading', { name: `${name} clients` })).toBeVisible();
    expect(screen.getByText(/No further breakdown is available\./, { selector: 'header p' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Chart legend' })).toHaveTextContent(name);
    expect(screen.queryByRole('complementary', { name: 'Data differences' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: `Chart values for ${name}` })).getAllByRole('row')).toHaveLength(13);
  });
});
