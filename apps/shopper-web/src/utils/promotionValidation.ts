import { z } from "zod";

export type PromotionValidationLocale = "ar" | "en";

export function createPromotionSchema(locale: PromotionValidationLocale = "en") {
  const message = locale === "ar" ? {
    nameMin: "يجب ألا يقل اسم العرض عن حرفين",
    nameMax: "يجب ألا يزيد اسم العرض عن 120 حرفاً",
    descriptionMax: "يجب ألا يزيد وصف العرض عن 500 حرف",
    discountInvalid: "أدخل قيمة خصم صحيحة",
    discountPositive: "يجب أن تكون قيمة الخصم أكبر من صفر",
    startRequired: "تاريخ بدء العرض مطلوب",
    startInvalid: "أدخل تاريخ بدء صحيحاً",
    endRequired: "تاريخ انتهاء العرض مطلوب",
    endInvalid: "أدخل تاريخ انتهاء صحيحاً",
    productInvalid: "معرّف المنتج غير صحيح",
    productRequired: "اختر منتجاً واحداً على الأقل",
    endAfterStart: "يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء",
    percentageMax: "لا يمكن أن تتجاوز نسبة الخصم 100%",
    expiredPast: "حالة منتهٍ تتطلب تاريخ انتهاء سابقاً",
  } : {
    nameMin: "Name must be at least 2 characters",
    nameMax: "Name cannot exceed 120 characters",
    descriptionMax: "Description cannot exceed 500 characters",
    discountInvalid: "Enter a valid discount value",
    discountPositive: "Discount value must be greater than 0",
    startRequired: "Start date is required",
    startInvalid: "Enter a valid start date",
    endRequired: "End date is required",
    endInvalid: "Enter a valid end date",
    productInvalid: "Invalid product identifier",
    productRequired: "Select at least one product",
    endAfterStart: "End date must be after start date",
    percentageMax: "Percentage discounts cannot exceed 100%",
    expiredPast: "Expired status requires an end date in the past",
  };

  return z
    .object({
      name: z.string().trim().min(2, message.nameMin).max(120, message.nameMax),
      description: z.string().trim().max(500, message.descriptionMax).optional(),
      discountType: z.enum(["percentage", "fixed_amount"]),
      discountValue: z.number().finite(message.discountInvalid).positive(message.discountPositive),
      startsAt: z.string().min(1, message.startRequired).refine((value) => Number.isFinite(Date.parse(value)), message.startInvalid),
      endsAt: z.string().min(1, message.endRequired).refine((value) => Number.isFinite(Date.parse(value)), message.endInvalid),
      status: z.enum(["draft", "scheduled", "active", "paused", "expired", "archived"]),
      productIds: z.array(z.string().uuid(message.productInvalid)).min(1, message.productRequired),
    })
    .refine(
      (data) => new Date(data.endsAt) > new Date(data.startsAt),
      { message: message.endAfterStart, path: ["endsAt"] },
    )
    .refine(
      (data) => data.discountType !== "percentage" || data.discountValue <= 100,
      { message: message.percentageMax, path: ["discountValue"] },
    )
    .refine(
      (data) => data.status !== "expired" || Date.parse(data.endsAt) <= Date.now(),
      { message: message.expiredPast, path: ["status"] },
    );
}

export const promotionSchema = createPromotionSchema();
export type PromotionFormValues = z.infer<ReturnType<typeof createPromotionSchema>>;
