/**
 * Embedding generation, shared by search-intelligence (query-time embedding)
 * and generate-embeddings (product-time embedding).
 *
 * Runs ENTIRELY inside Supabase — no external API, no API key, nothing
 * outside this platform. Supabase Edge Functions ship a built-in local
 * inference session (`Supabase.ai.Session`) that runs the gte-small embedding
 * model directly in the Edge Runtime (ONNX, on Supabase's own infrastructure).
 * There is no third-party network call anywhere in this file. This is the
 * one and only embedding path — deliberately not provider-configurable,
 * because the whole point is that it never leaves Supabase.
 *
 * gte-small produces 384-dimension vectors — this is why
 * products.embedding / search_products_semantic / set_product_embedding are
 * all vector(384), not the 1536 you'd see with an external OpenAI-style
 * embeddings API.
 */

// `Supabase` is a global injected by the Supabase Edge Runtime — no import
// needed (same pattern as the ambient `Deno` global). Declared here only so
// TypeScript doesn't complain when type-checking this file outside that
// runtime.
declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts?: Record<string, unknown>): Promise<unknown> } };
};

let session: InstanceType<typeof Supabase.ai.Session> | null = null;
function getSession() {
  if (!session) session = new Supabase.ai.Session("gte-small");
  return session;
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(text: string): Promise<number[] | null>;
}

class SupabaseNativeEmbeddingProvider implements EmbeddingProvider {
  readonly name = "supabase-gte-small";

  async embed(text: string): Promise<number[] | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const output = await getSession().run(trimmed, { mean_pool: true, normalize: true });
      return Array.isArray(output) ? (output as number[]) : null;
    } catch (e) {
      console.warn("[embeddings] gte-small inference failed:", e instanceof Error ? e.message : e);
      return null;
    }
  }
}

/** Always returns the same Supabase-native provider — kept as a function
 *  (rather than a plain export) so callers read the same way regardless of
 *  how the provider is obtained, matching providers.ts's resolveProvider(). */
export function resolveEmbeddingProvider(): EmbeddingProvider {
  return new SupabaseNativeEmbeddingProvider();
}
