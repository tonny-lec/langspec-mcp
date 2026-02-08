import { createLogger } from './logger.js';

const log = createLogger('Retry');

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

function defaultIsRetryable(error: unknown): boolean {
  // TypeError usually indicates DNS/connection failure
  if (error instanceof TypeError) return true;

  if (error instanceof FetchError) {
    // 429 Too Many Requests
    if (error.status === 429) return true;
    // 5xx Server Errors
    if (error.status >= 500 && error.status <= 599) return true;
    // Client errors (except 429) are not retryable
    return false;
  }

  // AbortError from timeout
  if (error instanceof DOMException && error.name === 'AbortError') return true;

  return false;
}

function jitter(baseMs: number): number {
  // ±25% jitter
  const factor = 0.75 + Math.random() * 0.5;
  return Math.round(baseMs * factor);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const initialDelayMs = opts.initialDelayMs ?? 1000;
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      let delayMs: number;

      // Respect Retry-After header if present
      if (error instanceof FetchError && error.retryAfter != null) {
        delayMs = error.retryAfter * 1000;
      } else {
        delayMs = jitter(initialDelayMs * Math.pow(2, attempt));
      }

      log.warn('Retrying after error', {
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  // Try parsing as seconds (integer)
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds >= 0) return seconds;

  // Try parsing as HTTP-date
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const delaySec = Math.max(0, Math.ceil((date - Date.now()) / 1000));
    return delaySec;
  }

  return undefined;
}
