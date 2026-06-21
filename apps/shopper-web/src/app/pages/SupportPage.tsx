import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  LucideIcon,
  MessageSquare,
  Package,
  Phone,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { getDeliveryWindowCompactLabel } from "../config";
import { PageHero, SectionIntro, StatTile } from "../components/BrandPrimitives";
import { Reveal } from "../components/Reveal";
import { cn } from "../components/UI";
import { siteContact } from "../data";

type SupportPageType = "shipping" | "returns" | "faq" | "terms" | "privacy";

type SupportPageProps = {
  type: SupportPageType;
};

type LocalizedText = {
  ar: string;
  en: string;
};

type StatItem = {
  value: LocalizedText;
  label: LocalizedText;
};

type ContentBlock = {
  icon: LucideIcon;
  title: LocalizedText;
  body: LocalizedText;
};

type PageConfig = {
  icon: LucideIcon;
  title: LocalizedText;
  eyebrow: LocalizedText;
  description: LocalizedText;
  sectionTitle: LocalizedText;
  sectionDescription: LocalizedText;
  stats: StatItem[];
  blocks: ContentBlock[];
  highlights: LocalizedText[];
  contactNote: LocalizedText;
};

type FaqItem = {
  icon: LucideIcon;
  question: LocalizedText;
  answer: LocalizedText;
};

const DELIVERY_WINDOW_COMPACT_TEXT = {
  ar: getDeliveryWindowCompactLabel("ar"),
  en: getDeliveryWindowCompactLabel("en"),
} satisfies LocalizedText;

const DELIVERY_FEE_CURRENCY_TEXT = {
  ar: "رسوم التوصيل حسب المنطقة",
  en: "Delivery fee by area",
} satisfies LocalizedText;

const SUPPORT_LINKS: Array<{
  type: SupportPageType;
  to: string;
  icon: LucideIcon;
  label: LocalizedText;
}> = [
  { type: "faq", to: "/faq", icon: HelpCircle, label: { ar: "الأسئلة الشائعة", en: "FAQ" } },
  { type: "shipping", to: "/shipping", icon: Truck, label: { ar: "سياسة الشحن والتوصيل", en: "Shipping Policy" } },
  { type: "returns", to: "/returns", icon: RefreshCcw, label: { ar: "الإرجاع", en: "Returns" } },
  { type: "terms", to: "/terms", icon: FileText, label: { ar: "الشروط والأحكام", en: "Terms & Conditions" } },
  { type: "privacy", to: "/privacy", icon: ShieldAlert, label: { ar: "سياسة الخصوصية", en: "Privacy Policy" } },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    icon: Package,
    question: {
      ar: "كيف يمكنني إتمام الطلب عبر الموقع؟",
      en: "How can I place an order through the website?",
    },
    answer: {
      ar: "تصفّح المنتجات، أضف ما تحتاجه إلى السلة، ثم أكمل بيانات التوصيل وراجع الطلب قبل التأكيد النهائي.",
      en: "Browse the products, add the items you need to your cart, then complete the delivery details and review the order before final confirmation.",
    },
  },
  {
    icon: ShieldCheck,
    question: {
      ar: "هل المنتجات المعروضة أصلية ومتوفرة من الصيدلية؟",
      en: "Are the listed products authentic and supplied by the pharmacy?",
    },
    answer: {
      ar: "نعم، المنتجات المعروضة يتم تقديمها من خلال كتالوج الصيدلية المعتمد مع توضيح السعر وحالة التوفر وقت الطلب.",
      en: "Yes. Products are presented through the pharmacy's verified catalog with clear pricing and availability at the time of ordering.",
    },
  },
  {
    icon: Truck,
    question: {
      ar: "ما مدة التوصيل المتوقعة؟",
      en: "What is the expected delivery time?",
    },
    answer: {
      ar: "داخل القاهرة يتم التوصيل في أسرع وقت ممكن، وقد تختلف المدة بحسب المنطقة وحالة توفر المنتج ووقت تأكيد الطلب.",
      en: "Inside Cairo, delivery is as fast as possible, although timing may vary depending on area, product availability, and order confirmation time.",
    },
  },
  {
    icon: Wallet,
    question: {
      ar: "كم تبلغ رسوم التوصيل؟",
      en: "What is the delivery fee?",
    },
    answer: {
      ar: "رسوم التوصيل تُحسب بناءً على منطقتك وتُعرض بوضوح قبل التأكيد النهائي.",
      en: "Delivery fees are calculated based on your area and shown clearly before final confirmation.",
    },
  },
  {
    icon: FileText,
    question: {
      ar: "هل يمكن طلب الأدوية التي تحتاج إلى وصفة طبية؟",
      en: "Can I order prescription-required medications?",
    },
    answer: {
      ar: "بعض المنتجات قد تتطلب وصفة طبية سارية أو مراجعة من الصيدلي قبل إتمام الطلب أو عند الاستلام، وذلك وفقاً لطبيعة المنتج.",
      en: "Some products may require a valid prescription or pharmacist review before the order is completed or upon delivery, depending on the item.",
    },
  },
  {
    icon: RefreshCcw,
    question: {
      ar: "متى يكون الاسترجاع أو الاستبدال متاحاً؟",
      en: "When is a return or exchange accepted?",
    },
    answer: {
      ar: "يُنظر في طلبات الاسترجاع أو الاستبدال عند وجود خطأ في الطلب أو تلف ظاهر أو مشكلة تتعلق بالصلاحية، مع ضرورة التواصل السريع وتقديم بيانات الطلب.",
      en: "Returns or exchanges are reviewed when the order contains the wrong item, visible damage, or an issue related to product expiry, with prompt contact and order details required.",
    },
  },
  {
    icon: Phone,
    question: {
      ar: "كيف أتواصل مع خدمة العملاء؟",
      en: "How can I contact customer service?",
    },
    answer: {
      ar: `يمكنك الاتصال على ${siteContact.phoneDisplay} أو استخدام صفحة التواصل لإرسال استفسارك بخصوص الطلب أو المنتجات أو السياسات.`,
      en: `You can call ${siteContact.phoneDisplay} or use the contact page to send your question about orders, products, or policies.`,
    },
  },
];

const PAGE_CONFIG: Record<SupportPageType, PageConfig> = {
  faq: {
    icon: HelpCircle,
    title: { ar: "الأسئلة الشائعة", en: "Frequently Asked Questions" },
    eyebrow: { ar: "إجابات واضحة وسريعة", en: "Clear, quick answers" },
    description: {
      ar: "جمعنا أهم الأسئلة التي يحتاجها العميل قبل الطلب وأثناءه وبعده، بصياغة مختصرة وواضحة تساعدك على الوصول للمعلومة بسرعة.",
      en: "We gathered the key questions customers need before, during, and after ordering in a concise format that makes answers easy to find.",
    },
    sectionTitle: { ar: "كل ما تحتاج معرفته في مكان واحد", en: "Everything you need in one place" },
    sectionDescription: {
      ar: "إذا لم تجد الإجابة المناسبة هنا، يمكنك التواصل مع فريقنا مباشرة وسنساعدك في أقرب وقت ممكن.",
      en: "If you do not find the answer you need here, our team can help you directly through the contact channels listed on this page.",
    },
    stats: [
      { value: { ar: "7 أسئلة", en: "7 FAQs" }, label: { ar: "الأكثر طلباً", en: "Most requested" } },
      { value: DELIVERY_WINDOW_COMPACT_TEXT, label: { ar: "متوسط التوصيل داخل القاهرة", en: "Typical Cairo delivery" } },
      { value: { ar: "دعم مباشر", en: "Direct support" }, label: { ar: "عند الحاجة للمساعدة", en: "When you need help" } },
    ],
    blocks: [],
    highlights: [
      { ar: "إجابات عملية تغطي الطلب والدفع والتوصيل والاسترجاع.", en: "Practical answers covering ordering, payment, delivery, and returns." },
      { ar: "لغة بسيطة ومباشرة بعيداً عن التعقيد أو الحشو.", en: "Simple, direct language without unnecessary complexity." },
      { ar: "مناسبة للعملاء الجدد والحاليين قبل اتخاذ قرار الشراء.", en: "Useful for both new and returning customers before placing an order." },
    ],
    contactNote: {
      ar: "إذا كان استفسارك مرتبطاً بطلب قائم، جهّز رقم الطلب واسم المنتج لتسريع المساعدة.",
      en: "If your question is related to an existing order, keep the order number and product name ready for faster support.",
    },
  },
  shipping: {
    icon: Truck,
    title: { ar: "سياسة الشحن والتوصيل", en: "Shipping & Delivery Policy" },
    eyebrow: { ar: "معلومات التوصيل", en: "Delivery information" },
    description: {
      ar: "نوضح هنا مناطق التغطية، أوقات التوصيل المتوقعة، رسوم الشحن، وآلية تأكيد الطلب حتى تكون تجربة الشراء واضحة من البداية.",
      en: "This page explains coverage areas, expected delivery windows, shipping fees, and order confirmation steps so the delivery experience stays clear from the start.",
    },
    sectionTitle: { ar: "تفاصيل التوصيل بشكل منظم", en: "Delivery details, clearly organized" },
    sectionDescription: {
      ar: "نعتمد سياسة واضحة لتقليل الالتباس وتمكين العميل من معرفة ما يمكن توقعه قبل إتمام الطلب.",
      en: "We follow a clear delivery policy to reduce uncertainty and help customers understand what to expect before checkout.",
    },
    stats: [
      { value: DELIVERY_WINDOW_COMPACT_TEXT, label: { ar: "داخل القاهرة", en: "Inside Cairo" } },
      { value: DELIVERY_FEE_CURRENCY_TEXT, label: { ar: "رسوم التوصيل", en: "Delivery fee" } },
      { value: { ar: "تأكيد مسبق", en: "Pre-confirmation" }, label: { ar: "قبل تحريك الطلب", en: "Before dispatch" } },
    ],
    blocks: [
      {
        icon: Truck,
        title: { ar: "نطاق التغطية", en: "Coverage Area" },
        body: {
          ar: "نوفّر خدمة التوصيل داخل القاهرة والمناطق التي تخدمها الصيدلية. وتُراجع التغطية النهائية بحسب العنوان المسجل وقت الطلب.",
          en: "We provide delivery across Cairo and the areas served by the pharmacy, with final coverage confirmed according to the delivery address entered at checkout.",
        },
      },
      {
        icon: Clock,
        title: { ar: "مدة التوصيل المتوقعة", en: "Expected Delivery Window" },
        body: {
          ar: "الطلبات داخل القاهرة يتم توصيلها في أسرع وقت ممكن. وقد تزيد المدة في أوقات الذروة أو عند الحاجة لتأكيد بيانات إضافية.",
          en: "Orders inside Cairo are delivered as quickly as possible. Timing can increase during peak periods or when additional order confirmation is required.",
        },
      },
      {
        icon: Wallet,
        title: { ar: "رسوم الشحن", en: "Shipping Fees" },
        body: {
          ar: "رسوم التوصيل تُحسب بناءً على منطقتك وتُعرض بوضوح قبل تأكيد الطلب.",
          en: "Delivery fees are calculated based on your area and shown clearly before order confirmation.",
        },
      },
      {
        icon: CheckCircle2,
        title: { ar: "تأكيد الطلب قبل التوصيل", en: "Order Confirmation Before Dispatch" },
        body: {
          ar: "قد يتواصل فريقنا معك لتأكيد المنتجات والعنوان ووقت التوصيل المناسب، خاصة في الحالات التي تتطلب مراجعة أو عند اختلاف التوفر.",
          en: "Our team may contact you to confirm products, address details, and a suitable delivery time, especially when review is needed or availability changes.",
        },
      },
      {
        icon: Package,
        title: { ar: "التعامل مع نقص التوفر", en: "Handling Limited Availability" },
        body: {
          ar: "إذا تعذر توفير منتج ضمن الطلب، يتم التواصل معك لاقتراح البدائل المتاحة أو تنفيذ الطلب جزئياً بعد موافقتك.",
          en: "If any product becomes unavailable, we will contact you to suggest available alternatives or process a partial order only after your approval.",
        },
      },
    ],
    highlights: [
      { ar: "إبلاغ واضح برسوم الشحن قبل اعتماد الطلب.", en: "Delivery charges are made clear before order approval." },
      { ar: "التوصيل يخضع لتوفر المنتج وصحة بيانات العنوان.", en: "Delivery depends on product availability and correct address details." },
      { ar: "التواصل المسبق جزء أساسي من جودة الخدمة وتقليل الأخطاء.", en: "Pre-delivery communication helps keep the service accurate and reliable." },
    ],
    contactNote: {
      ar: "للاستفسار عن تغطية منطقة معينة، أرسل العنوان المختصر أو اسم المنطقة عبر صفحة التواصل أو الهاتف.",
      en: "For questions about a specific delivery area, send the district name or short address through the contact page or by phone.",
    },
  },
  returns: {
    icon: RefreshCcw,
    title: { ar: "سياسة الاسترجاع", en: "Returns Policy" },
    eyebrow: { ar: "الاسترجاع والاستبدال", en: "Returns and exchanges" },
    description: {
      ar: "حرصاً على سلامة المنتجات الطبية وتنظيم الخدمة، نوضح الحالات التي يمكن فيها مراجعة طلبات الاسترجاع أو الاستبدال والخطوات المطلوبة لذلك.",
      en: "To protect medical product safety and keep service organized, this page explains when return or exchange requests can be reviewed and what steps are required.",
    },
    sectionTitle: { ar: "حالات الاسترجاع المقبولة", en: "Accepted return situations" },
    sectionDescription: {
      ar: "نراجع كل طلب استرجاع أو استبدال وفق حالة المنتج ونوع المشكلة ووقت الإبلاغ عنها.",
      en: "Each return or exchange request is reviewed based on the product condition, the issue reported, and the time of notification.",
    },
    stats: [
      { value: { ar: "14 يوماً", en: "14 Days" }, label: { ar: "مهلة الإبلاغ", en: "Reporting window" } },
      { value: { ar: "قبل الاستخدام", en: "Before Use" }, label: { ar: "حالة المنتج المطلوبة", en: "Required product condition" } },
      { value: { ar: "فحص ومراجعة", en: "Review process" }, label: { ar: "قبل اعتماد الطلب", en: "Before approval" } },
    ],
    blocks: [
      {
        icon: CheckCircle2,
        title: { ar: "الحالات التي يمكن مراجعتها", en: "Cases That Can Be Reviewed" },
        body: {
          ar: "يتم النظر في الاسترجاع أو الاستبدال عند استلام منتج خاطئ، أو منتج تالف ظاهرياً، أو وجود مشكلة تتعلق بتاريخ الصلاحية أو سلامة العبوة.",
          en: "A return or exchange may be reviewed when you receive the wrong product, a visibly damaged item, or a product with an issue related to expiry or package integrity.",
        },
      },
      {
        icon: Clock,
        title: { ar: "مدة تقديم الطلب", en: "Request Timing" },
        body: {
          ar: "يجب التواصل خلال 14 يوماً من تاريخ الاستلام، وكلما كان الإبلاغ أسرع كان من الأسهل التحقق من الحالة ومعالجة الطلب.",
          en: "Please contact us within 14 days of delivery. The sooner the issue is reported, the easier it is to verify and process the request.",
        },
      },
      {
        icon: Package,
        title: { ar: "حالة المنتج عند المراجعة", en: "Required Product Condition" },
        body: {
          ar: "يفضّل أن يكون المنتج بحالته الأصلية وغير مستخدم قدر الإمكان، مع الاحتفاظ بالفاتورة أو بيانات الطلب لتسهيل المراجعة.",
          en: "The product should preferably remain in its original condition and unused whenever possible, with the invoice or order details available for review.",
        },
      },
      {
        icon: FileText,
        title: { ar: "المنتجات الطبية الحساسة", en: "Sensitive Medical Products" },
        body: {
          ar: "بعض المنتجات الطبية أو الدوائية لا يمكن استرجاعها بعد التسليم إلا عند وجود خطأ في الطلب أو تلف واضح أو سبب متعلق بسلامة المنتج.",
          en: "Certain medical or pharmaceutical products cannot be returned after delivery unless there is a clear order error, visible damage, or a product-safety concern.",
        },
      },
      {
        icon: RefreshCcw,
        title: { ar: "آلية الاستبدال أو رد المبلغ", en: "Exchange or Refund Process" },
        body: {
          ar: "بعد مراجعة الحالة والتأكد من استحقاق الطلب، يتم التنسيق معك بشأن الاستبدال أو رد المبلغ وفق الطريقة المناسبة لكل حالة.",
          en: "After the case is reviewed and approved, we coordinate with you regarding either a replacement or a refund according to what fits the situation.",
        },
      },
    ],
    highlights: [
      { ar: "سلامة المنتج تأتي أولاً في قرارات الاسترجاع أو الاستبدال.", en: "Product safety comes first in all return and exchange decisions." },
      { ar: "وجود بيانات الطلب أو الفاتورة يسرّع المعالجة بشكل واضح.", en: "Having your invoice or order details speeds up the process significantly." },
      { ar: "كل حالة تُراجع بشكل منفصل وفق نوع المنتج وطبيعة المشكلة.", en: "Every case is reviewed individually according to product type and issue details." },
    ],
    contactNote: {
      ar: "عند تقديم طلب استرجاع، أرسل رقم الطلب واسم المنتج ووصفاً واضحاً للمشكلة، ويفضل إرفاق صورة عند الحاجة.",
      en: "When submitting a return request, share the order number, product name, and a clear issue description, and include a photo when useful.",
    },
  },
  terms: {
    icon: FileText,
    title: { ar: "الشروط والأحكام", en: "Terms & Conditions" },
    eyebrow: { ar: "شروط استخدام المنصة", en: "Platform usage terms" },
    description: {
      ar: "تنظّم هذه الشروط طريقة استخدام الموقع وآلية الطلب ومسؤوليات كل طرف، بهدف توفير تجربة شراء واضحة ومنضبطة.",
      en: "These terms govern website use, order handling, and the responsibilities of each party to keep the purchasing experience clear and well-structured.",
    },
    sectionTitle: { ar: "أهم البنود التي تنظم الاستخدام", en: "Core rules that govern usage" },
    sectionDescription: {
      ar: "استخدامك للموقع يعني موافقتك على الالتزام بهذه الشروط عند التصفح أو إنشاء الطلبات أو استخدام خدمات الصيدلية الرقمية.",
      en: "By using the website, you agree to follow these terms when browsing, placing orders, or using the pharmacy's digital services.",
    },
    stats: [
      { value: { ar: "18+", en: "18+" }, label: { ar: "للطلبات الحساسة", en: "For sensitive orders" } },
      { value: { ar: "وصفة سارية", en: "Valid Rx" }, label: { ar: "للمنتجات المقيدة", en: "For restricted items" } },
      { value: { ar: "أسعار معلنة", en: "Listed prices" }, label: { ar: "وقت تأكيد الطلب", en: "At confirmation time" } },
    ],
    blocks: [
      {
        icon: FileText,
        title: { ar: "قبول الشروط", en: "Acceptance of Terms" },
        body: {
          ar: "باستخدامك للموقع أو تقديم طلب من خلاله، فإنك تقر بقراءة هذه الشروط والموافقة عليها بالقدر اللازم لاستخدام الخدمة.",
          en: "By using the website or placing an order through it, you acknowledge that you have read and accepted these terms as required for using the service.",
        },
      },
      {
        icon: Package,
        title: { ar: "معلومات المنتجات والأسعار", en: "Product Information & Pricing" },
        body: {
          ar: "نسعى إلى عرض معلومات دقيقة ومحدثة، لكن التوفر والسعر النهائي يعتمدان على حالة المنتج وقت تجهيز الطلب واعتماده من الصيدلية.",
          en: "We aim to present accurate and updated information, but final availability and pricing depend on the product status when the order is prepared and approved by the pharmacy.",
        },
      },
      {
        icon: ShieldCheck,
        title: { ar: "الوصفات الطبية والمنتجات المقيدة", en: "Prescriptions & Restricted Products" },
        body: {
          ar: "بعض المنتجات قد تتطلب وصفة طبية سارية أو تحققاً إضافياً قبل الصرف أو عند التسليم، ولا يُستكمل الطلب ما لم تستوفِ المتطلبات اللازمة.",
          en: "Some products may require a valid prescription or additional verification before dispensing or at delivery, and the order may not proceed unless those requirements are met.",
        },
      },
      {
        icon: CheckCircle2,
        title: { ar: "مسؤولية المستخدم", en: "User Responsibility" },
        body: {
          ar: "يلتزم المستخدم بإدخال بيانات صحيحة ودقيقة، بما في ذلك الاسم ورقم الهاتف والعنوان، ويتحمل مسؤولية أي تأخير أو خطأ ناتج عن بيانات غير صحيحة.",
          en: "Users are responsible for entering accurate details, including name, phone number, and address, and bear responsibility for delays or errors caused by incorrect information.",
        },
      },
      {
        icon: ShieldAlert,
        title: { ar: "حدود الخدمة والمسؤولية", en: "Service Scope & Liability" },
        body: {
          ar: "الموقع يسهّل طلب المنتجات وتنظيم الخدمة، لكنه لا يغني عن استشارة الطبيب أو الصيدلي عند الحاجة، ولا يتحمل مسؤولية سوء استخدام المنتج خلاف التعليمات المعتمدة.",
          en: "The website facilitates ordering and service organization, but it does not replace consultation with a physician or pharmacist when needed, and it is not responsible for misuse of products outside approved instructions.",
        },
      },
    ],
    highlights: [
      { ar: "الأسعار والتوفر يخضعان للمراجعة عند اعتماد الطلب.", en: "Pricing and availability are confirmed when the order is approved." },
      { ar: "إدخال البيانات بدقة جزء أساسي من مسؤولية العميل.", en: "Providing accurate order details is a core customer responsibility." },
      { ar: "الخدمة الرقمية لا تستبدل التوجيه الطبي أو الصيدلي المتخصص.", en: "Digital ordering does not replace professional medical or pharmaceutical guidance." },
    ],
    contactNote: {
      ar: "إذا كانت لديك أسئلة حول متطلبات وصفة طبية أو قبول طلب معين، تواصل معنا قبل إتمام الشراء لتفادي أي التباس.",
      en: "If you have questions about prescription requirements or whether a specific order can be accepted, contact us before checkout to avoid confusion.",
    },
  },
  privacy: {
    icon: ShieldAlert,
    title: { ar: "سياسة الخصوصية", en: "Privacy Policy" },
    eyebrow: { ar: "حماية البيانات", en: "Data protection" },
    description: {
      ar: "نلتزم بالتعامل مع بياناتك الشخصية بمسؤولية ووضوح، ونستخدم فقط ما يلزم لتشغيل الخدمة وتأكيد الطلبات وتحسين تجربة العميل.",
      en: "We handle your personal data with responsibility and transparency, using only what is needed to operate the service, confirm orders, and improve the customer experience.",
    },
    sectionTitle: { ar: "كيف نتعامل مع بياناتك", en: "How we handle your data" },
    sectionDescription: {
      ar: "الهدف من هذه السياسة هو توضيح ما نجمعه، ولماذا نجمعه، وكيف نحافظ عليه ضمن الحدود اللازمة لتقديم الخدمة.",
      en: "This policy explains what we collect, why we collect it, and how we protect it within the limits required to provide the service.",
    },
    stats: [
      { value: { ar: "الحد الأدنى", en: "Minimum only" }, label: { ar: "من البيانات المطلوبة", en: "Data collected" } },
      { value: { ar: "لأغراض الخدمة", en: "Service use" }, label: { ar: "سبب المعالجة", en: "Processing purpose" } },
      { value: { ar: "عند الطلب", en: "On request" }, label: { ar: "تعديل أو حذف البيانات", en: "Edit or delete data" } },
    ],
    blocks: [
      {
        icon: Package,
        title: { ar: "البيانات التي نجمعها", en: "Data We Collect" },
        body: {
          ar: "قد نجمع الاسم ورقم الهاتف والعنوان والبريد الإلكتروني وأي بيانات لازمة لتأكيد الطلب أو التواصل بشأنه أو إتمام التوصيل.",
          en: "We may collect your name, phone number, address, email, and any information needed to confirm the order, communicate about it, or complete delivery.",
        },
      },
      {
        icon: CheckCircle2,
        title: { ar: "أغراض استخدام البيانات", en: "Why We Use Data" },
        body: {
          ar: "نستخدم البيانات لإدارة الطلبات، والتواصل معك بشأن حالة الطلب، وتنسيق التوصيل، وتحسين جودة الخدمة وتجربة الاستخدام.",
          en: "We use data to manage orders, communicate about order status, coordinate delivery, and improve service quality and the user experience.",
        },
      },
      {
        icon: ShieldCheck,
        title: { ar: "حماية المعلومات", en: "Information Protection" },
        body: {
          ar: "نلتزم باتخاذ إجراءات تنظيمية وتقنية مناسبة لحماية البيانات من الوصول غير المصرح به، ونحصر الوصول الداخلي على من يحتاج إليه لتقديم الخدمة.",
          en: "We apply appropriate organizational and technical measures to protect data from unauthorized access, and internal access is limited to those who need it to deliver the service.",
        },
      },
      {
        icon: ShieldAlert,
        title: { ar: "مشاركة البيانات", en: "Data Sharing" },
        body: {
          ar: "لا نشارك بياناتك لأغراض تسويقية مع أطراف خارجية. وقد يتم استخدام البيانات فقط بالقدر اللازم لتوصيل الطلب أو تنفيذ المتطلبات التشغيلية المرتبطة بالخدمة.",
          en: "We do not share your data with third parties for marketing purposes. Data may only be used to the extent necessary for delivery or service-related operational requirements.",
        },
      },
      {
        icon: FileText,
        title: { ar: "حقوقك على بياناتك", en: "Your Rights" },
        body: {
          ar: "يمكنك طلب تحديث بياناتك أو تصحيحها أو حذفها متى كان ذلك ممكناً من الناحية التشغيلية أو التنظيمية، وذلك من خلال التواصل معنا مباشرة.",
          en: "You may request to update, correct, or delete your data whenever operationally and legally possible by contacting us directly.",
        },
      },
    ],
    highlights: [
      { ar: "نجمع فقط ما يساعدنا على تنفيذ الطلب وتقديم الدعم.", en: "We collect only what helps us fulfill orders and provide support." },
      { ar: "لا نستخدم بياناتك في التسويق الخارجي دون أساس واضح.", en: "Your data is not used for external marketing without a clear basis." },
      { ar: "يمكنك التواصل معنا لطلب المراجعة أو التحديث عند الحاجة.", en: "You can contact us to request a review or update whenever needed." },
    ],
    contactNote: {
      ar: "إذا أردت مراجعة بياناتك أو طلب تعديلها، اذكر وسيلة التواصل المرتبطة بالطلب حتى نتمكن من التحقق بشكل صحيح.",
      en: "If you want to review or update your data, please mention the contact method linked to your order so we can verify it correctly.",
    },
  },
};

function copyText(text: LocalizedText, lang: "ar" | "en") {
  return text[lang];
}

export default function SupportPage({ type }: SupportPageProps) {
  const { lang, t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const page = PAGE_CONFIG[type];
  const relatedLinks = SUPPORT_LINKS.filter((item) => item.type !== type);

  return (
    <div className="support-page medical-page medical-shell">
      <PageHero
        lang={lang}
        crumbs={[
          { label: t("home"), to: "/" },
          { label: copyText(page.title, lang) },
        ]}
        eyebrow={
          <span className="badge-teal">
            <page.icon className="h-4 w-4" />
            {copyText(page.eyebrow, lang)}
          </span>
        }
        title={copyText(page.title, lang)}
        description={copyText(page.description, lang)}
        stats={
          <div className="grid gap-3 md:grid-cols-3">
            {page.stats.map((item) => (
              <StatTile
                key={`${item.label.en}-${item.value.en}`}
                value={copyText(item.value, lang)}
                label={copyText(item.label, lang)}
              />
            ))}
          </div>
        }
      />

      <section className="page-section py-10 md:py-14">
        <SectionIntro
          eyebrow={
            <span className="badge-teal">
              <CheckCircle2 className="h-4 w-4" />
              {lang === "ar" ? "دليل منظم" : "Structured guide"}
            </span>
          }
          title={copyText(page.sectionTitle, lang)}
          description={copyText(page.sectionDescription, lang)}
        />

        <div className="support-layout grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {type === "faq"
              ? FAQ_ITEMS.map((item, index) => (
                  <Reveal key={item.question.en} delay={index * 50} direction="up">
                    <div className={cn(
                      "overflow-hidden rounded-2xl border bg-white transition-all",
                      openFaq === index
                        ? "border-[#0E7E74]/30 shadow-[0_8px_24px_rgba(14,126,116,0.10)]"
                        : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md",
                    )}>
                      <button
                        onClick={() => setOpenFaq(openFaq === index ? null : index)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-start"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition-all",
                              openFaq === index
                                ? "bg-[#0A1220] text-[#2DD4C0]"
                                : "bg-slate-50 text-slate-500",
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="text-sm font-black text-slate-900 md:text-base">
                            {copyText(item.question, lang)}
                          </span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200",
                            openFaq === index && "rotate-180 text-slate-600",
                          )}
                        />
                      </button>

                      {openFaq === index && (
                        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 py-4">
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#0E7E74]/10 text-[#0E7E74]">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <p className="text-sm font-semibold leading-7 text-slate-600">
                              {copyText(item.answer, lang)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Reveal>
                ))
              : page.blocks.map((block, index) => (
                  <Reveal key={block.title.en} delay={index * 55} direction="up">
                    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-50/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                      <div className="relative flex items-start gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#0A1220] text-[#2DD4C0]">
                          <block.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="mb-2 text-base font-black text-slate-900">
                            {copyText(block.title, lang)}
                          </h3>
                          <p className="text-sm font-semibold leading-7 text-slate-500">
                            {copyText(block.body, lang)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}
          </div>

          <div className="space-y-4">
            <Reveal direction="up">
              <div className="card-premium p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-[0_14px_30px_rgba(20,184,166,0.22)]">
                  <Phone className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">
                  {lang === "ar" ? "تواصل سريع" : "Quick Contact"}
                </h3>
                <p className="text-sm font-semibold leading-7 text-slate-500">
                  {copyText(page.contactNote, lang)}
                </p>

                <div className="mt-5 space-y-3">
                  <a
                    href={`tel:${siteContact.phoneHref}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                        {lang === "ar" ? "الهاتف" : "Phone"}
                      </p>
                      <p className="text-sm font-black text-slate-900" dir="ltr">
                        {siteContact.phoneDisplay}
                      </p>
                    </div>
                  </a>

                  <Link
                    to="/contact"
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                        {lang === "ar" ? "نموذج التواصل" : "Contact Form"}
                      </p>
                      <p className="text-sm font-black text-slate-900">
                        {lang === "ar" ? "أرسل استفسارك مباشرة" : "Send your question directly"}
                      </p>
                    </div>
                    <ChevronRight className={cn("ms-auto h-4 w-4 text-slate-300", lang === "ar" && "rotate-180")} />
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={60}>
              <div className="card-premium p-6">
                <h3 className="mb-4 text-xl font-bold text-slate-900">
                  {lang === "ar" ? "نقاط مهمة" : "Key Highlights"}
                </h3>
                <div className="space-y-3">
                  {page.highlights.map((item) => (
                    <div
                      key={item.en}
                      className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
                      <p className="text-sm font-semibold leading-7 text-slate-600">
                        {copyText(item, lang)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={110}>
              <div className="card-premium p-6">
                <h3 className="mb-4 text-xl font-bold text-slate-900">
                  {lang === "ar" ? "صفحات مرتبطة" : "Related Pages"}
                </h3>
                <div className="space-y-2">
                  {relatedLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-600"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                        <link.icon className="h-4 w-4" />
                      </div>
                      <span>{copyText(link.label, lang)}</span>
                      <ChevronRight className={cn("ms-auto h-4 w-4 text-slate-300", lang === "ar" && "rotate-180")} />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
