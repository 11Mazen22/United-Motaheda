import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HashtagIcon,
  PhotoIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { createAdminProduct, uploadProductImage } from "../../services/adminSupabaseApi";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../components/ui/utils";

type FeedbackTone = "neutral" | "success" | "danger";
type EntryFieldKey =
  | "productName"
  | "costPrice"
  | "sellingPrice"
  | "discountPercent"
  | "quantity"
  | "stockAlert";

type FeedbackState = {
  tone: FeedbackTone;
  text: string;
};

type CompressedImageResult = {
  base64: string;
  width: number;
  height: number;
  sizeBytes: number;
};

type EntryFormState = {
  barcodeInput: string;
  lockedBarcode: string;
  productName: string;
  categoryId: string;
  costPrice: string;
  sellingPrice: string;
  discountPercent: string;
  quantity: string;
  stockAlert: string;
};

const MAX_IMAGE_DIMENSION = 800;
const TARGET_IMAGE_BYTES = 150 * 1024;
const INITIAL_JPEG_QUALITY = 0.7;
const MIN_JPEG_QUALITY = 0.45;
const FLOW_FIELDS: EntryFieldKey[] = [
  "productName",
  "costPrice",
  "sellingPrice",
  "discountPercent",
  "quantity",
  "stockAlert",
];

const EMPTY_FORM: EntryFormState = {
  barcodeInput: "",
  lockedBarcode: "",
  productName: "",
  categoryId: "",
  costPrice: "",
  sellingPrice: "",
  discountPercent: "",
  quantity: "",
  stockAlert: "",
};

function sanitizeBarcode(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function estimateBase64Bytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatFileSize(bytes: number, lang: "ar" | "en") {
  if (!bytes) return lang === "ar" ? "0 ك.ب" : "0 KB";
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} ${lang === "ar" ? "ك.ب" : "KB"}`;
  return `${(kilobytes / 1024).toFixed(1)} ${lang === "ar" ? "م.ب" : "MB"}`;
}

function formatMoney(value: number | null, lang: "ar" | "en") {
  if (value === null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseOptionalNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalInteger(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to process the selected image."));
    image.src = url;
  });
}

async function compressCapturedImage(file: File, canvas: HTMLCanvasElement) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(objectUrl);
    const largestDimension = Math.max(image.naturalWidth, image.naturalHeight) || 1;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestDimension);
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Unable to prepare image compression.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = INITIAL_JPEG_QUALITY;
    let base64 = canvas.toDataURL("image/jpeg", quality);
    let sizeBytes = estimateBase64Bytes(base64);

    while (sizeBytes > TARGET_IMAGE_BYTES && quality > MIN_JPEG_QUALITY) {
      quality = Math.max(MIN_JPEG_QUALITY, Number((quality - 0.08).toFixed(2)));
      base64 = canvas.toDataURL("image/jpeg", quality);
      sizeBytes = estimateBase64Bytes(base64);
    }

    return {
      base64,
      width: targetWidth,
      height: targetHeight,
      sizeBytes,
    } satisfies CompressedImageResult;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function buildCopy(lang: "ar" | "en") {
  if (lang === "ar") {
    return {
      eyebrow: "إدخال سريع",
      title: "محطة إدخال المنتجات السريع",
      description:
        "تدفق منظم لإدخال الباركود والصورة والتسعير والمخزون في مسودة واحدة جاهزة للمراجعة.",
      modeCards: [
        { label: "التعريف", value: "باركود + اسم + صورة" },
        { label: "التسعير", value: "تكلفة وبيع وخصم" },
        { label: "المخرجات", value: "مسودة جاهزة للمراجعة" },
      ],
      sections: {
        identification: {
          title: "تعريف المنتج",
          description:
            "ابدأ بالباركود ثم التقط الصورة، وبعدها أكمل اسم المنتج. هذا الجزء هو الأساس المطلوب للحفظ.",
        },
        pricing: {
          title: "التسعير",
          description: "حقول اختيارية لتجهيز التكلفة وسعر البيع والخصم داخل نفس التدفق.",
        },
        inventory: {
          title: "المخزون",
          description: "أدخل الكمية الحالية وحد التنبيه إذا أردت تجهيز بيانات المخزون من أول مرة.",
        },
        preview: {
          title: "المعاينة والحالة",
          description: "راجع الصورة، الحقول المكتملة، ومؤشرات الجاهزية قبل حفظ المسودة.",
        },
      },
      fields: {
        barcodeLabel: "الباركود (Barcode)",
        barcodePlaceholder: "امسح الباركود أو اكتبه ثم اضغط Enter",
        barcodeHint: "هذا الحقل مهيأ للماسح اليدوي وللكتابة السريعة من لوحة الهاتف.",
        lockedBarcodeLabel: "الباركود المثبت",
        lockedBarcodePlaceholder: "لم يتم تثبيت باركود بعد",
        productNameLabel: "اسم المنتج (Product Name)",
        productNamePlaceholder: "مثال: Panadol Extra - بنادول إكسترا",
        productNameHint:
          "إذا اكتملت الصورة والباركود، يمكن الضغط Enter من هذا الحقل للحفظ مباشرة.",
        categoryLabel: "القسم",
        categoryPlaceholder: "اختر القسم",
        categoryHint: "القسم مطلوب حتى يظهر المنتج في المكان الصحيح بالمتجر.",
        costPriceLabel: "سعر التكلفة",
        costPricePlaceholder: "مثال: 48.50",
        sellingPriceLabel: "سعر البيع",
        sellingPricePlaceholder: "مثال: 64.00",
        discountPercentLabel: "الخصم %",
        discountPercentPlaceholder: "0",
        quantityLabel: "الكمية الحالية",
        quantityPlaceholder: "مثال: 24",
        stockAlertLabel: "حد التنبيه",
        stockAlertPlaceholder: "مثال: 5",
      },
      hints: {
        optional: "اختياري",
        pricing: "سعر التكلفة اختياري. سعر البيع مطلوب لأن المنتج يُنشر مباشرة في المتجر.",
        inventory: "أدخل أرقامًا صحيحة فقط للكمية وحد التنبيه.",
        compression: "يتم ضغط الصورة تلقائيًا إلى JPEG خفيف لتسريع الإرسال.",
        keyboard:
          "Enter من حقل الباركود يفتح الكاميرا، وCtrl + Enter يحفظ المسودة من أي حقل.",
        captureLocked: "الباركود مثبت. التقط صورة واضحة لعبوة المنتج أو الدواء.",
        captureUnlocked: "ثبّت الباركود أولاً ثم افتح الكاميرا لالتقاط الصورة.",
        previewPlaceholder:
          "لا توجد صورة بعد. بعد تثبيت الباركود يمكنك فتح الكاميرا مباشرة من الهاتف.",
      },
      actions: {
        capture: "تثبيت الباركود وفتح الكاميرا",
        recapture: "إعادة التقاط الصورة",
        save: "حفظ المسودة",
        saving: "جارٍ الحفظ...",
        reset: "عنصر جديد",
      },
      status: {
        draft: "مسودة للمراجعة",
        ready: "جاهز للحفظ",
        notReady: "أكمل بيانات التعريف أولًا",
        imageWaiting: "بانتظار الصورة",
        imageReady: "الصورة جاهزة",
        capturedAt: "وقت الالتقاط",
        imageSize: "الحجم بعد الضغط",
        imageResolution: "الأبعاد",
        operator: "المسؤول",
        identificationReady: "بيانات التعريف مكتملة",
        identificationPending: "أكمل الباركود والاسم والصورة",
        pricingReady: "تم إدخال بيانات تسعير",
        pricingPending: "التسعير اختياري",
        inventoryReady: "تم إدخال بيانات مخزون",
        inventoryPending: "المخزون اختياري",
        costPrice: "التكلفة",
        sellingPrice: "البيع",
        discountPercent: "الخصم",
        quantity: "الكمية",
        stockAlert: "حد التنبيه",
      },
      feedback: {
        start:
          "ابدأ بمسح الباركود أو كتابته، ثم التقط الصورة وأكمل اسم المنتج. يمكنك إضافة التسعير والمخزون إذا كانت البيانات متاحة.",
        barcodeRequired: "امسح الباركود أو اكتبه قبل المتابعة.",
        barcodeLocked: "تم تثبيت الباركود. افتح الكاميرا الآن لالتقاط صورة المنتج.",
        barcodeAlreadyLocked:
          "الباركود مثبت بالفعل. التقط الصورة أو أعد التهيئة لعنصر جديد.",
        imagePreparing: "جارٍ تجهيز الصورة وضغطها للإرسال...",
        imageReady: "تم تجهيز الصورة بنجاح. أكمل اسم المنتج ثم احفظ المسودة.",
        imageFailed: "تعذر تجهيز الصورة المختارة. جرّب التقاط صورة أوضح.",
        imageMissing: "التقط صورة للمنتج قبل حفظ المسودة.",
        productNameRequired: "أدخل اسم المنتج قبل الحفظ.",
        categoryRequired: "اختر قسم المنتج قبل الحفظ.",
        costPriceInvalid: "أدخل سعر تكلفة صالحًا أو اترك الحقل فارغًا.",
        sellingPriceInvalid: "أدخل سعر بيع صالحًا أكبر من صفر — هذا الحقل مطلوب لأن المنتج سيظهر مباشرة في المتجر.",
        discountInvalid: "أدخل نسبة خصم من 0 إلى 100 أو اترك الحقل فارغًا.",
        quantityInvalid: "أدخل كمية صحيحة بدون كسور أو اترك الحقل فارغًا.",
        stockAlertInvalid: "أدخل حد تنبيه صحيح بدون كسور أو اترك الحقل فارغًا.",
        saveSuccess: "تم حفظ المسودة وإعادة تجهيز الشاشة للعنصر التالي.",
        saveToast: "تم حفظ المنتج بنجاح",
        saveError: "تعذر حفظ المسودة حاليًا. حاول مرة أخرى.",
        resetSuccess: "تمت إعادة التهيئة. الشاشة جاهزة للمنتج التالي.",
      },
      summaryTitle: "لوحة السرعة",
      summaryDescription:
        "ملخص فوري للحالة الحالية مع اختصارات تساعد على الإدخال من دون نقرات إضافية.",
    };
  }

  return {
    eyebrow: "Fast entry",
    title: "High-speed product intake station",
    description:
      "A cleaner pharmacy intake flow: lock the barcode, open the phone camera instantly, then save a structured draft with pricing and inventory details when available.",
    modeCards: [
      { label: "Identification", value: "Barcode + name + photo" },
      { label: "Pricing", value: "Cost, sell, discount" },
      { label: "Output", value: "Draft ready for review" },
    ],
    sections: {
      identification: {
        title: "Product identification",
        description:
          "Start with the barcode, capture the product image, then complete the product name. These are the required draft fields.",
      },
      pricing: {
        title: "Pricing",
        description: "Optional fields for cost, selling price, and discount inside the same fast workflow.",
      },
      inventory: {
        title: "Inventory",
        description: "Add quantity and stock-alert values if they are already available at entry time.",
      },
      preview: {
        title: "Preview and status",
        description: "Review the image, completed sections, and readiness indicators before saving.",
      },
    },
    fields: {
      barcodeLabel: "Barcode",
      barcodePlaceholder: "Scan or type the barcode, then press Enter",
      barcodeHint: "This field stays friendly for both hardware scanners and quick phone typing.",
      lockedBarcodeLabel: "Locked barcode",
      lockedBarcodePlaceholder: "No barcode locked yet",
      productNameLabel: "Product name",
      productNamePlaceholder: "Example: Panadol Extra",
      productNameHint:
        "If the image is ready and the barcode is locked, pressing Enter here can save immediately.",
      categoryLabel: "Category",
      categoryPlaceholder: "Select a category",
      categoryHint: "Required so the product shows up in the right place in the store.",
      costPriceLabel: "Cost price",
      costPricePlaceholder: "Example: 48.50",
      sellingPriceLabel: "Selling price",
      sellingPricePlaceholder: "Example: 64.00",
      discountPercentLabel: "Discount %",
      discountPercentPlaceholder: "0",
      quantityLabel: "Current quantity",
      quantityPlaceholder: "Example: 24",
      stockAlertLabel: "Stock alert",
      stockAlertPlaceholder: "Example: 5",
    },
    hints: {
      optional: "Optional",
      pricing: "Cost price is optional. Selling price is required — the product publishes to the store immediately.",
      inventory: "Use whole numbers only for quantity and stock alert.",
      compression: "The image is compressed automatically to a lightweight JPEG.",
      keyboard:
        "Enter on the barcode field opens the camera, and Ctrl + Enter saves from any field.",
      captureLocked: "Barcode locked. Capture a clear image of the product or medicine pack.",
      captureUnlocked: "Lock the barcode first, then open the camera to capture the product.",
      previewPlaceholder:
        "No image yet. Once the barcode is locked, you can open the phone camera directly from here.",
    },
    actions: {
      capture: "Lock barcode and open camera",
      recapture: "Retake image",
      save: "Save draft",
      saving: "Saving...",
      reset: "New item",
    },
    status: {
      draft: "Draft for review",
      ready: "Ready to save",
      notReady: "Finish identification first",
      imageWaiting: "Waiting for image",
      imageReady: "Image ready",
      capturedAt: "Captured at",
      imageSize: "Compressed size",
      imageResolution: "Resolution",
      operator: "Operator",
      identificationReady: "Identification complete",
      identificationPending: "Finish barcode, name, and image",
      pricingReady: "Pricing values added",
      pricingPending: "Pricing is optional",
      inventoryReady: "Inventory values added",
      inventoryPending: "Inventory is optional",
      costPrice: "Cost",
      sellingPrice: "Sell",
      discountPercent: "Discount",
      quantity: "Quantity",
      stockAlert: "Alert level",
    },
    feedback: {
      start:
        "Start by scanning or typing the barcode, then capture the image and complete the product name. Add pricing and inventory only if available.",
      barcodeRequired: "Scan or type the barcode before continuing.",
      barcodeLocked: "Barcode locked. Open the camera now to capture the product image.",
      barcodeAlreadyLocked: "The barcode is already locked. Capture the image or reset for a new item.",
      imagePreparing: "Preparing and compressing the selected image...",
      imageReady: "Image prepared successfully. Complete the product name, then save the draft.",
      imageFailed: "The selected image could not be prepared. Try taking a clearer photo.",
      imageMissing: "Capture a product image before saving the draft.",
      productNameRequired: "Enter the product name before saving.",
      categoryRequired: "Select a category before saving.",
      costPriceInvalid: "Enter a valid cost price or leave the field empty.",
      sellingPriceInvalid: "Enter a valid selling price greater than zero — required because this product goes live in the store immediately.",
      discountInvalid: "Enter a discount between 0 and 100 or leave the field empty.",
      quantityInvalid: "Enter a whole quantity value or leave the field empty.",
      stockAlertInvalid: "Enter a whole stock-alert value or leave the field empty.",
      saveSuccess: "Draft saved and the screen is ready for the next item.",
      saveToast: "Product saved successfully",
      saveError: "Unable to save the draft right now. Please try again.",
      resetSuccess: "Entry reset. The next item can be scanned immediately.",
    },
    summaryTitle: "Speed panel",
    summaryDescription:
      "Live status, completion hints, and keyboard shortcuts for faster admin entry work.",
  };
}

function SectionShell({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-100">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold tracking-[-0.02em] text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function FieldShell({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</label>
        {optional ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {optional}
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-xs font-semibold leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.2rem] border px-4 py-3",
        highlight ? "border-teal-200 bg-teal-50/80" : "border-slate-200 bg-slate-50/70",
      )}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ReadinessRow({
  label,
  readyLabel,
  pendingLabel,
  ready,
}: {
  label: string;
  readyLabel: string;
  pendingLabel: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
      <span
        className={cn(
          "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
        )}
      >
        {ready ? <CheckCircleIcon className="h-5 w-5" /> : <ExclamationTriangleIcon className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
          {ready ? readyLabel : pendingLabel}
        </p>
      </div>
    </div>
  );
}

export default function FastProductEntry() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { categories } = useCatalog();
  const copy = useMemo(() => buildCopy(lang), [lang]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const productNameInputRef = useRef<HTMLInputElement | null>(null);
  const costPriceInputRef = useRef<HTMLInputElement | null>(null);
  const sellingPriceInputRef = useRef<HTMLInputElement | null>(null);
  const discountPercentInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const stockAlertInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [formValues, setFormValues] = useState<EntryFormState>(EMPTY_FORM);
  const [snapshotBase64, setSnapshotBase64] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [compressedImageSize, setCompressedImageSize] = useState(0);
  const [compressedImageResolution, setCompressedImageResolution] = useState("");
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    tone: "neutral",
    text: copy.feedback.start,
  });

  const operatorLabel = useMemo(
    () =>
      user?.fullName?.trim() ||
      user?.username?.trim() ||
      user?.phone?.trim() ||
      (lang === "ar" ? "غير محدد" : "Unassigned"),
    [lang, user?.fullName, user?.phone, user?.username],
  );

  const fieldRefs: Record<EntryFieldKey, MutableRefObject<HTMLInputElement | null>> = {
    productName: productNameInputRef,
    costPrice: costPriceInputRef,
    sellingPrice: sellingPriceInputRef,
    discountPercent: discountPercentInputRef,
    quantity: quantityInputRef,
    stockAlert: stockAlertInputRef,
  };

  const focusBarcodeInput = useCallback((select = false) => {
    window.requestAnimationFrame(() => {
      const input = barcodeInputRef.current;
      if (!input) return;
      input.focus();
      if (select) input.select();
    });
  }, []);

  const focusField = useCallback(
    (field: EntryFieldKey, select = true) => {
      window.requestAnimationFrame(() => {
        const input = fieldRefs[field].current;
        if (!input) return;
        input.focus();
        if (select) input.select();
      });
    },
    [fieldRefs],
  );

  useEffect(() => { focusBarcodeInput(); }, [focusBarcodeInput]);

  useEffect(() => {
    setFeedback((current) =>
      current.tone === "neutral" ? { tone: "neutral", text: copy.feedback.start } : current,
    );
  }, [copy.feedback.start]);

  const updateField = useCallback(
    (field: keyof EntryFormState, value: string) => {
      setFormValues((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const resetForm = useCallback(
    (nextFeedback?: FeedbackState) => {
      setFormValues(EMPTY_FORM);
      setSnapshotBase64("");
      setCapturedAt("");
      setCompressedImageSize(0);
      setCompressedImageResolution("");
      setIsPreparingImage(false);
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFeedback(nextFeedback ?? { tone: "success", text: copy.feedback.resetSuccess });
      focusBarcodeInput(true);
    },
    [copy.feedback.resetSuccess, focusBarcodeInput],
  );

  const lockBarcode = useCallback(() => {
    if (formValues.lockedBarcode) {
      setFeedback({ tone: "neutral", text: copy.feedback.barcodeAlreadyLocked });
      return formValues.lockedBarcode;
    }
    const nextBarcode = sanitizeBarcode(formValues.barcodeInput);
    if (!nextBarcode) {
      setFeedback({ tone: "danger", text: copy.feedback.barcodeRequired });
      focusBarcodeInput(true);
      return "";
    }
    setFormValues((current) => ({
      ...current,
      barcodeInput: nextBarcode,
      lockedBarcode: nextBarcode,
    }));
    setFeedback({ tone: "neutral", text: copy.feedback.barcodeLocked });
    return nextBarcode;
  }, [copy.feedback.barcodeRequired, copy.feedback.barcodeLocked, copy.feedback.barcodeAlreadyLocked, focusBarcodeInput, formValues.barcodeInput, formValues.lockedBarcode]);

  const openNativeCamera = useCallback(() => {
    if (isPreparingImage || isSubmitting) return;
    const nextBarcode = lockBarcode();
    if (!nextBarcode) return;
    fileInputRef.current?.click();
  }, [isPreparingImage, isSubmitting, lockBarcode]);

  const requestSubmit = useCallback(() => { formRef.current?.requestSubmit(); }, []);

  const hasSnapshot = Boolean(snapshotBase64);
  const hasPricingValues = Boolean(formValues.costPrice.trim() || formValues.sellingPrice.trim() || formValues.discountPercent.trim());
  const hasInventoryValues = Boolean(formValues.quantity.trim() || formValues.stockAlert.trim());
  const hasValidSellingPrice = (() => {
    const parsed = parseOptionalNumber(formValues.sellingPrice);
    return parsed !== null && !Number.isNaN(parsed) && parsed > 0;
  })();
  const readyToSubmit = Boolean(
    formValues.lockedBarcode
    && formValues.productName.trim()
    && formValues.categoryId
    && hasValidSellingPrice
    && snapshotBase64
    && !isPreparingImage
    && !isSubmitting,
  );

  const handleBarcodeEnter = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      openNativeCamera();
    },
    [openNativeCamera],
  );

  const handleFieldKeyDown = useCallback(
    (field: EntryFieldKey) => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) { requestSubmit(); return; }
      if (field === "productName" && readyToSubmit && !hasPricingValues && !hasInventoryValues) { requestSubmit(); return; }
      const currentIndex = FLOW_FIELDS.indexOf(field);
      const nextField = FLOW_FIELDS[currentIndex + 1];
      if (nextField) { focusField(nextField); return; }
      requestSubmit();
    },
    [focusField, hasInventoryValues, hasPricingValues, readyToSubmit, requestSubmit],
  );

  const handleImageSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const canvas = canvasRef.current;
      if (!canvas) { setFeedback({ tone: "danger", text: copy.feedback.imageFailed }); return; }
      setIsPreparingImage(true);
      setFeedback({ tone: "neutral", text: copy.feedback.imagePreparing });
      try {
        const compressedImage = await compressCapturedImage(file, canvas);
        setSnapshotBase64(compressedImage.base64);
        setCapturedAt(new Date().toISOString());
        setCompressedImageSize(compressedImage.sizeBytes);
        setCompressedImageResolution(`${compressedImage.width} x ${compressedImage.height}`);
        setFeedback({ tone: "success", text: copy.feedback.imageReady });
        focusField("productName");
      } catch (error) {
        setSnapshotBase64("");
        setCapturedAt("");
        setCompressedImageSize(0);
        setCompressedImageResolution("");
        setFeedback({ tone: "danger", text: error instanceof Error ? error.message : copy.feedback.imageFailed });
      } finally { setIsPreparingImage(false); }
    },
    [copy.feedback.imageFailed, copy.feedback.imagePreparing, copy.feedback.imageReady, focusField],
  );

  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;
      if (!formValues.lockedBarcode) { setFeedback({ tone: "danger", text: copy.feedback.barcodeRequired }); focusBarcodeInput(true); return; }
      if (!snapshotBase64) { setFeedback({ tone: "danger", text: copy.feedback.imageMissing }); return; }
      const nextProductName = formValues.productName.trim();
      if (!nextProductName) { setFeedback({ tone: "danger", text: copy.feedback.productNameRequired }); focusField("productName"); return; }
      if (!formValues.categoryId) { setFeedback({ tone: "danger", text: copy.feedback.categoryRequired }); return; }
      const costPrice = parseOptionalNumber(formValues.costPrice);
      if (Number.isNaN(costPrice) || (costPrice !== null && costPrice < 0)) { setFeedback({ tone: "danger", text: copy.feedback.costPriceInvalid }); focusField("costPrice"); return; }
      const sellingPrice = parseOptionalNumber(formValues.sellingPrice);
      if (Number.isNaN(sellingPrice) || sellingPrice === null || sellingPrice <= 0) { setFeedback({ tone: "danger", text: copy.feedback.sellingPriceInvalid }); focusField("sellingPrice"); return; }
      const discountPercent = parseOptionalNumber(formValues.discountPercent);
      if (Number.isNaN(discountPercent) || (discountPercent !== null && (discountPercent < 0 || discountPercent > 100))) { setFeedback({ tone: "danger", text: copy.feedback.discountInvalid }); focusField("discountPercent"); return; }
      const quantity = parseOptionalInteger(formValues.quantity);
      if (Number.isNaN(quantity) || (quantity !== null && quantity < 0)) { setFeedback({ tone: "danger", text: copy.feedback.quantityInvalid }); focusField("quantity"); return; }
      const stockAlert = parseOptionalInteger(formValues.stockAlert);
      if (Number.isNaN(stockAlert) || (stockAlert !== null && stockAlert < 0)) { setFeedback({ tone: "danger", text: copy.feedback.stockAlertInvalid }); focusField("stockAlert"); return; }

      // This now creates a real, immediately-live row in the products table
      // (is_active defaults true — see createAdminProduct) rather than a
      // spreadsheet draft awaiting human review, so pricing can no longer be
      // optional the way the "draft" copy above still describes: a live,
      // purchasable product with no real price is a genuine storefront bug,
      // not a harmless placeholder. sellingPrice is validated > 0 above.
      const category = categories.find((c) => c.id === formValues.categoryId);

      setIsSubmitting(true);
      try {
        const imageUrl = await uploadProductImage(snapshotBase64, formValues.lockedBarcode);
        await createAdminProduct({
          Code: formValues.lockedBarcode,
          Barcode: formValues.lockedBarcode,
          Name: nextProductName,
          Name_Ar: nextProductName,
          Name_En: nextProductName,
          Price: sellingPrice,
          Stock: quantity ?? 0,
          Category: formValues.categoryId,
          Category_Name: category?.name || "",
          Category_Name_En: category?.nameEn || category?.name || "",
          image_url: imageUrl,
        });
        toast.success(copy.feedback.saveToast);
        resetForm({ tone: "success", text: copy.feedback.saveSuccess });
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : copy.feedback.saveError;
        setFeedback({ tone: "danger", text: message });
        toast.error(message);
      } finally { setIsSubmitting(false); }
    },
    [categories, copy.feedback, focusBarcodeInput, focusField, formValues, isSubmitting, resetForm, snapshotBase64],
  );

  const capturedAtLabel = capturedAt
    ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(capturedAt))
    : copy.status.imageWaiting;
  const compressedSizeLabel = formatFileSize(compressedImageSize, lang);

  return (
    <div className="mx-auto w-full max-w-[110rem] space-y-6 pb-8">
      <Card className="overflow-hidden rounded-[2rem] border-slate-200/80 bg-white shadow-sm">
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] xl:p-7">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-teal-700 shadow-sm">
              <SparklesIcon className="h-4 w-4" />
              {copy.eyebrow}
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-bold tracking-[-0.045em] text-slate-950 sm:text-[2.7rem]">
                {copy.title}
              </h1>
              <p className="max-w-3xl text-sm font-semibold leading-7 text-slate-600 sm:text-[15px]">
                {copy.description}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {copy.modeCards.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.45rem] border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
        <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-200/80 bg-white/80 pb-5">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-[-0.03em] text-slate-950">
                {copy.sections.identification.title}
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm font-semibold leading-7 text-slate-500">
                {copy.sections.identification.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pb-6 pt-6">
            <form ref={formRef} className="space-y-5" onSubmit={handleSave}>
              <SectionShell icon={HashtagIcon} title={copy.sections.identification.title} description={copy.sections.identification.description}>
                <FieldShell label={copy.fields.barcodeLabel} hint={copy.fields.barcodeHint}>
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <Input
                      ref={barcodeInputRef}
                      id="fast-entry-barcode"
                      value={formValues.barcodeInput}
                      onChange={(event) => updateField("barcodeInput", event.target.value)}
                      onKeyDown={handleBarcodeEnter}
                      placeholder={copy.fields.barcodePlaceholder}
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="numeric"
                      dir="ltr"
                      readOnly={Boolean(formValues.lockedBarcode)}
                      className="admin-input h-14 rounded-[1.25rem] border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15 read-only:bg-slate-100"
                    />
                    <Button
                      type="button"
                      onClick={openNativeCamera}
                      disabled={isPreparingImage || isSubmitting}
                      className="h-14 rounded-[1.25rem] bg-slate-950 px-5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 lg:min-w-64"
                    >
                      {isPreparingImage ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PhotoIcon className="h-4 w-4" />}
                      {copy.actions.capture}
                    </Button>
                  </div>
                </FieldShell>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <FieldShell label={copy.fields.lockedBarcodeLabel}>
                    <Input
                      value={formValues.lockedBarcode}
                      readOnly
                      placeholder={copy.fields.lockedBarcodePlaceholder}
                      dir="ltr"
                      className="admin-input h-13 rounded-[1.2rem] border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm read-only:bg-slate-100"
                    />
                  </FieldShell>
                  <div className="rounded-[1.5rem] border border-dashed border-teal-200 bg-[#f0fdfa] p-4">
                    <button
                      type="button"
                      onClick={openNativeCamera}
                      disabled={isPreparingImage || isSubmitting}
                      className={cn(
                        "flex w-full flex-col items-center justify-center rounded-[1.35rem] border border-white/70 px-5 py-7 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15",
                        hasSnapshot ? "bg-white text-slate-900 hover:bg-slate-50" : "bg-slate-950 text-white hover:bg-slate-800",
                        (isPreparingImage || isSubmitting) && "cursor-not-allowed opacity-70",
                      )}
                    >
                      {isPreparingImage ? <ArrowPathIcon className="mb-3 h-9 w-9 animate-spin" /> : <PhotoIcon className="mb-3 h-9 w-9" />}
                      <span className="text-base font-bold tracking-[-0.02em]">
                        {hasSnapshot ? copy.actions.recapture : copy.actions.capture}
                      </span>
                      <span className={cn("mt-2 max-w-md text-sm font-semibold leading-7", hasSnapshot ? "text-slate-500" : "text-white/85")}>
                        {formValues.lockedBarcode ? copy.hints.captureLocked : copy.hints.captureUnlocked}
                      </span>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      <span className="rounded-full border border-teal-100 bg-white px-3 py-2 text-teal-700">{copy.hints.compression}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-600">{copy.status.draft}</span>
                    </div>
                  </div>
                </div>
                <FieldShell label={copy.fields.productNameLabel} hint={copy.fields.productNameHint}>
                  <Input
                    ref={productNameInputRef}
                    id="fast-entry-product-name"
                    value={formValues.productName}
                    onChange={(event) => updateField("productName", event.target.value)}
                    onKeyDown={handleFieldKeyDown("productName")}
                    placeholder={copy.fields.productNamePlaceholder}
                    autoComplete="off"
                    autoCapitalize="words"
                    className="admin-input h-14 rounded-[1.25rem] border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15"
                  />
                </FieldShell>
                <FieldShell label={copy.fields.categoryLabel} hint={copy.fields.categoryHint}>
                  <select
                    id="fast-entry-category"
                    value={formValues.categoryId}
                    onChange={(event) => updateField("categoryId", event.target.value)}
                    className="admin-input h-14 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/15"
                  >
                    <option value="">{copy.fields.categoryPlaceholder}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {lang === "ar" ? category.name : category.nameEn || category.name}
                      </option>
                    ))}
                  </select>
                </FieldShell>
              </SectionShell>

              <SectionShell icon={BanknotesIcon} title={copy.sections.pricing.title} description={copy.sections.pricing.description}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FieldShell label={copy.fields.costPriceLabel} hint={copy.hints.pricing} optional={copy.hints.optional}>
                    <Input
                      ref={costPriceInputRef}
                      value={formValues.costPrice}
                      onChange={(event) => updateField("costPrice", event.target.value)}
                      onKeyDown={handleFieldKeyDown("costPrice")}
                      placeholder={copy.fields.costPricePlaceholder}
                      autoComplete="off"
                      inputMode="decimal"
                      dir="ltr"
                      className="admin-input h-13 rounded-[1.2rem] border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15"
                    />
                  </FieldShell>
                  <FieldShell label={copy.fields.sellingPriceLabel}>
                    <Input
                      ref={sellingPriceInputRef}
                      value={formValues.sellingPrice}
                      onChange={(event) => updateField("sellingPrice", event.target.value)}
                      onKeyDown={handleFieldKeyDown("sellingPrice")}
                      placeholder={copy.fields.sellingPricePlaceholder}
                      autoComplete="off"
                      inputMode="decimal"
                      dir="ltr"
                      className="admin-input h-13 rounded-[1.2rem] border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15"
                    />
                  </FieldShell>
                  <FieldShell label={copy.fields.discountPercentLabel} optional={copy.hints.optional}>
                    <Input
                      ref={discountPercentInputRef}
                      value={formValues.discountPercent}
                      onChange={(event) => updateField("discountPercent", event.target.value)}
                      onKeyDown={handleFieldKeyDown("discountPercent")}
                      placeholder={copy.fields.discountPercentPlaceholder}
                      autoComplete="off"
                      inputMode="decimal"
                      dir="ltr"
                      className="admin-input h-13 rounded-[1.2rem] border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15"
                    />
                  </FieldShell>
                </div>
              </SectionShell>

              <SectionShell icon={ArchiveBoxIcon} title={copy.sections.inventory.title} description={copy.sections.inventory.description}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell label={copy.fields.quantityLabel} hint={copy.hints.inventory} optional={copy.hints.optional}>
                    <Input
                      ref={quantityInputRef}
                      value={formValues.quantity}
                      onChange={(event) => updateField("quantity", event.target.value)}
                      onKeyDown={handleFieldKeyDown("quantity")}
                      placeholder={copy.fields.quantityPlaceholder}
                      autoComplete="off"
                      inputMode="numeric"
                      dir="ltr"
                      className="admin-input h-13 rounded-[1.2rem] border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15"
                    />
                  </FieldShell>
                  <FieldShell label={copy.fields.stockAlertLabel} optional={copy.hints.optional}>
                    <Input
                      ref={stockAlertInputRef}
                      value={formValues.stockAlert}
                      onChange={(event) => updateField("stockAlert", event.target.value)}
                      onKeyDown={handleFieldKeyDown("stockAlert")}
                      placeholder={copy.fields.stockAlertPlaceholder}
                      autoComplete="off"
                      inputMode="numeric"
                      dir="ltr"
                      className="admin-input h-13 rounded-[1.2rem] border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 shadow-sm transition focus-visible:border-teal-400 focus-visible:ring-teal-500/15"
                    />
                  </FieldShell>
                </div>
              </SectionShell>

              <div
                className={cn(
                  "rounded-[1.4rem] border px-4 py-3 text-sm font-semibold leading-6",
                  feedback.tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-700" : feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-teal-100 bg-teal-50/80 text-teal-800",
                )}
                role="status"
                aria-live="polite"
              >
                {feedback.text}
              </div>

              <div className="flex flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">{copy.summaryTitle}</p>
                  <p className="text-xs font-semibold leading-6 text-slate-500">{copy.hints.keyboard}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={!readyToSubmit}
                    className="h-12 rounded-[1.2rem] bg-slate-950 px-5 text-sm font-bold text-white shadow-md transition hover:bg-slate-800"
                  >
                    {isSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                    {isSubmitting ? copy.actions.saving : copy.actions.save}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetForm()}
                    disabled={isPreparingImage || isSubmitting}
                    className="h-12 rounded-[1.2rem] border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    {copy.actions.reset}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(255,255,255,0.85)_100%)] pb-5">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold tracking-[-0.03em] text-slate-950">{copy.sections.preview.title}</CardTitle>
                <CardDescription className="text-sm font-semibold leading-7 text-slate-500">{copy.sections.preview.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pb-6 pt-6">
              <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-slate-100">
                {hasSnapshot ? (
                  <img src={snapshotBase64} alt={copy.sections.preview.title} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center px-6 text-center">
                    <div className="max-w-xs space-y-3">
                      <PhotoIcon className="mx-auto h-10 w-10 text-slate-400" />
                      <p className="text-sm font-semibold leading-7 text-slate-500">{copy.hints.previewPlaceholder}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em]",
                readyToSubmit ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500",
              )}>
                {readyToSubmit ? <CheckCircleIcon className="h-4 w-4" /> : <ExclamationTriangleIcon className="h-4 w-4" />}
                {readyToSubmit ? copy.status.ready : copy.status.notReady}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile label={copy.fields.lockedBarcodeLabel} value={formValues.lockedBarcode || copy.fields.lockedBarcodePlaceholder} highlight={Boolean(formValues.lockedBarcode)} />
                <SummaryTile label={copy.status.operator} value={operatorLabel} />
                <SummaryTile label={copy.status.capturedAt} value={capturedAtLabel} />
                <SummaryTile label={copy.status.imageSize} value={hasSnapshot ? compressedSizeLabel : "-"} />
                <SummaryTile label={copy.status.imageResolution} value={compressedImageResolution || "-"} />
                <SummaryTile label={copy.status.imageReady} value={hasSnapshot ? copy.status.imageReady : copy.status.imageWaiting} highlight={hasSnapshot} />
                <SummaryTile label={copy.status.costPrice} value={formatMoney(parseOptionalNumber(formValues.costPrice), lang)} />
                <SummaryTile label={copy.status.sellingPrice} value={formatMoney(parseOptionalNumber(formValues.sellingPrice), lang)} />
                <SummaryTile label={copy.status.discountPercent} value={parseOptionalNumber(formValues.discountPercent) === null ? "-" : `${formatMoney(parseOptionalNumber(formValues.discountPercent), lang)}%`} />
                <SummaryTile label={copy.status.quantity} value={formValues.quantity.trim() || "-"} />
                <SummaryTile label={copy.status.stockAlert} value={formValues.stockAlert.trim() || "-"} />
                <SummaryTile label={copy.status.draft} value={copy.status.draft} highlight />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[2rem] border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-200/80 pb-5">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-[-0.03em] text-slate-950">{copy.summaryTitle}</CardTitle>
                <CardDescription className="text-sm font-semibold leading-7 text-slate-500">{copy.summaryDescription}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 pt-6">
              <ReadinessRow label={copy.sections.identification.title} readyLabel={copy.status.identificationReady} pendingLabel={copy.status.identificationPending} ready={Boolean(formValues.lockedBarcode && formValues.productName.trim() && formValues.categoryId && snapshotBase64)} />
              <ReadinessRow label={copy.sections.pricing.title} readyLabel={copy.status.pricingReady} pendingLabel={copy.status.pricingPending} ready={hasValidSellingPrice} />
              <ReadinessRow label={copy.sections.inventory.title} readyLabel={copy.status.inventoryReady} pendingLabel={copy.status.inventoryPending} ready={hasInventoryValues} />
              <div className="rounded-[1.4rem] border border-teal-100 bg-teal-50/70 p-4 text-sm font-semibold leading-7 text-teal-900">
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">
                  <ShieldCheckIcon className="h-4 w-4" />{copy.summaryTitle}
                </div>
                {copy.hints.keyboard}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelection} />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}