import { Image } from "expo-image";

const MAX_CONCURRENT = 4;
const seen = new Set<string>();
let inFlight = 0;
const queue: string[] = [];

export function prefetchImages(urls: ReadonlyArray<string | undefined | null>): void {
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    queue.push(url);
  }
  drain();
}

function drain(): void {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const url = queue.shift()!;
    inFlight++;
    Image.prefetch(url)
      .then(() => {
        // no-op
      })
      .catch(() => {
        // no-op
      })
      .finally(() => {
        inFlight--;
        if (queue.length > 0) drain();
      });
  }
}
