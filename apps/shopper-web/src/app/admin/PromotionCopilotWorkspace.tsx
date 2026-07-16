import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StopIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import type { AdminProduct } from "../../services/adminSupabaseApi";
import {
  requestPromotionProposal,
  type PromotionCopilotProposal,
  type PromotionCopilotResponse,
} from "../../services/promotionCopilotApi";
import { cn } from "../components/UI";

export interface PromotionCopilotFormContext {
  id?: string;
  name?: string;
  description?: string;
  discountType?: "percentage" | "fixed_amount";
  discountValue?: number;
  startsAt?: string;
  endsAt?: string;
  productIds: string[];
}

interface PromotionCopilotWorkspaceProps {
  open: boolean;
  locale: "ar" | "en";
  productsById: Map<string, AdminProduct>;
  existingPromotionsByProduct: Map<string, string[]>;
  currentDraft: PromotionCopilotFormContext;
  onClose: () => void;
  onApply: (proposal: PromotionCopilotProposal) => void;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: PromotionCopilotResponse;
}

const EXAMPLE_PROMPTS = {
  en: [
    { icon: CubeIcon, title: "Build a wellness campaign", prompt: "Create a weekend wellness promotion with vitamins that are in stock and explain why you chose them." },
    { icon: ShieldCheckIcon, title: "Check campaign safety", prompt: "Review the current promotion, flag conflicts or risky discounts, and suggest safer improvements." },
    { icon: CalendarDaysIcon, title: "Plan next week", prompt: "Draft a bilingual promotion for next week with a sensible schedule and a professional campaign name." },
    { icon: ArrowsRightLeftIcon, title: "Improve product mix", prompt: "Recommend strong products, replace low-stock items, and avoid products already in another promotion." },
  ],
  ar: [
    { icon: CubeIcon, title: "أنشئ حملة للعناية", prompt: "أنشئ عرضاً لنهاية الأسبوع على الفيتامينات المتوفرة واشرح سبب اختيار كل منتج." },
    { icon: ShieldCheckIcon, title: "راجع سلامة الحملة", prompt: "راجع العرض الحالي واكتشف التعارضات أو الخصومات الخطرة واقترح تحسينات أكثر أماناً." },
    { icon: CalendarDaysIcon, title: "خطط للأسبوع القادم", prompt: "جهّز مسودة عرض ثنائي اللغة للأسبوع القادم مع جدول مناسب واسم حملة احترافي." },
    { icon: ArrowsRightLeftIcon, title: "حسّن مزيج المنتجات", prompt: "اقترح منتجات قوية واستبدل المنتجات منخفضة المخزون وتجنب المنتجات الموجودة في عروض أخرى." },
  ],
} as const;

function formatCurrency(value: number, locale: "ar" | "en"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | undefined, locale: "ar" | "en"): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function discountedPrice(
  price: number,
  discountType: PromotionCopilotProposal["discountType"],
  discountValue: number | undefined,
): number {
  if (!discountType || !discountValue) return price;
  return discountType === "percentage"
    ? Math.max(0, price * (1 - discountValue / 100))
    : Math.max(0, price - discountValue);
}

function draftSummary(draft: PromotionCopilotFormContext): string {
  const fields = [
    draft.id ? `promotionId=${draft.id}` : "",
    draft.name ? `name=${draft.name}` : "",
    draft.description ? `description=${draft.description}` : "",
    draft.discountType ? `discountType=${draft.discountType}` : "",
    draft.discountValue ? `discountValue=${draft.discountValue}` : "",
    draft.startsAt ? `startsAt=${draft.startsAt}` : "",
    draft.endsAt ? `endsAt=${draft.endsAt}` : "",
    draft.productIds.length ? `productIds=${draft.productIds.join(",")}` : "",
  ].filter(Boolean);
  return fields.join("; ");
}

function contextualPrompt(
  request: string,
  messages: ConversationMessage[],
  currentDraft: PromotionCopilotFormContext,
): string {
  const recentConversation = messages.slice(-6).map((message) => (
    `${message.role === "user" ? "Manager" : "Copilot"}: ${message.content}`
  )).join("\n");
  const context = draftSummary(currentDraft);
  const prefix = [
    context ? `Current editable promotion draft: ${context}` : "",
    recentConversation ? `Recent drafting context:\n${recentConversation}` : "",
    "Keep prior accepted details unless the manager explicitly changes them.",
    `Manager request: ${request.trim()}`,
  ].filter(Boolean).join("\n\n");
  if (prefix.length <= 1_500) return prefix;
  const requestBlock = `Manager request: ${request.trim()}`;
  const available = Math.max(0, 1_500 - requestBlock.length - 2);
  return `${prefix.slice(prefix.length - available)}\n\n${requestBlock}`.slice(-1_500);
}

function proposalText(response: PromotionCopilotResponse, locale: "ar" | "en", productsById: Map<string, AdminProduct>): string {
  const proposal = response.proposal;
  const discount = proposal.discountValue
    ? `${proposal.discountValue}${proposal.discountType === "percentage" ? "%" : " EGP"}`
    : "—";
  const products = proposal.productIds.map((id) => {
    const product = productsById.get(id);
    return `- ${product?.nameEn || product?.name || id}${product?.nameAr ? ` / ${product.nameAr}` : ""}`;
  }).join("\n");
  const labels = locale === "ar"
    ? { name: "الاسم", description: "الوصف", discount: "الخصم", products: "المنتجات", start: "البداية", end: "النهاية", warnings: "التحذيرات" }
    : { name: "Name", description: "Description", discount: "Discount", products: "Products", start: "Starts", end: "Ends", warnings: "Warnings" };
  return [
    `${labels.name}: ${proposal.name ?? "—"}`,
    `${labels.description}: ${proposal.description ?? "—"}`,
    `${labels.discount}: ${discount}`,
    `${labels.start}: ${formatDate(proposal.startsAt, locale)}`,
    `${labels.end}: ${formatDate(proposal.endsAt, locale)}`,
    `${labels.products}:\n${products || "—"}`,
    response.warnings.length ? `${labels.warnings}:\n${response.warnings.map((warning) => `- ${warning}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function ProductPreview({
  id,
  proposal,
  locale,
  productsById,
  existingPromotionsByProduct,
}: {
  id: string;
  proposal: PromotionCopilotProposal;
  locale: "ar" | "en";
  productsById: Map<string, AdminProduct>;
  existingPromotionsByProduct: Map<string, string[]>;
}) {
  const product = productsById.get(id);
  const originalPrice = product?.price ?? 0;
  const offerPrice = discountedPrice(originalPrice, proposal.discountType, proposal.discountValue);
  const existingPromotions = existingPromotionsByProduct.get(id) ?? [];
  const nameEn = product?.nameEn || product?.name || (locale === "ar" ? "منتج من الكتالوج" : "Catalog product");
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {product?.imageUrl ? (
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <CubeIcon className="h-5 w-5 text-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900" title={nameEn}>{nameEn}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500" dir="rtl">{product?.nameAr || "—"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {locale === "ar" ? product?.categoryName || product?.categoryNameEn || "بدون فئة" : product?.categoryNameEn || product?.categoryName || "Uncategorised"}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", (product?.stock ?? 0) > 9 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {locale === "ar" ? `المخزون ${product?.stock ?? "—"}` : `Stock ${product?.stock ?? "—"}`}
            </span>
            {existingPromotions.length > 0 && (
              <span className="max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={existingPromotions.join(", ")}>
                {locale === "ar" ? "ضمن عرض حالي" : "Existing promotion"}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-end tabular-nums">
          <p className="text-[10px] font-semibold text-slate-400 line-through">{formatCurrency(originalPrice, locale)}</p>
          <p className="mt-0.5 text-sm font-black text-violet-700">{formatCurrency(offerPrice, locale)}</p>
        </div>
      </div>
    </article>
  );
}

function Comparison({
  proposal,
  currentDraft,
  locale,
}: {
  proposal: PromotionCopilotProposal;
  currentDraft: PromotionCopilotFormContext;
  locale: "ar" | "en";
}) {
  const rows = [
    { label: locale === "ar" ? "الاسم" : "Name", before: currentDraft.name || "—", after: proposal.name || currentDraft.name || "—" },
    { label: locale === "ar" ? "الخصم" : "Discount", before: currentDraft.discountValue ? `${currentDraft.discountValue}${currentDraft.discountType === "percentage" ? "%" : " EGP"}` : "—", after: proposal.discountValue ? `${proposal.discountValue}${proposal.discountType === "percentage" ? "%" : " EGP"}` : "—" },
    { label: locale === "ar" ? "البداية" : "Starts", before: formatDate(currentDraft.startsAt, locale), after: formatDate(proposal.startsAt ?? currentDraft.startsAt, locale) },
    { label: locale === "ar" ? "النهاية" : "Ends", before: formatDate(currentDraft.endsAt, locale), after: formatDate(proposal.endsAt ?? currentDraft.endsAt, locale) },
    { label: locale === "ar" ? "المنتجات" : "Products", before: String(currentDraft.productIds.length), after: String(proposal.productIds.length) },
  ];
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
      <div className="grid grid-cols-[minmax(5rem,.7fr)_1fr_1fr] border-b border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        <span>{locale === "ar" ? "الحقل" : "Field"}</span>
        <span>{locale === "ar" ? "الحالي" : "Current"}</span>
        <span className="text-violet-600">{locale === "ar" ? "المقترح" : "Proposed"}</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(5rem,.7fr)_1fr_1fr] gap-2 border-b border-slate-100 px-3 py-2.5 text-xs last:border-0">
          <span className="font-bold text-slate-500">{row.label}</span>
          <span className="break-words text-slate-500">{row.before}</span>
          <span className={cn("break-words font-bold", row.before !== row.after ? "text-violet-700" : "text-slate-700")}>{row.after}</span>
        </div>
      ))}
    </div>
  );
}

function DraftPreview({
  response,
  locale,
  productsById,
  existingPromotionsByProduct,
  currentDraft,
  compareOpen,
  onToggleCompare,
  onApply,
  onRegenerate,
  onCopy,
}: {
  response: PromotionCopilotResponse;
  locale: "ar" | "en";
  productsById: Map<string, AdminProduct>;
  existingPromotionsByProduct: Map<string, string[]>;
  currentDraft: PromotionCopilotFormContext;
  compareOpen: boolean;
  onToggleCompare: () => void;
  onApply: () => void;
  onRegenerate: () => void;
  onCopy: () => void;
}) {
  const proposal = response.proposal;
  const conflicts = response.warnings.filter((warning) => /conflict|overlap|تعارض|متداخل/i.test(warning));
  const warnings = response.warnings.filter((warning) => !conflicts.includes(warning));
  const hasCurrentDraft = Boolean(currentDraft.id || currentDraft.name || currentDraft.productIds.length);
  return (
    <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-violet-200/80 bg-white shadow-[0_18px_50px_-30px_rgba(109,40,217,0.5)]">
      <div className="border-b border-violet-100 bg-[linear-gradient(135deg,#f5f3ff,#fff_55%,#faf5ff)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20"><TagIcon className="h-4 w-4" /></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">{locale === "ar" ? "مسودة جاهزة للمراجعة" : "Draft ready for review"}</p>
                <h3 className="mt-0.5 text-base font-black text-slate-950">{proposal.name || (locale === "ar" ? "مسودة عرض غير مكتملة" : "Incomplete promotion draft")}</h3>
              </div>
            </div>
            {proposal.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{proposal.description}</p>}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            {locale === "ar" ? "لم يتم الحفظ" : "Not saved"}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{locale === "ar" ? "الخصم" : "Discount"}</p><p className="mt-1 text-sm font-black text-violet-700">{proposal.discountValue ? `${proposal.discountValue}${proposal.discountType === "percentage" ? "%" : " EGP"}` : "—"}</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{locale === "ar" ? "المنتجات المتأثرة" : "Affected products"}</p><p className="mt-1 text-sm font-black text-slate-900">{proposal.productIds.length}</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{locale === "ar" ? "البداية" : "Starts"}</p><p className="mt-1 truncate text-xs font-bold text-slate-700">{formatDate(proposal.startsAt, locale)}</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{locale === "ar" ? "النهاية" : "Ends"}</p><p className="mt-1 truncate text-xs font-bold text-slate-700">{formatDate(proposal.endsAt, locale)}</p></div>
        </div>

        {proposal.productIds.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{locale === "ar" ? "المنتجات المقترحة" : "Recommended products"}</h4><span className="text-[10px] font-semibold text-slate-400">{locale === "ar" ? "الأسعار من الكتالوج" : "Catalog prices"}</span></div>
            <div className="grid gap-2 xl:grid-cols-2">
              {proposal.productIds.map((id) => <ProductPreview key={id} id={id} proposal={proposal} locale={locale} productsById={productsById} existingPromotionsByProduct={existingPromotionsByProduct} />)}
            </div>
          </section>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
            <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-black text-amber-800"><ExclamationTriangleIcon className="h-4 w-4" />{locale === "ar" ? "تحذيرات" : "Warnings"}</h4>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-900">{warnings.length ? warnings.map((warning) => <li key={warning}>• {warning}</li>) : <li>{locale === "ar" ? "لا توجد تحذيرات إضافية" : "No additional warnings"}</li>}</ul>
            </section>
            <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-black text-rose-800"><ArrowsRightLeftIcon className="h-4 w-4" />{locale === "ar" ? "التعارضات" : "Conflicts"}</h4>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-rose-900">{conflicts.length ? conflicts.map((warning) => <li key={warning}>• {warning}</li>) : <li>{locale === "ar" ? "لم يبلّغ Copilot عن تعارضات" : "No conflicts reported by Copilot"}</li>}</ul>
            </section>
        </div>

        <section className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
          <h4 className="flex items-center gap-1.5 text-xs font-black text-sky-800"><LightBulbIcon className="h-4 w-4" />{locale === "ar" ? "المنطق والتوصية" : "Reasoning & recommendation"}</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-sky-950">{response.message}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {response.toolsUsed.map((tool) => <span key={tool} className="rounded-full border border-sky-200 bg-white/70 px-2 py-0.5 text-[9px] font-bold text-sky-700">{tool}</span>)}
          </div>
        </section>

        {compareOpen && <Comparison proposal={proposal} currentDraft={currentDraft} locale={locale} />}

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onApply} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 active:scale-[0.99]"><CheckCircleIcon className="h-4 w-4" />{locale === "ar" ? "تطبيق على نموذج العرض" : "Apply to Promotion Form"}</button>
          <button type="button" onClick={onRegenerate} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><ArrowPathIcon className="h-4 w-4" />{locale === "ar" ? "إعادة التوليد" : "Regenerate"}</button>
          <button type="button" onClick={onCopy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><ClipboardDocumentIcon className="h-4 w-4" />{locale === "ar" ? "نسخ" : "Copy"}</button>
          <button type="button" onClick={onToggleCompare} disabled={!hasCurrentDraft} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowsRightLeftIcon className="h-4 w-4" />{locale === "ar" ? "مقارنة بالحالي" : "Compare with current"}</button>
        </div>
      </div>
    </div>
  );
}

export function PromotionCopilotWorkspace({
  open,
  locale,
  productsById,
  existingPromotionsByProduct,
  currentDraft,
  onClose,
  onApply,
}: PromotionCopilotWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [latestResponse, setLatestResponse] = useState<PromotionCopilotResponse | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const copy = locale === "ar" ? {
    title: "مساعد العروض الذكي",
    subtitle: "مسودات احترافية من بيانات الكتالوج",
    welcome: "ما العرض الذي تريد بناءه؟",
    welcomeHint: "صِف الهدف أو الجمهور أو المنتجات. سيبحث Copilot في الكتالوج ويقترح مسودة فقط — القرار والحفظ دائماً بيدك.",
    placeholder: "اطلب عرضاً أو تعديلاً…",
    clear: "مسح المحادثة",
    close: "إغلاق Copilot",
    cancel: "إيقاف التوليد",
    retry: "إعادة المحاولة",
    current: "سياق العرض الحالي",
    approval: "لن يتم حفظ أي شيء حتى تضغط حفظ العرض",
  } : {
    title: "Promotion Copilot",
    subtitle: "Professional drafts grounded in your catalog",
    welcome: "What promotion should we build?",
    welcomeHint: "Describe the goal, audience, or products. Copilot searches the catalog and proposes a draft only—you stay in control of every decision and save.",
    placeholder: "Ask for a promotion or refinement…",
    clear: "Clear conversation",
    close: "Close Copilot",
    cancel: "Stop generating",
    retry: "Retry",
    current: "Current promotion context",
    approval: "Nothing is saved until you press Save Promotion",
  };

  const stopStreaming = useCallback(() => {
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    streamTimerRef.current = null;
    setIsStreaming(false);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsTyping(false);
    stopStreaming();
  }, [stopStreaming]);

  const clearConversation = useCallback(() => {
    cancel();
    setMessages([]);
    setLatestResponse(null);
    setError("");
    setLastPrompt("");
    setCompareOpen(false);
    setInput("");
  }, [cancel]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    window.setTimeout(() => textareaRef.current?.focus(), 180);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) cancel();
    return () => cancel();
  }, [cancel, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, isTyping, latestResponse, reduceMotion]);

  const streamResponse = useCallback((response: PromotionCopilotResponse) => {
    const messageId = crypto.randomUUID();
    setMessages((current) => [...current, { id: messageId, role: "assistant", content: "", response }]);
    setLatestResponse(response);
    setIsStreaming(true);
    let cursor = 0;
    const step = () => {
      cursor = Math.min(response.message.length, cursor + Math.max(2, Math.ceil(response.message.length / 70)));
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: response.message.slice(0, cursor) } : message));
      if (cursor < response.message.length) {
        streamTimerRef.current = setTimeout(step, reduceMotion ? 0 : 18);
      } else {
        streamTimerRef.current = null;
        setIsStreaming(false);
      }
    };
    step();
  }, [reduceMotion]);

  const sendPrompt = useCallback(async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (prompt.length < 4 || isTyping || isStreaming) return;
    const history = messages;
    const requestPrompt = contextualPrompt(prompt, history, currentDraft);
    const userMessage: ConversationMessage = { id: crypto.randomUUID(), role: "user", content: prompt };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setLastPrompt(prompt);
    setCompareOpen(false);
    setIsTyping(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const candidateIds = latestResponse?.proposal.productIds.length
        ? latestResponse.proposal.productIds
        : currentDraft.productIds;
      const response = await requestPromotionProposal({
        prompt: requestPrompt,
        locale,
        candidateProductIds: candidateIds,
      }, controller.signal);
      if (!controller.signal.aborted) streamResponse(response);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Promotion Copilot could not generate a draft.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsTyping(false);
    }
  }, [currentDraft, isStreaming, isTyping, latestResponse, locale, messages, streamResponse]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendPrompt(input);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt(input);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!latestResponse) return;
    try {
      await navigator.clipboard.writeText(proposalText(latestResponse, locale, productsById));
      toast.success(locale === "ar" ? "تم نسخ المسودة" : "Draft copied");
    } catch {
      toast.error(locale === "ar" ? "تعذر نسخ المسودة" : "Could not copy the draft");
    }
  }, [latestResponse, locale, productsById]);

  const handleApply = useCallback(() => {
    if (!latestResponse) return;
    onApply(latestResponse.proposal);
    toast.success(locale === "ar" ? "تم تطبيق المسودة على النموذج — راجعها قبل الحفظ" : "Draft applied to the form—review it before saving");
  }, [latestResponse, locale, onApply]);

  const currentContextLabel = useMemo(() => {
    if (currentDraft.name) return currentDraft.name;
    if (currentDraft.productIds.length) return locale === "ar" ? `${currentDraft.productIds.length} منتجات محددة` : `${currentDraft.productIds.length} selected products`;
    return "";
  }, [currentDraft.name, currentDraft.productIds.length, locale]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={copy.title}>
          <motion.button
            type="button"
            aria-label={copy.close}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: locale === "ar" ? -36 : 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: locale === "ar" ? -36 : 36 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            dir={locale === "ar" ? "rtl" : "ltr"}
            className={cn(
              "absolute inset-0 flex h-full flex-col overflow-hidden bg-[#f7f8fb] shadow-2xl",
              locale === "ar" ? "xl:right-0 xl:left-auto" : "xl:left-auto xl:right-0",
              "xl:inset-y-0 xl:w-[min(46rem,calc(100vw-var(--admin-sidebar-width,17.5rem)))] xl:border-s xl:border-white/10",
            )}
          >
            <header className="relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#111827_0%,#312e81_48%,#6d28d9_100%)] px-4 py-4 text-white sm:px-5">
              <div className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-fuchsia-400/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 left-16 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur">
                  <SparklesIcon className="h-5 w-5" />
                  <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-violet-800 bg-emerald-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><h2 className="truncate text-base font-black sm:text-lg">{copy.title}</h2><span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-100">AI</span></div>
                  <p className="mt-0.5 truncate text-xs font-medium text-violet-100/75">{copy.subtitle}</p>
                </div>
                {messages.length > 0 && (
                  <button type="button" onClick={clearConversation} className="hidden h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white/80 transition hover:bg-white/15 sm:inline-flex" title={copy.clear}><TrashIcon className="h-4 w-4" />{copy.clear}</button>
                )}
                <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white" aria-label={copy.close}><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="relative mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-violet-100/80">
                <span className="inline-flex items-center gap-1.5"><ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-300" />{copy.approval}</span>
                {currentContextLabel && <span className="max-w-full truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-1">{copy.current}: {currentContextLabel}</span>}
              </div>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
              {messages.length === 0 && !isTyping ? (
                <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-7 sm:py-10">
                  <motion.div initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-violet-100 bg-white text-violet-600 shadow-[0_18px_45px_-20px_rgba(109,40,217,0.45)]"><SparklesIcon className="h-7 w-7" /></div>
                    <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{copy.welcome}</h3>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{copy.welcomeHint}</p>
                  </motion.div>
                  <div className="mt-7 grid gap-2 sm:grid-cols-2">
                    {EXAMPLE_PROMPTS[locale].map((example, index) => (
                      <motion.button
                        key={example.title}
                        type="button"
                        onClick={() => void sendPrompt(example.prompt)}
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduceMotion ? 0 : 0.05 + index * 0.04 }}
                        className="group rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white"><example.icon className="h-4 w-4" /></span>
                        <p className="mt-3 text-sm font-black text-slate-900">{example.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{example.prompt}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
                  {messages.map((message, index) => (
                    <motion.div key={message.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      {message.role === "user" ? (
                        <div className="ms-auto max-w-[88%] rounded-2xl rounded-ee-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm">{message.content}</div>
                      ) : (
                        <div>
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/20"><SparklesIcon className="h-4 w-4" /></span>
                            <div className="min-w-0 flex-1 rounded-2xl rounded-es-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                              <p className="whitespace-pre-wrap">{message.content}<span className={cn("ms-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-violet-500", isStreaming && index === messages.length - 1 ? "animate-pulse" : "hidden")} /></p>
                            </div>
                          </div>
                          {message.response && message.response === latestResponse && (
                            <DraftPreview
                              response={message.response}
                              locale={locale}
                              productsById={productsById}
                              existingPromotionsByProduct={existingPromotionsByProduct}
                              currentDraft={currentDraft}
                              compareOpen={compareOpen}
                              onToggleCompare={() => setCompareOpen((value) => !value)}
                              onApply={handleApply}
                              onRegenerate={() => void sendPrompt(lastPrompt)}
                              onCopy={() => void handleCopy()}
                            />
                          )}
                          {message.response && message.response.questions.length > 0 && message.response === latestResponse && (
                            <div className="mt-3 flex flex-wrap gap-2 ps-11">
                              {message.response.questions.map((question) => <button key={question} type="button" onClick={() => void sendPrompt(question)} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-start text-xs font-bold text-violet-700 transition hover:bg-violet-100">{question}</button>)}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isTyping && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white"><SparklesIcon className="h-4 w-4" /></span>
                      <div className="rounded-2xl rounded-es-md border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex h-5 items-center gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-.3s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-600" /></div></div>
                    </motion.div>
                  )}
                  {error && (
                    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <div className="flex items-start gap-3"><ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-rose-800">{error}</p><button type="button" onClick={() => void sendPrompt(lastPrompt)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-rose-700 hover:text-rose-900"><ArrowPathIcon className="h-4 w-4" />{copy.retry}</button></div></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="shrink-0 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur sm:p-4">
              <form onSubmit={submit} className="mx-auto max-w-3xl">
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_10px_35px_-20px_rgba(15,23,42,0.3)] transition focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100/70">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, 1_500))}
                    onKeyDown={handleComposerKeyDown}
                    rows={2}
                    placeholder={copy.placeholder}
                    disabled={isTyping || isStreaming}
                    className="max-h-36 min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-1 pt-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />{locale === "ar" ? "يدعم العربية والإنجليزية" : "Arabic & English ready"}</div>
                    {isTyping || isStreaming ? (
                      <button type="button" onClick={cancel} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800"><StopIcon className="h-4 w-4" />{copy.cancel}</button>
                    ) : (
                      <button type="submit" disabled={input.trim().length < 4} className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-600 px-3 text-xs font-black text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><PaperAirplaneIcon className="h-4 w-4 rtl:-rotate-90" />{locale === "ar" ? "إنشاء مسودة" : "Generate draft"}</button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between px-1 text-[9px] font-semibold text-slate-400">
                  <span>{locale === "ar" ? "راجع الأسعار والمواعيد والتعارضات قبل التطبيق" : "Review pricing, schedule, and conflicts before applying"}</span>
                  {messages.length > 0 && <button type="button" onClick={clearConversation} className="inline-flex items-center gap-1 hover:text-rose-600 sm:hidden"><TrashIcon className="h-3 w-3" />{copy.clear}</button>}
                </div>
              </form>
            </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
