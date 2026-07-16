import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { promotionDraftSchema, type PromotionDraft, validationMessages } from "./promotion-copilot.dto";

const uuidSchema = z.string().uuid();
const searchProductsArguments = z.object({
  query: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(20).default(10),
}).strict();
const getProductArguments = z.object({ productId: uuidSchema }).strict();
const searchCategoriesArguments = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(20).default(10),
}).strict();
const getPromotionArguments = z.object({ promotionId: uuidSchema }).strict();
const conflictArguments = z.object({
  productIds: z.array(uuidSchema).min(1).max(40),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  excludePromotionId: uuidSchema.optional(),
}).strict();
const calculateDiscountArguments = z.object({
  basePrice: z.number().finite().nonnegative().max(10_000_000),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.number().finite().positive().max(100_000),
}).strict().superRefine((value, context) => {
  if (value.discountType === "percentage" && value.discountValue > 100) {
    context.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage discounts cannot exceed 100%." });
  }
});
const draftArguments = z.object({ draft: promotionDraftSchema }).strict();

type ProductRow = {
  id: string;
  code: string | null;
  barcode: string | null;
  name_ar: string | null;
  name_en: string | null;
  base_price: number | string | null;
  effective_price: number | string | null;
  stock: number | string | null;
  category_name: string | null;
  category_name_en: string | null;
  promotion_id: string | null;
  promotion_name: string | null;
};

type ConflictRow = {
  id: string;
  name: string;
  starts_at: Date | string;
  ends_at: Date | string;
  status: string;
  shared_product_ids: string[];
};

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const draftParameters = {
  type: "object",
  additionalProperties: false,
  required: ["draft"],
  properties: {
    draft: {
      type: "object",
      additionalProperties: false,
      required: ["name", "discountType", "discountValue", "startsAt", "endsAt", "productIds"],
      properties: {
        name: { type: "string", minLength: 2, maxLength: 120 },
        description: { type: "string", maxLength: 500 },
        discountType: { type: "string", enum: ["percentage", "fixed_amount"] },
        discountValue: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        productIds: { type: "array", minItems: 1, maxItems: 40, items: { type: "string", format: "uuid" } },
      },
    },
  },
};

export const PROMOTION_COPILOT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "searchProducts",
      description: "Search the active catalog. Returns canonical current prices and active promotion context. Use this instead of guessing products.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          query: { type: "string", maxLength: 120 },
          category: { type: "string", maxLength: 120 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProduct",
      description: "Get one active product with canonical effective pricing by UUID.",
      parameters: {
        type: "object", additionalProperties: false, required: ["productId"],
        properties: { productId: { type: "string", format: "uuid" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchCategories",
      description: "Search categories represented by active catalog products.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          query: { type: "string", maxLength: 120 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPromotion",
      description: "Read an existing promotion and its assigned product IDs by UUID.",
      parameters: {
        type: "object", additionalProperties: false, required: ["promotionId"],
        properties: { promotionId: { type: "string", format: "uuid" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detectPromotionConflicts",
      description: "Find existing enabled promotions that overlap the proposed time window and products. Overlap is a warning, not an automatic rejection.",
      parameters: {
        type: "object", additionalProperties: false,
        required: ["productIds", "startsAt", "endsAt"],
        properties: {
          productIds: { type: "array", minItems: 1, maxItems: 40, items: { type: "string", format: "uuid" } },
          startsAt: { type: "string", format: "date-time" },
          endsAt: { type: "string", format: "date-time" },
          excludePromotionId: { type: "string", format: "uuid" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculateDiscount",
      description: "Calculate an effective price using the canonical Supabase promotion pricing function.",
      parameters: {
        type: "object", additionalProperties: false,
        required: ["basePrice", "discountType", "discountValue"],
        properties: {
          basePrice: { type: "number", minimum: 0, maximum: 10000000 },
          discountType: { type: "string", enum: ["percentage", "fixed_amount"] },
          discountValue: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "previewPromotion",
      description: "Preview proposed prices for a complete draft and report overlapping promotions. This never saves anything.",
      parameters: draftParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "validatePromotion",
      description: "Validate a complete draft against promotion rules and active catalog eligibility. This never saves anything.",
      parameters: draftParameters,
    },
  },
];

@Injectable()
export class PromotionCopilotToolsService {
  private readonly logger = new Logger(PromotionCopilotToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(name: string, rawArguments: unknown, signal?: AbortSignal): Promise<unknown> {
    this.throwIfAborted(signal);
    try {
      switch (name) {
        case "searchProducts": return await this.searchProducts(searchProductsArguments.parse(rawArguments), signal);
        case "getProduct": return await this.getProduct(getProductArguments.parse(rawArguments).productId, signal);
        case "searchCategories": return await this.searchCategories(searchCategoriesArguments.parse(rawArguments), signal);
        case "getPromotion": return await this.getPromotion(getPromotionArguments.parse(rawArguments).promotionId, signal);
        case "detectPromotionConflicts": return await this.detectPromotionConflicts(conflictArguments.parse(rawArguments), signal);
        case "calculateDiscount": return await this.calculateDiscount(calculateDiscountArguments.parse(rawArguments), signal);
        case "previewPromotion": return await this.previewPromotion(draftArguments.parse(rawArguments).draft, signal);
        case "validatePromotion": return await this.validatePromotion(rawArguments, signal);
        default: return { ok: false, error: "Unknown promotion tool." };
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof z.ZodError) {
        return { ok: false, error: "Invalid tool arguments.", details: validationMessages(error) };
      }
      this.logger.warn(JSON.stringify({ event: "promotion_copilot_tool_failed", tool: name, error: this.errorName(error) }));
      return { ok: false, error: "The promotion data tool is temporarily unavailable." };
    }
  }

  async getProductsByIds(productIds: string[], signal?: AbortSignal) {
    if (productIds.length === 0) return [];
    this.throwIfAborted(signal);
    const rows = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT product.id, product.code, product.barcode, product.name_ar, product.name_en,
             product.base_price, product.effective_price, product.stock,
             product.category_name, product.category_name_en,
             product.promotion_id, product.promotion_name
      FROM public.product_effective_prices AS product
      WHERE product.id = ANY(${productIds}::uuid[]) AND product.is_active = true
      ORDER BY product.name_en ASC NULLS LAST, product.id
      LIMIT 40
    `;
    this.throwIfAborted(signal);
    return rows.map((row) => this.mapProduct(row));
  }

  private async searchProducts(input: z.infer<typeof searchProductsArguments>, signal?: AbortSignal) {
    const query = input.query || null;
    const category = input.category || null;
    const rows = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT id, code, barcode, name_ar, name_en, base_price, effective_price, stock,
             category_name, category_name_en, promotion_id, promotion_name
      FROM public.search_effective_products(
        ${query}::text, ${category}::text, false, NULL::numeric, NULL::numeric,
        false, 'name_asc', ${input.limit}::integer, 0
      )
    `;
    this.throwIfAborted(signal);
    return { ok: true, products: rows.map((row) => this.mapProduct(row)) };
  }

  private async getProduct(productId: string, signal?: AbortSignal) {
    const rows = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT id, code, barcode, name_ar, name_en, base_price, effective_price, stock,
             category_name, category_name_en, promotion_id, promotion_name
      FROM public.get_effective_product(${productId}::uuid)
      LIMIT 1
    `;
    this.throwIfAborted(signal);
    return { ok: true, product: rows[0] ? this.mapProduct(rows[0]) : null };
  }

  private async searchCategories(input: z.infer<typeof searchCategoriesArguments>, signal?: AbortSignal) {
    const query = input.query ? `%${input.query}%` : null;
    const rows = await this.prisma.$queryRaw<Array<{ category: string; category_en: string }>>`
      SELECT product."Category_Name" AS category, product."Category_Name_En" AS category_en
      FROM public.products AS product
      WHERE product.is_active = true
        AND (product."Category_Name" IS NOT NULL OR product."Category_Name_En" IS NOT NULL)
        AND (${query}::text IS NULL OR product."Category_Name" ILIKE ${query} OR product."Category_Name_En" ILIKE ${query})
      GROUP BY product."Category_Name", product."Category_Name_En"
      ORDER BY lower(coalesce(product."Category_Name_En", product."Category_Name"))
      LIMIT ${input.limit}
    `;
    this.throwIfAborted(signal);
    return { ok: true, categories: rows.map((row) => ({ name: row.category ?? "", nameEn: row.category_en ?? "" })) };
  }

  private async getPromotion(promotionId: string, signal?: AbortSignal) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT promotion.id, promotion.name, promotion.description,
             promotion.discount_type AS "discountType", promotion.discount_value AS "discountValue",
             promotion.starts_at AS "startsAt", promotion.ends_at AS "endsAt", promotion.status,
             coalesce(array_agg(assignment.product_id) FILTER (WHERE assignment.product_id IS NOT NULL), '{}') AS "productIds"
      FROM public.promotions AS promotion
      LEFT JOIN public.promotion_products AS assignment ON assignment.promotion_id = promotion.id
      WHERE promotion.id = ${promotionId}::uuid
      GROUP BY promotion.id
      LIMIT 1
    `;
    this.throwIfAborted(signal);
    const promotion = rows[0];
    return { ok: true, promotion: promotion ? this.serialiseRecord(promotion) : null };
  }

  private async detectPromotionConflicts(input: z.infer<typeof conflictArguments>, signal?: AbortSignal) {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      return { ok: false, error: "The promotion must end after it starts." };
    }
    const excludedId = input.excludePromotionId ?? null;
    const rows = await this.prisma.$queryRaw<ConflictRow[]>`
      SELECT promotion.id, promotion.name, promotion.starts_at, promotion.ends_at, promotion.status,
             array_agg(DISTINCT assignment.product_id) AS shared_product_ids
      FROM public.promotions AS promotion
      JOIN public.promotion_products AS assignment ON assignment.promotion_id = promotion.id
      WHERE assignment.product_id = ANY(${input.productIds}::uuid[])
        AND promotion.is_enabled = true
        AND promotion.status IN ('scheduled', 'active')
        AND promotion.starts_at < ${input.endsAt}::timestamptz
        AND promotion.ends_at > ${input.startsAt}::timestamptz
        AND (${excludedId}::uuid IS NULL OR promotion.id <> ${excludedId}::uuid)
      GROUP BY promotion.id
      ORDER BY promotion.starts_at ASC
      LIMIT 20
    `;
    this.throwIfAborted(signal);
    return {
      ok: true,
      conflicts: rows.map((row) => ({
        id: row.id,
        name: row.name,
        startsAt: this.isoDate(row.starts_at),
        endsAt: this.isoDate(row.ends_at),
        status: row.status,
        sharedProductIds: row.shared_product_ids,
      })),
    };
  }

  private async calculateDiscount(input: z.infer<typeof calculateDiscountArguments>, signal?: AbortSignal) {
    const rows = await this.prisma.$queryRaw<Array<{ effective_price: number | string }>>`
      SELECT public.promotion_effective_price(
        ${input.basePrice}::numeric, ${input.discountType}::text, ${input.discountValue}::numeric
      ) AS effective_price
    `;
    this.throwIfAborted(signal);
    const effectivePrice = Number(rows[0]?.effective_price ?? input.basePrice);
    return {
      ok: true,
      basePrice: input.basePrice,
      effectivePrice,
      discountAmount: Number(Math.max(0, input.basePrice - effectivePrice).toFixed(2)),
    };
  }

  private async previewPromotion(draft: PromotionDraft, signal?: AbortSignal) {
    const rows = await this.prisma.$queryRaw<Array<ProductRow & { proposed_price: number | string }>>`
      SELECT product.id, product.code, product.barcode, product.name_ar, product.name_en,
             product.base_price, product.effective_price, product.stock,
             product.category_name, product.category_name_en,
             product.promotion_id, product.promotion_name,
             public.promotion_effective_price(product.base_price, ${draft.discountType}::text, ${draft.discountValue}::numeric) AS proposed_price
      FROM public.product_effective_prices AS product
      WHERE product.id = ANY(${draft.productIds}::uuid[]) AND product.is_active = true
      ORDER BY product.name_en ASC NULLS LAST, product.id
      LIMIT 40
    `;
    const conflicts = await this.detectPromotionConflicts({
      productIds: draft.productIds,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
    }, signal);
    this.throwIfAborted(signal);
    return {
      ok: true,
      products: rows.map((row) => ({
        ...this.mapProduct(row),
        proposedPrice: Number(row.proposed_price ?? 0),
        proposedDiscountAmount: Number(Math.max(0, Number(row.base_price ?? 0) - Number(row.proposed_price ?? 0)).toFixed(2)),
      })),
      missingProductIds: draft.productIds.filter((id) => !rows.some((row) => row.id === id)),
      conflicts: "conflicts" in conflicts ? conflicts.conflicts : [],
    };
  }

  private async validatePromotion(rawArguments: unknown, signal?: AbortSignal) {
    const parsed = draftArguments.safeParse(rawArguments);
    if (!parsed.success) {
      return { ok: true, valid: false, errors: validationMessages(parsed.error), warnings: [] };
    }
    const preview = await this.previewPromotion(parsed.data.draft, signal);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (preview.missingProductIds.length > 0) errors.push("Every selected product must exist and be active.");
    if (preview.conflicts.length > 0) warnings.push("One or more products have an overlapping enabled promotion.");
    return { ok: true, valid: errors.length === 0, errors, warnings, preview };
  }

  private mapProduct(row: ProductRow) {
    return {
      id: row.id,
      code: row.code ?? "",
      barcode: row.barcode ?? "",
      nameAr: row.name_ar ?? "",
      nameEn: row.name_en ?? "",
      basePrice: Number(row.base_price ?? 0),
      effectivePrice: Number(row.effective_price ?? row.base_price ?? 0),
      stock: Number(row.stock ?? 0),
      category: row.category_name ?? "",
      categoryEn: row.category_name_en ?? "",
      activePromotion: row.promotion_id ? { id: row.promotion_id, name: row.promotion_name ?? "" } : null,
    };
  }

  private serialiseRecord(record: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(record).map(([key, value]) => {
      if (value instanceof Date) return [key, value.toISOString()];
      if (typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function") {
        return [key, value.toNumber()];
      }
      return [key, value];
    }));
  }

  private isoDate(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason ?? new Error("Request aborted");
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : "UnknownError";
  }
}
