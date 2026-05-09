import { logger } from "./logger";

export const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  // FIX: Remove "Accept-Encoding: gzip, deflate, br" — Node's fetch does NOT
  // automatically decompress responses the way browsers do. Sending this header
  // tells the server to compress, but the raw compressed bytes arrive and
  // res.text() / res.json() reads gibberish. This is the #1 cause of RSS and
  // API parse failures in server-side Node fetch. Let Node negotiate its own encoding.
  "DNT": "1",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

function normalizeHeaders(headers?: unknown): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;
  const hdrs = new Headers(headers as any);
  hdrs.forEach((value, key) => {
    normalized[key] = value;
  });
  return normalized;
}

function shouldRetry(error: unknown, response?: Response): boolean {
  if (error) return true;
  if (!response) return true;
  // FIX: Do NOT retry 429 here — callers handle 429 with their own backoff logic
  // (e.g. CoinGecko respects Retry-After). Retrying 429 immediately just burns
  // the attempt budget and prolongs the lockout window.
  if (response.status === 429) return false;
  if (response.status >= 500) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 3,
  timeoutMs = 15000,
): Promise<Response> {
  const headers = {
    ...DEFAULT_BROWSER_HEADERS,
    ...normalizeHeaders(init.headers),
  };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // FIX: Create a fresh AbortSignal per attempt. The original code reused
    // `init.signal ?? AbortSignal.timeout(timeoutMs)` — if init.signal is
    // undefined, AbortSignal.timeout() is evaluated ONCE outside the loop
    // (because of how JS short-circuit evaluation works with ??), so by attempt 2
    // the signal is already expired and every retry aborts immediately.
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal,
      });

      if (response.ok) {
        if (attempt > 1) {
          logger.info({ url, attempt }, "Successful fetch after retries");
        }
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
      if (!shouldRetry(null, response) || attempt === attempts) {
        logger.error({ url, status: response.status, attempt }, "Fetch failed with final status");
        return response;
      }

      logger.warn({ url, status: response.status, attempt }, "Fetch returned retryable status, retrying");
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !shouldRetry(err)) {
        logger.error({ url, err, attempt }, "Fetch failed with non-retryable error");
        throw err;
      }
      logger.warn({ url, err, attempt }, "Fetch error, retrying");
    }

    const backoffMs = 500 * attempt;
    await sleep(backoffMs);
  }

  throw lastError;
}
