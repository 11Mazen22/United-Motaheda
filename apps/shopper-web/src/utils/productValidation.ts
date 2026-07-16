import { z } from "zod";
import type { AdminProduct } from "../services/adminSupabaseApi";

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    nameAr: z.string(),
    barcode: z.string(),
    categoryId: z.string().min(1, "Category is required"),
    price: z
      .number({ message: "Price must be a number" })
      .min(0, "Price must be zero or greater"),
    stock: z
      .number({ message: "Stock must be a number" })
      .int("Stock must be a whole number")
      .min(0, "Stock must be zero or greater"),
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export interface ProductCategoryOption {
  id: string;
  name: string;
  nameEn?: string;
}

const normalizeCategoryValue = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase() ?? "";

/**
 * The legacy products table stores both an optional category identifier and
 * localized category labels. Catalog options use canonical IDs, so resolve all
 * persisted representations to the option ID before seeding form state.
 */
export function resolveProductCategoryId(
  product: AdminProduct,
  categories: ProductCategoryOption[],
): string {
  const candidates = [product.category, product.categoryName, product.categoryNameEn]
    .map(normalizeCategoryValue)
    .filter(Boolean);

  const category = categories.find((option) => {
    const optionValues = [option.id, option.name, option.nameEn]
      .map(normalizeCategoryValue)
      .filter(Boolean);
    return candidates.some((candidate) => optionValues.includes(candidate));
  });

  return category?.id ?? product.category;
}

export function emptyProductForm(): ProductFormValues {
  return {
    name: "",
    nameAr: "",
    barcode: "",
    categoryId: "",
    price: 0,
    stock: 0,
  };
}

export function productToFormValues(
  product: AdminProduct,
  categories: ProductCategoryOption[],
): ProductFormValues {
  return {
    name: product.name,
    nameAr: product.nameAr ?? "",
    barcode: product.barcode ?? "",
    categoryId: resolveProductCategoryId(product, categories),
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
  };
}
