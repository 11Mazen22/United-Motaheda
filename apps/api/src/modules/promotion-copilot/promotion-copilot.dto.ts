import { z } from "zod";

export const promotionDraftSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.number().finite().positive().max(100_000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  productIds: z.array(z.string().uuid()).min(1).max(40),
}).strict().superRefine((draft, context) => {
  if (draft.discountType === "percentage" && draft.discountValue > 100) {
    context.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "Percentage discounts cannot exceed 100%.",
    });
  }
  if (Date.parse(draft.endsAt) <= Date.parse(draft.startsAt)) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "The promotion must end after it starts.",
    });
  }
});

export const promotionProposalSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(["percentage", "fixed_amount"]).optional(),
  discountValue: z.number().finite().positive().max(100_000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.literal("draft").optional(),
  productIds: z.array(z.string().uuid()).max(40).default([]),
}).strict();

export const proposePromotionSchema = z.object({
  prompt: z.string().trim().min(4).max(1_500),
  locale: z.enum(["ar", "en"]).default("en"),
  candidateProductIds: z.array(z.string().uuid()).max(40).default([]),
}).strict();

export const modelResponseSchema = z.object({
  message: z.string().trim().min(1).max(800),
  proposal: promotionProposalSchema,
  warnings: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  questions: z.array(z.string().trim().min(1).max(240)).max(4).default([]),
}).strict();

export type PromotionDraft = z.infer<typeof promotionDraftSchema>;
export type PromotionProposal = z.infer<typeof promotionProposalSchema>;
export type ProposePromotionDto = z.infer<typeof proposePromotionSchema>;
export type PromotionCopilotModelResponse = z.infer<typeof modelResponseSchema>;

export const MODEL_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "proposal", "warnings", "questions"],
  properties: {
    message: { type: "string", minLength: 1, maxLength: 800 },
    proposal: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 2, maxLength: 120 },
        description: { type: "string", maxLength: 500 },
        discountType: { type: "string", enum: ["percentage", "fixed_amount"] },
        discountValue: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        status: { type: "string", const: "draft" },
        productIds: {
          type: "array",
          maxItems: 40,
          items: { type: "string", format: "uuid" },
        },
      },
      required: ["productIds"],
    },
    warnings: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
    questions: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
  },
} as const;

export function validationMessages(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}
