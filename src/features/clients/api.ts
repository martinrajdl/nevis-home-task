import { useQuery } from '@tanstack/react-query';
import { InvalidClientDataError, parseClientBook } from './model';

export class ClientRequestError extends Error {
  readonly kind: 'network' | 'http';
  readonly status?: number;

  constructor(kind: 'network' | 'http', status?: number, cause?: unknown) {
    super(kind === 'network' ? 'Client data server could not be reached.' : `Client data request failed (${status}).`, { cause });
    this.name = 'ClientRequestError';
    this.kind = kind;
    this.status = status;
  }
}

export function getClientErrorMessage(error: unknown): string {
  if (error instanceof InvalidClientDataError) {
    return 'The client data is incomplete or has an unexpected format. Please try again.';
  }
  if (error instanceof ClientRequestError) {
    return error.kind === 'network'
      ? 'We couldn’t reach the server. Check your connection and try again.'
      : 'The server couldn’t return your client data. Please try again.';
  }
  return 'We couldn’t retrieve your client data. Please try again.';
}

export async function fetchClientBook(signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch('/api/clients', { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ClientRequestError('network', undefined, error);
  }
  if (!response.ok) throw new ClientRequestError('http', response.status);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new InvalidClientDataError();
    throw error;
  }
  return parseClientBook(payload);
}

export function useClientBook() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: ({ signal }) => fetchClientBook(signal),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
