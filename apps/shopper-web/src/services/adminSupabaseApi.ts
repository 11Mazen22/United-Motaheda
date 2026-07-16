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
  
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

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

    const products: AdminProduct[] = (data || []).map((row: any) => ({
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

    // Prepare update data
    const updateData: Record<string, unknown> = {
      Barcode: payload.Barcode || '',
      Name: payload.Name,
      Name_Ar: payload.Name_Ar,
      Name_En: payload.Name_En,
      Price: Number(payload.Price),
      Stock: Number(payload.Stock),
      Category: payload.Category,
      Category_Name: payload.Category_Name,
      Category_Name_En: payload.Category_Name_En,
      is_active: Number(payload.Stock) > 0,
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
      is_active: Number(payload.Stock) > 0,
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
