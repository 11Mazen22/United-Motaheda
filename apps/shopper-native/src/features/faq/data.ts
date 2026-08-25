import type { NativeTheme } from "@pharmacy/ui-native";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
}

export type FAQCategory = "orders" | "delivery" | "payment" | "returns" | "account" | "products";

export interface FAQCategoryConfig {
  key: FAQCategory;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

/**
 * A function (not a static array) since every color here is theme-reactive;
 * call from inside a component via useMemo(() => getFaqCategories(theme), [theme]).
 *
 * Previously this read kit.color.amber[600]/.red[600]/.teal[500]/.teal[50] --
 * none of which exist on kit.color (confirmed against its real shape), so
 * this threw at import time the moment any screen imported this file. kit
 * being typed `any` hid it from TypeScript entirely.
 */
export function getFaqCategories(theme: NativeTheme): FAQCategoryConfig[] {
  return [
    { key: "orders",   label: "الطلبات",     icon: "bag-handle-outline",   color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight },
    { key: "delivery", label: "التوصيل",     icon: "bicycle-outline",      color: theme.colors.tertiary.base, bg: theme.colors.tertiary.bg },
    { key: "payment",  label: "الدفع",       icon: "card-outline",         color: theme.colors.brand.accent,  bg: theme.colors.brand.accentLight },
    { key: "returns",  label: "الاسترجاع",   icon: "refresh-outline",      color: theme.colors.status.error,  bg: theme.colors.statusSoft.error.bg },
    { key: "account",  label: "الحساب",      icon: "person-outline",       color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight },
    { key: "products", label: "المنتجات",    icon: "medkit-outline",       color: theme.colors.status.success, bg: theme.colors.statusSoft.success.bg },
  ];
}

export const FAQ_DATA: FAQItem[] = [
  // Orders
  { id: "1", category: "orders", question: "كيف أتابع حالة طلبي؟", answer: "يمكنك متابعة طلبك من خلال صفحة \"طلباتي\" في التطبيق. ستجد حالة الطلب محدثة في الوقت الفعلي مع إشعارات لكل تحديث." },
  { id: "2", category: "orders", question: "هل يمكنني إلغاء طلبي بعد تأكيده؟", answer: "نعم، يمكنك إلغاء الطلب خلال 30 دقيقة من تأكيده بشرط عدم بدء التجهيز. بعد ذلك تواصل مع خدمة العملاء." },
  { id: "3", category: "orders", question: "ما هو الحد الأدنى للطلب؟", answer: "الحد الأدنى للطلب هو 50 جنيه. الطلبات فوق 200 جنيه تتمتع بتوصيل مجاني." },
  { id: "4", category: "orders", question: "هل يمكنني تعديل طلبي بعد إرساله؟", answer: "يمكنك التعديل خلال 15 دقيقة من الطلب عبر صفحة تفاصيل الطلب، أو التواصل مع الدعم لأي تعديلات بعد ذلك." },
  // Delivery
  { id: "5", category: "delivery", question: "ما مدة التوصيل المتوقعة؟", answer: "التوصيل يتم خلال 30-60 دقيقة داخل نطاق الخدمة. قد تختلف المدة حسب المنطقة وحالة الازدحام." },
  { id: "6", category: "delivery", question: "هل تتوفر خدمة التوصيل في منطقتي؟", answer: "نغطي معظم مناطق المدينة. أدخل عنوانك في التطبيق وسيظهر لك إذا كانت الخدمة متاحة في منطقتك." },
  { id: "7", category: "delivery", question: "كم تكلفة التوصيل؟", answer: "رسوم التوصيل 15 جنيه للطلبات أقل من 200 جنيه. الطلبات فوق 200 جنيه يكون التوصيل مجاني." },
  // Payment
  { id: "8", category: "payment", question: "ما هي طرق الدفع المتاحة؟", answer: "نقبل الدفع عند الاستلام (نقداً)، التحويل عبر إنستاباي، وفودافون كاش. جميع الطرق آمنة ومؤمنة." },
  { id: "9", category: "payment", question: "هل الدفع الإلكتروني آمن؟", answer: "نعم، جميع المعاملات مشفرة ومؤمنة. لا نحتفظ ببيانات الدفع الخاصة بك على خوادمنا." },
  { id: "10", category: "payment", question: "متى يتم خصم المبلغ؟", answer: "في حالة الدفع الإلكتروني يتم الخصم فور تأكيد الطلب. في حالة الدفع عند الاستلام يتم الدفع للمندوب." },
  // Returns
  { id: "11", category: "returns", question: "ما سياسة الإرجاع؟", answer: "يمكنك إرجاع المنتجات خلال 24 ساعة من الاستلام بشرط عدم فتح العبوة (للأدوية). المستحضرات التجميلية قابلة للإرجاع خلال 7 أيام." },
  { id: "12", category: "returns", question: "كيف أسترد أموالي؟", answer: "يتم رد المبلغ خلال 3-5 أيام عمل بنفس طريقة الدفع الأصلية. ستصلك رسالة تأكيد عند إتمام الاسترداد." },
  // Account
  { id: "13", category: "account", question: "كيف أغير كلمة المرور؟", answer: "اذهب إلى الملف الشخصي > الإعدادات > تغيير كلمة المرور. ستحتاج لإدخال كلمة المرور الحالية ثم الجديدة." },
  { id: "14", category: "account", question: "هل يمكنني حذف حسابي؟", answer: "نعم، يمكنك طلب حذف حسابك من الإعدادات. سيتم حذف جميع بياناتك خلال 30 يوم من الطلب." },
  // Products
  { id: "15", category: "products", question: "هل جميع المنتجات أصلية؟", answer: "نعم، جميع منتجاتنا أصلية 100% ومرخصة من وزارة الصحة. نتعامل مباشرة مع الشركات المصنعة والموزعين المعتمدين." },
  { id: "16", category: "products", question: "ماذا أفعل إذا كان المنتج غير متوفر؟", answer: "يمكنك تفعيل التنبيه عند التوفر من صفحة المنتج، وسنرسل لك إشعار فور عودة المنتج للمخزون." },
];
