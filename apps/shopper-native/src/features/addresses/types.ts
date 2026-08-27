export type LocationSource = "gps" | "manual" | "gps_corrected";

export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  governorate?: string;
  city: string;
  district: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  delivery_instructions?: string;
  lat?: number;
  lng?: number;
  location_source?: LocationSource;
  location_accuracy_m?: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type AddressFormData = Omit<Address, "id" | "user_id" | "created_at" | "updated_at">;

export const ADDRESS_LABELS = [
  { key: "home",   labelKey: "address.labelHome",   icon: "home-outline",      bg: "#E6F4F2", color: "#0E7E74" },
  { key: "work",   labelKey: "address.labelWork",   icon: "briefcase-outline", bg: "#EFF6FF", color: "#2563EB" },
  { key: "family", labelKey: "address.labelFamily", icon: "people-outline",    bg: "#FDF2F8", color: "#DB2777" },
  { key: "other",  labelKey: "address.labelOther",  icon: "location-outline",  bg: "#F5F3FF", color: "#7C3AED" },
] as const;

export type AddressLabel = (typeof ADDRESS_LABELS)[number]["key"];
