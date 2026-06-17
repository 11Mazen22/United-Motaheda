/**
 * Type declarations for lodash.debounce
 *
 * The standalone lodash.debounce package doesn't include its own @types.
 * This minimal declaration allows TypeScript to compile cleanly while
 * preserving runtime behavior.
 */

declare module "lodash.debounce" {
  function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      maxWait?: number;
      trailing?: boolean;
    },
  ): T & { cancel: () => void; flush: () => void };

  export default debounce;
}
