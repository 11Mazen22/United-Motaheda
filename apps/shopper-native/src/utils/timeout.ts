export function abortTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("The operation was aborted")), ms);
  return controller.signal;
}
