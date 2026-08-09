/**
 * Timeout utility for async operations
 * Races a promise against a timeout to prevent indefinite hangs
 */

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 8000,
  label = 'operation'
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffMultiplier?: number;
    timeout?: number;
    label?: string;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 2,
    initialDelay = 1000,
    backoffMultiplier = 1.5,
    timeout = 8000,
    label = 'operation',
    shouldRetry = () => true,
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${label}] Attempt ${attempt + 1}/${maxRetries + 1}`);
      const startTime = Date.now();

      const result = await withTimeout(fn(), timeout, label);

      const duration = Date.now() - startTime;
      console.log(`[${label}] Succeeded in ${duration}ms on attempt ${attempt + 1}`);

      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`[${label}] Attempt ${attempt + 1} failed:`, error.message);

      if (attempt < maxRetries && shouldRetry(error)) {
        console.log(`[${label}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }

  console.error(`[${label}] All attempts exhausted`);
  throw lastError;
}
