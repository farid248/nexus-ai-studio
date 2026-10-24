/**
 * Rate-limit-aware retry for the audio endpoints.
 *
 * The Z-AI ASR/TTS services enforce aggressive per-window quotas and return
 * 429 "Too many requests" bursts — especially when a user transcribes or
 * synthesizes several clips in a row. Without a retry, a single 429 surfaces
 * as a raw API error. This helper retries with exponential backoff and lets
 * the caller report each wait to the user.
 */

export interface RetryOptions {
  /** Extra attempts after the first try (default 2 → up to 3 calls total). */
  retries?: number;
  /** Delay before the first retry (default 5000ms). Doubles every attempt. */
  baseDelayMs?: number;
  /** Called before waiting: (attempt, delayMs). */
  onRetry?: (attempt: number, delayMs: number) => void;
}

export function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests/i.test(msg);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 5_000;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Only rate-limit errors are worth retrying — everything else fails fast.
      if (!isRateLimitError(err) || attempt === retries) throw err;
      const delayMs = baseDelayMs * 2 ** attempt;
      opts.onRetry?.(attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError; // unreachable, satisfies the type checker
}

/* ------------------------------------------------------------------ */
/* Transcript language analysis                                        */
/* ------------------------------------------------------------------ */

/**
 * The ASR engine is trained on English & Chinese speech only. Arabic (and
 * other unsupported languages) come back as phonetic approximations that
 * look like the right script but are usually wrong. Detecting the script
 * lets the UI warn the user honestly instead of showing a silently-bad
 * transcript as if it were accurate.
 */
export function detectScript(text: string): "latin" | "arabic" | "cjk" | "other" {
  if (/[\u0600-\u06FF]/.test(text)) return "arabic";
  if (/[\u4E00-\u9FFF\u3040-\u30FF]/.test(text)) return "cjk";
  if (/[A-Za-z]/.test(text)) return "latin";
  return "other";
}
