/**
 * Category → Ionicons mapping, shared across every screen that renders a
 * category (Home's CategoryStrip, the category detail screen, product
 * category cards). One source of truth so the same category always gets
 * the same icon, and so no screen falls back to emoji (A10).
 */
import type React from "react";
import type { Ionicons } from "@expo/vector-icons";

export type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const CATEGORY_ICON_MAP: Record<string, IoniconsName> = {
  "العناية بالشعر": "cut-outline",
  "العناية بالبشرة": "sparkles-outline",
  "مستحضرات التجميل والمكياج": "color-palette-outline",
  "العناية بالفم والأسنان": "happy-outline",
  "العطور والروائح": "flower-outline",
  "الإسعافات الأولية والمطهرات": "bandage-outline",
  "الفيتامينات والمكملات الغذائية": "nutrition-outline",
  "المستلزمات الطبية": "medical-outline",
  "الرعاية الصحية العامة": "heart-outline",
  "العناية بالجسم": "body-outline",
  "العناية بالعيون": "eye-outline",
  "صحة المرأة": "woman-outline",
  "الأطفال والرضع": "happy-outline",
  "أدوية": "medkit-outline",
  "العناية بالرجل": "man-outline",
  "الأم والطفل": "heart-outline",
  "التغذية الطبية": "leaf-outline",
};

export function iconForCategory(name: string): IoniconsName {
  return CATEGORY_ICON_MAP[name] ?? "medical-outline";
}
