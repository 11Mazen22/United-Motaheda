# Promotion Copilot deployment

Promotion Copilot is deliberately **proposal-only**. It can read a limited
promotion/product context and produce an editable draft, but it has no endpoint
that creates, updates, enables, disables, or deletes promotions. Staff must use
the existing promotion save workflow to approve a draft.

## Railway services

Deploy Ollama as a separate private Railway service. Do not expose its public
port or call it from the browser.

| Service | Purpose |
| --- | --- |
| `shopper-web` | Existing admin interface |
| `pharmacy-api` | Authenticates staff and proxies proposal requests |
| `promotion-ollama` | Private Ollama inference service |

Attach persistent storage to `promotion-ollama` at Ollama's model directory.
Without it, the selected model is downloaded again after every deployment.

## Required API environment variables

Set these on the existing `pharmacy-api` Railway service:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<Supabase anon key>
OLLAMA_BASE_URL=http://<private-ollama-service>:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
# Optional when the Ollama service is protected by a bearer token:
OLLAMA_API_KEY=<private service token>
# Optional bounded overrides (defaults shown):
PROMOTION_COPILOT_AUTH_TIMEOUT_MS=8000
PROMOTION_COPILOT_OLLAMA_TIMEOUT_MS=45000
PROMOTION_COPILOT_MAX_TOOL_ROUNDS=4
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are used only to validate the staff
access token through Supabase Auth. Read-only tools use the API's existing
Supabase Postgres connection and canonical pricing functions. The browser sends
its current bearer token to the API; no service-role key, database connection,
or Ollama URL is exposed to it.

## Troubleshoot 503 responses

The API returns a specific safe message for each unavailable dependency. Inspect
the response body in the browser Network panel or the error shown in Copilot:

| Response message | Cause | Railway fix |
| --- | --- | --- |
| `Promotion Copilot authentication is not configured.` | `SUPABASE_URL` or `SUPABASE_ANON_KEY` is absent on `pharmacy-api` | Add both variables and redeploy `pharmacy-api` |
| `Promotion Copilot is being prepared. Please try again shortly.` | `OLLAMA_BASE_URL` or `OLLAMA_MODEL` is absent | Add both variables and redeploy `pharmacy-api` |
| `Promotion Copilot is temporarily unavailable.` | The API cannot connect to Ollama | Confirm the Ollama service is running and use its Railway private DNS URL, for example `http://promotion-ollama.railway.internal:11434` |
| `Promotion Copilot generation timed out.` | The model is not loaded or inference exceeded the bounded timeout | Verify the model is present, increase service memory/CPU, then adjust `PROMOTION_COPILOT_OLLAMA_TIMEOUT_MS` only if needed |

From the `pharmacy-api` Railway shell/network, verify that the configured service
responds to `GET /api/tags` and that the exact value of `OLLAMA_MODEL` appears in
the returned model list. A public Ollama URL is neither required nor recommended.

## Ollama setup

1. Create the private Railway `promotion-ollama` service using the Ollama image.
2. Attach a persistent volume.
3. Pull a bilingual instruction model to the volume, initially
   `qwen2.5:7b-instruct`.
4. Configure sufficient RAM for the model. CPU inference is supported but can
   be slower; use a GPU service if latency testing requires it.
5. Confirm `GET /api/tags` responds inside the Railway private network.
6. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` on `pharmacy-api`.

## API contract

```text
POST /admin/promotion-copilot/propose
Authorization: Bearer <Supabase access token>
```

```json
{
  "prompt": "Create a 15% weekend offer for the selected vitamins.",
  "locale": "en",
  "candidateProductIds": ["product-uuid"]
}
```

The response contains a `mode: "proposal"`, editable promotion fields,
questions, and warnings. `requiresStaffApproval` is always `true`.

## Internal read-only tools

The model can request only these bounded tools; there is no generic SQL, RPC, or
HTTP tool and no tool endpoint is exposed to the browser:

- `searchProducts()`
- `getProduct()`
- `searchCategories()`
- `getPromotion()`
- `detectPromotionConflicts()`
- `calculateDiscount()`
- `previewPromotion()`
- `validatePromotion()`

Product search and lookup use the canonical effective-pricing view/functions,
and discount calculations call `promotion_effective_price`. Tool arguments and
results are validated and capped before being returned to the model.

## Safeguards

- Only active `admin` and `manager` accounts can request drafts, matching the
  existing Promotions Manager and canonical promotion RPC authorization.
- Requests are rate limited per staff member and tool rounds/calls are bounded.
- Client disconnects cancel in-flight Supabase Auth and Ollama requests.
- Supabase Auth and Ollama calls have independent bounded timeouts.
- Ollama is required to return the declared JSON schema; the API validates it
  again and rejects malformed or oversized output.
- The model can select only product IDs returned by approved catalog tools or
  explicitly selected and verified by the server.
- The server forces all generated promotion drafts to `status: "draft"`.
- The API writes proposal success/failure metadata to immutable
  `admin_audit_log`; prompts and generated content are deliberately excluded.
- Structured application logs include request ID, actor ID, duration, tool names,
  and error class without bearer tokens, prompts, or model output.
- Existing Supabase promotion validation and save RPC remain authoritative.
- There is no promotion create/update/delete call in the Copilot module. Applying
  a proposal only populates the staff form; saving remains a separate explicit
  human action through the existing promotion workflow.
