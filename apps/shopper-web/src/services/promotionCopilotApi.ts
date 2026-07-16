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

export type PromotionCopilotProposal = z.infer<typeof proposalSchema>;
export type PromotionCopilotResponse = z.infer<typeof responseSchema>;

export interface PromotionCopilotRequest {
  prompt: string;
  locale: "ar" | "en";
  candidateProductIds?: string[];
}

function responseErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const joined = message.filter((item): item is string => typeof item === "string").join(" ");
    if (joined) return joined;
  }
  return fallback;
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
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(responseErrorMessage(payload, "Promotion Copilot could not generate a draft."));
  }

  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Promotion Copilot returned an invalid draft. Please try again.");
  }
  return parsed.data;
}
