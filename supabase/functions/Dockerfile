# Self-hosted Supabase Edge Functions runtime for Railway.
#
# supabase/edge-runtime serves every function under ./functions/<name> via
# the main/index.ts dispatcher (see main/index.ts for why that file exists).
# Railway builds this with rootDirectory=supabase/functions, so the build
# context here IS this functions directory already — `.` covers every
# function (main, create-order, track-order, etc.) in one COPY.
FROM supabase/edge-runtime:v1.67.4

COPY . /home/deno/functions

# Watch for the exact bug PostgREST hit tonight: an app defaulting to an
# IPv4-only bind while Railway's private networking resolves and connects
# via an IPv6 address, leaving Envoy unable to reach it at all (fails
# silently -- looks like a dead service, not a bind-address problem). If
# functions are unreachable through Envoy after deploy, check this first.
CMD ["start", "--main-service", "/home/deno/functions/main", "-p", "9000"]
