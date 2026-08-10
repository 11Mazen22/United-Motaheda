import { supabase } from "@/lib/supabase";
import type { Address, AddressFormData } from "./types";

export async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Address[];
}

export async function createAddress(userId: string, form: AddressFormData): Promise<Address> {
  if (form.is_default) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({ ...form, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as Address;
}

export async function updateAddress(id: string, userId: string, form: Partial<AddressFormData>): Promise<Address> {
  if (form.is_default) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await supabase
    .from("addresses")
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Address;
}

export async function deleteAddress(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setDefaultAddress(id: string, userId: string): Promise<void> {
  await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId);

  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
