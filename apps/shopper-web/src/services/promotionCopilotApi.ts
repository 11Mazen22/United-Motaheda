import { z } from "zod";
import { publicEnv } from "../app/env";
import { getSupabaseClient } from "../lib/supabaseClient";

const proposalSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  discountType: z.enum(["percentage", "fixed_amount"]).optional(),
  discountValue: z.number().positive().max(100_000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.literal("draft").optional(),
  productIds: z.array(z.string().uuid()).max(40),
});

const responseSchema = z.object({
  mode: z.literal("proposal"),
  message: z.string().min(1).max(800),
  proposal: proposalSchema,
  warnings: z.array(z.string().min(1).max(240)).max(8),
  questions: z.array(z.string().min(1).max(240)).max(4),
  productsConsidered: z.number().int().nonnegative(),
  toolsUsed: z.array(z.string()),
  requiresStaffApproval: z.literal(true),
  actorRole: z.enum(["admin", "manager"]),
  requestId: z.string(),
});

const responseEnvelopeSchema = z.object({
  success: z.literal(true),
  data: responseSchema,
  error: z.null(),
});

export type PromotionCopilotProposal = z.infer<typeof proposalSchema>;
export type PromotionCopilotResponse = z.infer<typeof responseSchema>;

export interface PromotionCopilotRequest {
  prompt: string;
  locale: "ar" | "en";
  candidateProductIds?: string[];
}

function readableMessage(message: unknown): string {
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === "string").join(" ");
  }
  return "";
}

function responseErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as {
    message?: unknown;
    error?: unknown;
    details?: unknown;
    success?: unknown;
  };

  const message = readableMessage(record.message);
  if (message) return message;

  if (record.error && typeof record.error === "object") {
    const nestedMessage = readableMessage((record.error as { message?: unknown }).message);
    if (nestedMessage) return nestedMessage;
  }

  if (record.details && typeof record.details === "object") {
    const detailsMessage = readableMessage((record.details as { message?: unknown }).message);
    if (detailsMessage) return detailsMessage;
  }

  return fallback;
}

function getHttpErrorMessage(status: number, payload: unknown, fallback: string): string {
  const message = responseErrorMessage(payload, "");
  if (message) return message;

  switch (status) {
    case 400:
      return "Promotion Copilot could not process that request. Please try a simpler prompt.";
    case 401:
    case 403:
      return "Your staff session is not authorized to use Promotion Copilot. Please sign in again.";
    case 429:
      return "Promotion Copilot is busy right now. Please try again in a moment.";
    case 500:
    case 502:
    case 503:
      return "Promotion Copilot is temporarily unavailable. Please try again shortly.";
    default:
      return fallback;
  }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();
  if (!rawText) return null;

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText);
    } catch {
      return { message: rawText };
    }
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { message: rawText };
  }
}

export async function requestPromotionProposal(
  request: PromotionCopilotRequest,
  signal?: AbortSignal,
): Promise<PromotionCopilotResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Your staff session has expired. Please sign in again.");
  }

  const response = await fetch(`${publicEnv.apiBase.replace(/\/$/, "")}/admin/promotion-copilot/propose`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
      "X-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      prompt: request.prompt.trim(),
      locale: request.locale,
      candidateProductIds: [...new Set(request.candidateProductIds ?? [])].slice(0, 40),
    }),
    signal,
  });

  if (!response.ok) {
    const payload = await readResponsePayload(response);
    throw new Error(getHttpErrorMessage(response.status, payload, "Promotion Copilot could not generate a draft."));
  }

  const payload: unknown = await readResponsePayload(response);
  const envelope = responseEnvelopeSchema.safeParse(payload);
  if (envelope.success) return envelope.data.data;

  // Keep direct responses compatible with local API instances that do not use
  // the production response interceptor.
  const direct = responseSchema.safeParse(payload);
  if (direct.success) return direct.data;
  throw new Error("Promotion Copilot returned an invalid draft. Please try again.");
}
