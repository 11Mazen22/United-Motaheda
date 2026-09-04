/**
 * Admin Supabase API - Direct Supabase operations for admin panel
 * 
 * This replaces the Google Sheets API wrapper for direct Supabase operations
 * with proper error handling, logging, and type safety.
 */

import { getSupabaseClient } from "../lib/supabaseClient";
import { toast } from "sonner";
export type ProductMutationPayload = {
  /** Supabase row ID. Required for an existing product update. */
  id?: string;
  Code: string;
  Barcode?: string;
  Name: string;
  Name_Ar: string;
  Name_En: string;
  Price: number;
  Stock: number;
  Category: string;
  Category_Name: string;
  Category_Name_En: string;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminProduct {
  id: string;
  code: string;
  barcode: string;
  name: string;
  nameAr: string;
  nameEn: string;
  price: number;
  stock: number;
  category: string;
  categoryName: string;
  categoryNameEn: string;
  inStock: boolean;
  is_active: boolean;
  imageUrl?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminStaff {
  id: string;
  fullName: string;
  username: string;
  phone: string;
  email: string;
  role: string;
  status: "Active" | "Inactive" | "Suspended";
  created_at?: string;
  updated_at?: string;
}



export interface ApiError {
  message: string;
  details?: string;
  code?: string;
  hint?: string;
}

// ─── Error Handling ───────────────────────────────────────────────────────────────

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown; code?: unknown };
  return candidate.name === 'AbortError' || candidate.message?.toString().includes('AbortError') || candidate.code === 'ABORT_ERR';
}

function handleSupabaseError(error: unknown): ApiError {
  if (!isAbortError(error)) {
    console.error('[AdminSupabaseAPI] Supabase error details:', {
      error,
      type: typeof error,
      constructor: error?.constructor?.name,
      keys: Object.keys(error || {}),
    });
  }

  if (error && typeof error === 'object') {
    const supabaseError = error as any;
    
    return {
      message: supabaseError?.message || 'Unknown Supabase error',
      details: supabaseError?.details || supabaseError?.hint,
      code: supabaseError?.code,
      hint: supabaseError?.hint,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      details: error.stack,
    };
  }

  return {
    message: 'Unknown error occurred',
    details: String(error),
  };
}

function logOperation(operation: string, data?: any, error?: unknown) {
  const timestamp = new Date().toISOString();
  
  if (error) {
    console.error(`[AdminSupabaseAPI] ${timestamp} - ${operation} FAILED:`, {
      data,
      error: handleSupabaseError(error),
    });
  } else {
    console.log(`[AdminSupabaseAPI] ${timestamp} - ${operation} SUCCESS:`, { data });
  }
}

// ─── Product Operations ───────────────────────────────────────────────────────────

export async function fetchAdminProducts(opts?: { signal?: AbortSignal }): Promise<AdminProduct[]> {
  const operation = 'fetchAdminProducts';
  const PAGE_SIZE = 1000; // PostgREST's default db-max-rows cap -- a single unpaginated
                           // .select() silently truncates here, which is exactly what was
                           // hiding all but the 1000 newest of 8000+ real products.

  try {
    const supabase = getSupabaseClient();
    const rows: any[] = [];
    let from = 0;
    for (;;) {
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (opts?.signal) {
        query = query.abortSignal(opts.signal) as typeof query;
      }

      const { data, error } = await query;

      if (error) {
        if (!isAbortError(error)) {
          logOperation(operation, null, error);
        }
        throw new Error(`Failed to fetch products: ${error.message}`);
      }

      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const products: AdminProduct[] = rows.map((row: any) => ({
      id: row.id,
      code: row.Code || '',
      barcode: row.Barcode || '',
      name: row.Name || '',
      nameAr: row.Name_Ar || '',
      nameEn: row.Name_En || '',
      price: Number(row.Price) || 0,
      stock: Number(row.Stock) || 0,
      category: row.Category || '',
      categoryName: row.Category_Name || '',
      categoryNameEn: row.Category_Name_En || '',
      inStock: Boolean(row.is_active),
      is_active: Boolean(row.is_active),
      imageUrl: typeof row.image_url === "string" ? row.image_url : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    logOperation(operation, { count: products.length });
    return products;

  } catch (error) {
    if (!isAbortError(error)) {
      logOperation(operation, null, error);
    }
    throw error;
  }
}

export async function updateAdminProduct(payload: ProductMutationPayload): Promise<AdminProduct> {
  const operation = 'updateAdminProduct';
  
  try {
    // Validate payload
    if (!payload.Code) {
      throw new Error('Product code is required for updates');
    }

    const supabase = getSupabaseClient();
    
    // A row ID is unambiguous. Keep the code lookup as a compatibility path
    // for older callers while forms always send the selected product's ID.
    let productId = payload.id;
    if (!productId) {
      const { data: existingProduct, error: findError } = await supabase
        .from('products')
        .select('id')
        .eq('Code', payload.Code)
        .single();

      if (findError) {
        logOperation(operation, { payload }, findError);
        throw new Error(`Product not found with code ${payload.Code}: ${findError.message}`);
      }
      productId = existingProduct?.id;
    }

    if (!productId) {
      throw new Error(`Product not found with code ${payload.Code}`);
    }

    // Stock changes must go through adjust_inventory() rather than a raw
    // column write. inventory_state (reserved/committed included) is the
    // real source of truth once a product has been touched by any
    // reservation — products.Stock is a one-way mirror written by a
    // trigger on inventory_state, not the other way around. A direct write
    // here either gets silently clobbered back by the next
    // reservation/commit/adjust event on that product, or (if nothing has
    // touched it yet) works today but leaves inventory_state to lazily
    // re-derive from whatever this column said much later — either way,
    // there was no reliable way to actually correct a product's stock
    // through this form. adjust_inventory takes a delta, not an absolute
    // value, so the desired new count is diffed against the current
    // mirrored value; a no-op (delta 0) is skipped since the RPC itself
    // rejects a zero delta.
    const { data: currentRow, error: currentError } = await supabase
      .from('products')
      .select('Stock')
      .eq('id', productId)
      .single();
    if (currentError) {
      logOperation(operation, { payload }, currentError);
      throw new Error(`Failed to read current stock: ${currentError.message}`);
    }
    const stockDelta = Number(payload.Stock) - Number(currentRow?.Stock ?? 0);
    if (stockDelta !== 0) {
      const { error: adjustError } = await supabase.rpc('adjust_inventory', {
        p_product_id: productId,
        p_delta: stockDelta,
        p_reason: 'Manual admin correction',
        p_idempotency_key: `admin-stock-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
      if (adjustError) {
        logOperation(operation, { payload, stockDelta }, adjustError);
        throw new Error(`Failed to adjust stock: ${adjustError.message}`);
      }
    }

    // Prepare update data — Stock excluded, adjust_inventory (plus the
    // sync trigger it runs through) already applied and mirrored it above.
    const updateData: Record<string, unknown> = {
      Barcode: payload.Barcode || '',
      Name: payload.Name,
      Name_Ar: payload.Name_Ar,
      Name_En: payload.Name_En,
      Price: Number(payload.Price),
      Category: payload.Category,
      Category_Name: payload.Category_Name,
      Category_Name_En: payload.Category_Name_En,
      // is_active intentionally omitted — it previously silently derived
      // from Stock > 0 on every single save, delisting a product from the
      // whole catalog (product_effective_prices/search_effective_products
      // both filter on is_active = true) the moment it was edited while
      // happening to be out of stock, e.g. fixing a typo in the name.
      // Restocking via adjust_inventory() never touched is_active either,
      // so the product stayed invisible until someone happened to re-save
      // this form while stock was positive. Now left untouched on update —
      // active/inactive is a distinct decision from current stock level.
      updated_at: new Date().toISOString(),
    };


    // Update the product
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logOperation(operation, { payload, updateData }, error);
      throw new Error(`Failed to update product: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned after update');
    }

    const updatedProduct: AdminProduct = {
      id: data.id,
      code: data.Code || '',
      barcode: data.Barcode || '',
      name: data.Name || '',
      nameAr: data.Name_Ar || '',
      nameEn: data.Name_En || '',
      price: Number(data.Price) || 0,
      stock: Number(data.Stock) || 0,
      category: data.Category || '',
      categoryName: data.Category_Name || '',
      categoryNameEn: data.Category_Name_En || '',
      inStock: Boolean(data.is_active),
      is_active: Boolean(data.is_active),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    logOperation(operation, { payload, updatedProduct });
    return updatedProduct;

  } catch (error) {
    logOperation(operation, { payload }, error);
    throw error;
  }
}

export async function createAdminProduct(payload: ProductMutationPayload): Promise<AdminProduct> {
  const operation = 'createAdminProduct';
  
  try {
    const supabase = getSupabaseClient();
    
    // Prepare insert data
    const insertData = {
      Code: payload.Code,
      Barcode: payload.Barcode || '',
      Name: payload.Name,
      Name_Ar: payload.Name_Ar,
      Name_En: payload.Name_En,
      Price: Number(payload.Price),
      Stock: Number(payload.Stock),
      Category: payload.Category,
      Category_Name: payload.Category_Name,
      Category_Name_En: payload.Category_Name_En,
      // is_active omitted — see updateAdminProduct's comment. products.is_active
      // defaults to true at the database level, which is the right default
      // for a newly created product regardless of its starting stock count.
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logOperation(operation, { payload, insertData }, error);
      throw new Error(`Failed to create product: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned after insert');
    }

    const createdProduct: AdminProduct = {
      id: data.id,
      code: data.Code || '',
      barcode: data.Barcode || '',
      name: data.Name || '',
      nameAr: data.Name_Ar || '',
      nameEn: data.Name_En || '',
      price: Number(data.Price) || 0,
      stock: Number(data.Stock) || 0,
      category: data.Category || '',
      categoryName: data.Category_Name || '',
      categoryNameEn: data.Category_Name_En || '',
      inStock: Boolean(data.is_active),
      is_active: Boolean(data.is_active),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    logOperation(operation, { payload, createdProduct });
    return createdProduct;

  } catch (error) {
    logOperation(operation, { payload }, error);
    throw error;
  }
}

/**
 * Bulk variant of createAdminProduct — inserts every payload in ONE
 * PostgREST request instead of one round-trip per row. For a CSV import in
 * the thousands-of-rows range (the catalog this app manages runs to
 * 50,000+ products), the single-row loop this replaced meant importing the
 * full catalog would take hours of sequential network round-trips with the
 * browser tab pinned open the whole time.
 *
 * A caveat that comes with batching: Postgres inserts a multi-row VALUES
 * list atomically — if ANY row in the array violates a constraint (most
 * likely a duplicate Code/Barcode against a row from an earlier import,
 * since parseProductCsv already de-duplicates within the file itself), the
 * WHOLE batch is rejected, not just that row. Callers should catch and fall
 * back to inserting the batch's rows individually to salvage the rest —
 * see ProductManager.tsx's handleCsvImport for that fallback.
 */
export async function createAdminProductsBulk(payloads: ProductMutationPayload[]): Promise<AdminProduct[]> {
  const operation = 'createAdminProductsBulk';
  if (payloads.length === 0) return [];

  const now = new Date().toISOString();
  const insertRows = payloads.map((payload) => ({
    Code: payload.Code,
    Barcode: payload.Barcode || '',
    Name: payload.Name,
    Name_Ar: payload.Name_Ar,
    Name_En: payload.Name_En,
    Price: Number(payload.Price),
    Stock: Number(payload.Stock),
    Category: payload.Category,
    Category_Name: payload.Category_Name,
    Category_Name_En: payload.Category_Name_En,
    created_at: now,
    updated_at: now,
  }));

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('products').insert(insertRows).select();

    if (error) {
      logOperation(operation, { count: payloads.length }, error);
      throw new Error(`Bulk insert failed: ${error.message}`);
    }
    if (!data) throw new Error('No data returned after bulk insert');

    const created: AdminProduct[] = data.map((row) => ({
      id: row.id,
      code: row.Code || '',
      barcode: row.Barcode || '',
      name: row.Name || '',
      nameAr: row.Name_Ar || '',
      nameEn: row.Name_En || '',
      price: Number(row.Price) || 0,
      stock: Number(row.Stock) || 0,
      category: row.Category || '',
      categoryName: row.Category_Name || '',
      categoryNameEn: row.Category_Name_En || '',
      inStock: Boolean(row.is_active),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    logOperation(operation, { count: payloads.length, created: created.length });
    return created;
  } catch (error) {
    logOperation(operation, { count: payloads.length }, error);
    throw error;
  }
}

export async function deleteAdminProduct(code: string): Promise<void> {
  const operation = 'deleteAdminProduct';
  
  try {
    if (!code) {
      throw new Error('Product code is required for deletion');
    }

    const supabase = getSupabaseClient();
    
    // Find the product by code first
    const { data: existingProduct, error: findError } = await supabase
      .from('products')
      .select('id')
      .eq('Code', code)
      .single();

    if (findError) {
      logOperation(operation, { code }, findError);
      throw new Error(`Product not found with code ${code}: ${findError.message}`);
    }

    if (!existingProduct?.id) {
      throw new Error(`Product not found with code ${code}`);
    }

    // Delete the product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', existingProduct.id);

    if (error) {
      logOperation(operation, { code }, error);
      throw new Error(`Failed to delete product: ${error.message}`);
    }

    logOperation(operation, { code });

  } catch (error) {
    logOperation(operation, { code }, error);
    throw error;
  }
}

// ─── Staff Operations ────────────────────────────────────────────────────────────

export async function fetchAdminStaff(): Promise<AdminStaff[]> {
  const operation = 'fetchAdminStaff';
  
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'manager', 'pharmacist', 'driver'])
      .order('created_at', { ascending: false });

    if (error) {
      logOperation(operation, null, error);
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    const staff: AdminStaff[] = (data || []).map((row: any) => ({
      id: row.id,
      fullName: row.full_name || row.fullName || '',
      username: row.username || '',
      phone: row.phone || '',
      email: row.email || '',
      role: row.role || '',
      status: row.status || 'Active',
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    logOperation(operation, { count: staff.length });
    return staff;

  } catch (error) {
    logOperation(operation, null, error);
    throw error;
  }
}

export async function updateAdminStaff(
  id: string, 
  updates: Partial<Pick<AdminStaff, 'fullName' | 'username' | 'phone' | 'email' | 'role' | 'status'>>
): Promise<AdminStaff> {
  const operation = 'updateAdminStaff';
  
  try {
    if (!id) {
      throw new Error('Staff ID is required for updates');
    }

    const supabase = getSupabaseClient();
    
    // Prepare update data for Supabase schema
    const updateData = {
      ...(updates.fullName && { full_name: updates.fullName }),
      ...(updates.username && { username: updates.username }),
      ...(updates.phone && { phone: updates.phone }),
      ...(updates.email && { email: updates.email }),
      ...(updates.role && { role: updates.role }),
      ...(updates.status && { status: updates.status }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logOperation(operation, { id, updates, updateData }, error);
      throw new Error(`Failed to update staff: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned after update');
    }

    const updatedStaff: AdminStaff = {
      id: data.id,
      fullName: data.full_name || data.fullName || '',
      username: data.username || '',
      phone: data.phone || '',
      email: data.email || '',
      role: data.role || '',
      status: data.status || 'Active',
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    logOperation(operation, { id, updates, updatedStaff });
    return updatedStaff;

  } catch (error) {
    logOperation(operation, { id, updates }, error);
    throw error;
  }
}



// ─── Utility Functions ─────────────────────────────────────────────────────────────

export function handleApiError(error: unknown, fallbackMessage = 'Operation failed'): string {
  const apiError = handleSupabaseError(error);
  return apiError.message || fallbackMessage;
}

export function showSuccessToast(message: string) {
  toast.success(message);
}

export function showErrorToast(error: unknown, fallbackMessage = 'Operation failed') {
  const message = handleApiError(error, fallbackMessage);
  toast.error(message);
}
