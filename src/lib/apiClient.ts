export interface ApiError {
  message: string;
  cause?: unknown;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status?: number; error: ApiError };

async function tryParseJson(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    console.warn('[apiClient] Failed to parse JSON response body', error);
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const error = record.error;
    const message = record.message;
    if (typeof error === 'string') {
      return error;
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback;
}

export async function safeFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  parser?: (response: Response) => Promise<T>
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(input, init);
    const status = response.status;

    if (!response.ok) {
      const errorPayload = await tryParseJson(response);
      const message = extractErrorMessage(
        errorPayload,
        response.statusText || 'Request failed'
      );

      return {
        ok: false,
        status,
        error: {
          message,
          cause: errorPayload,
        },
      };
    }

    let data: unknown;

    if (parser) {
      data = await parser(response);
    } else if (status === 204) {
      data = null;
    } else {
      data = await tryParseJson(response);
    }

    if (data === null || data === undefined) {
      return {
        ok: false,
        status,
        error: { message: 'Empty response body' },
      };
    }

    return {
      ok: true,
      status,
      data: data as T,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';

    return {
      ok: false,
      error: {
        message,
        cause: error,
      },
    };
  }
}
