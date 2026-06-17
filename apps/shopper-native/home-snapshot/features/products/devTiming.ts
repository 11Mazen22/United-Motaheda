/**
 * Lightweight dev instrumentation for snapshot APIs.
 */

export async function timed<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
  if (!__DEV__) return Promise.resolve(fn());
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[timed] ${label}: ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[timed] ${label}: FAILED after ${duration}ms`);
    throw error;
  }
}

export function timedMark(category: string, message: string): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[mark/${category}] ${message}`);
}
