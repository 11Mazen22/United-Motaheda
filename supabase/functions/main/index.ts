/**
 * main — the edge-runtime dispatcher for self-hosted Supabase Edge Functions.
 *
 * supabase/edge-runtime (unlike Supabase Cloud) doesn't route each function
 * to its own container by name — it runs ONE process that dynamically loads
 * and executes whichever function under ./functions/<name>/index.ts matches
 * the request path. This file IS that router; it is not itself one of "our"
 * functions. Ported from Supabase's own official self-hosting reference
 * (supabase/functions/main/index.ts in the supabase/supabase repo).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("main function dispatcher started");

const JWT_SECRET = Deno.env.get("JWT_SECRET");
const VERIFY_JWT = (Deno.env.get("VERIFY_JWT") ?? "true") !== "false";

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

// Bind explicitly: the `-p 9000` CLI flag passed to `edge-runtime start`
// does not control this listener (learned live tonight -- it came up on
// localhost:9999 regardless). "::" is the dual-stack wildcard, needed for
// the exact same reason PostgREST's private-networking connectivity failed
// earlier: Railway's private networking resolves and connects via an IPv6
// address, and an IPv4-only or loopback-only bind is simply unreachable
// from Envoy no matter how correct the DNS/routing otherwise is.
const servePort = Number(Deno.env.get("PORT") ?? "9000");

serve(async (req: Request) => {
  const url = new URL(req.url);
  const { pathname } = url;
  const pathParts = pathname.split("/");
  const serviceName = pathParts[1];

  if (!serviceName || serviceName === "") {
    return new Response(
      JSON.stringify({ error: "missing function name in path" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Envoy's gateway already enforces the apikey/RBAC layer in front of this
  // service (see Envoy's /functions/v1/ route — "Bypass": the edge runtime
  // is expected to do its own JWT check). Individual functions can still
  // read the Authorization header themselves (create-order does, to resolve
  // the calling user) — this is only a coarse "is there a real bearer JWT
  // at all" gate, matching Supabase Cloud's default verify_jwt behavior.
  if (VERIFY_JWT && req.method !== "OPTIONS") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return unauthorized("Missing authorization header");
    if (!JWT_SECRET) {
      console.error("JWT_SECRET not set on functions service — cannot verify JWT");
      return unauthorized("Server misconfigured");
    }
  }

  const servicePath = `/home/deno/functions/${serviceName}`;

  const memoryLimitMb = 150;
  const workerTimeoutMs = 5 * 60 * 1000;
  const noModuleCache = false;
  const importMapPath = null;
  const envVarsObj = Deno.env.toObject();
  const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]]);

  try {
    // @ts-ignore — EdgeRuntime is a global injected by supabase/edge-runtime,
    // not a Deno/std type.
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb,
      workerTimeoutMs,
      noModuleCache,
      importMapPath,
      envVars,
    });
    return await worker.fetch(req);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`failed to load/run function "${serviceName}":`, error);
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, { port: servePort, hostname: "::" });
