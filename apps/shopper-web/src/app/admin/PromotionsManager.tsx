import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ClockIcon,
  CubeIcon,
  EllipsisVerticalIcon,
  ListBulletIcon,
  PlusIcon,
  Squares2X2Icon,
  SparklesIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { fetchAdminProducts, type AdminProduct } from "../../services/adminSupabaseApi";
import {
  fetchPromotions,
  savePromotion,
  setPromotionEnabled,
  deletePromotion,
  bulkEnablePromotions,
  bulkDisablePromotions,
  bulkDeletePromotions,
  type Promotion,
  type PromotionInput,
} from "../../services/promotionsApi";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AdminBulkActionBar,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminSearchField,
  AdminSectionCard,
  AdminTabBar,
  AdminTableSkeleton,
  AdminPaginationBar,
} from "./adminShared";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useBulkSelection } from "../../hooks/useBulkSelection";
import { useSortableColumn } from "../../hooks/useSortableColumn";
import { SortIcon } from "./adminTableIcons";
import { cn } from "../components/UI";
import { PromotionProductSelector } from "./PromotionProductSelector";
import { PromotionCopilotWorkspace, type PromotionCopilotFormContext } from "./PromotionCopilotWorkspace";
import type { PromotionCopilotProposal } from "../../services/promotionCopilotApi";
import {
  getPromotionStatus,
  getPromotionTimeProgress,
  getDaysRemaining,
  isExpiringSoon,
  comparePromotions,
  discountPreview,
  formatDiscount,
  type PromotionStatus,
} from "../../utils/promotionUtils";
import { createPromotionSchema, type PromotionFormValues } from "../../utils/promotionValidation";

type ViewMode = "grid" | "list" | "calendar";
type EditorTab = "details" | "products";
type DecoratedPromotion = Promotion & { status: PromotionStatus; isExpiringSoon: boolean };

const COPILOT_UNAVAILABLE = true;

const STATUS_TONE: Record<PromotionStatus, { badge: string; bar: string; ring: string }> = {
  active: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", ring: "ring-emerald-100" },
  paused: { badge: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-400", ring: "ring-amber-100" },
  scheduled: { badge: "bg-sky-50 text-sky-700 ring-sky-200", bar: "bg-sky-400", ring: "ring-sky-100" },
  expired: { badge: "bg-slate-100 text-slate-500 ring-slate-200", bar: "bg-slate-300", ring: "ring-slate-100" },
  draft: { badge: "bg-violet-50 text-violet-700 ring-violet-200", bar: "bg-violet-400", ring: "ring-violet-100" },
  archived: { badge: "bg-slate-100 text-slate-500 ring-slate-200", bar: "bg-slate-300", ring: "ring-slate-100" },
};

function statusLabel(status: PromotionStatus, isArabic: boolean, t: (k: string) => string): string {
  if (!isArabic) return status.charAt(0).toUpperCase() + status.slice(1);
  switch (status) {
    case "active": return t("promotions.live");
    case "paused": return t("promotions.paused");
    case "scheduled": return t("promotions.scheduled");
    case "expired": return t("promotions.expired");
    case "draft": return "مسودة";
    case "archived": return "مؤرشف";
  }
}

function StatusPill({ status, lang, t }: { status: PromotionStatus; lang: "ar" | "en"; t: (k: string) => string }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", tone.badge)}>
      {statusLabel(status, lang === "ar", t)}
    </span>
  );
}

/** Small overlapping thumbnail stack — the same "who/what is included" visual
 * pattern used for driver avatars elsewhere, applied here to the products a
 * promotion covers instead of forcing users to open the row to find out. */
function ProductAvatarStack({ productIds, productsById }: { productIds: string[]; productsById: Map<string, AdminProduct> }) {
  const shown = productIds.slice(0, 4);
  const remainder = productIds.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((id) => {
          const product = productsById.get(id);
          return product?.imageUrl ? (
            <img key={id} src={product.imageUrl} alt={product.name} className="h-7 w-7 rounded-full border-2 border-white object-cover shadow-sm" />
          ) : (
            <span key={id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500 shadow-sm">
              {(product?.name ?? "?").slice(0, 1)}
            </span>
          );
        })}
      </div>
      {remainder > 0 && (
        <span className="ms-1.5 text-xs font-bold text-slate-500">+{remainder}</span>
      )}
    </div>
  );
}

/** Time-window progress bar — shared by both the grid card and the list row.
 * This is the single biggest visual difference from a plain status badge:
 * staff can tell "about to expire" apart from "just started" at a glance. */
function WindowProgress({ promotion, lang }: { promotion: Promotion; lang: "ar" | "en" }) {
  const status = getPromotionStatus(promotion);
  const pct = getPromotionTimeProgress(promotion);
  const daysLeft = getDaysRemaining(promotion);
  const tone = STATUS_TONE[status];
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${status === "scheduled" ? 0 : pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
        {status === "scheduled"
          ? (lang === "ar" ? "لم يبدأ بعد" : "Not started yet")
          : status === "expired"
            ? (lang === "ar" ? "انتهى" : "Ended")
            : (lang === "ar" ? `${daysLeft} يوم متبقٍ` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`)}
      </p>
    </div>
  );
}

function PromotionActionsMenu({
  promotion, t, onEdit, onDuplicate, onToggle, onDelete,
}: {
  promotion: DecoratedPromotion;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onEdit: () => void;
  onDuplicate?: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          aria-label={t("promotions.actions")}
        >
          <EllipsisVerticalIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem disabled={COPILOT_UNAVAILABLE}>
          <SparklesIcon className="me-2 h-4 w-4 text-violet-600" />
          {t("lang") === "ar" ? "قريباً" : "Coming soon"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>{t("promotions.edit")}</DropdownMenuItem>
        {onDuplicate && <DropdownMenuItem onClick={onDuplicate}>{t("promotions.duplicate")}</DropdownMenuItem>}
        <DropdownMenuItem onClick={onToggle}>
          {promotion.isEnabled ? t("promotions.disable") : t("promotions.enable")}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={onDelete}>
          <TrashIcon className="me-2 h-4 w-4" />
          {t("promotions.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Grid-view card — the primary, merchandising-oriented view. A promotion is
 * a visual/marketing object first, so a card grid (Shopify Discounts /
 * Stripe Coupons pattern) is the default instead of a dense data table. */
function PromotionCard({
  promotion, lang, isArabic, t, selected, onSelect, productsById, onEdit, onDuplicate, onToggle, onDelete,
}: {
  promotion: DecoratedPromotion;
  lang: "ar" | "en";
  isArabic: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  selected: boolean;
  onSelect: () => void;
  productsById: Map<string, AdminProduct>;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const tone = STATUS_TONE[promotion.status];
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-violet-300 ring-2 ring-violet-100" : "border-slate-200/80",
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-violet-600"
          aria-label={t("promotions.selectRow", { name: promotion.name })}
        />
        <div className={cn("flex h-12 w-16 shrink-0 items-center justify-center rounded-xl text-base font-black ring-1", tone.badge, tone.ring)}>
          {discountPreview(promotion)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{promotion.name}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{promotion.description || (isArabic ? "بدون وصف" : "No description")}</p>
        </div>
        <PromotionActionsMenu promotion={promotion} t={t} onEdit={onEdit} onDuplicate={onDuplicate} onToggle={onToggle} onDelete={onDelete} />
      </div>

      <div className="flex-1 space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <StatusPill status={promotion.status} lang={lang} t={t} />
          <ProductAvatarStack productIds={promotion.productIds} productsById={productsById} />
        </div>
        <WindowProgress promotion={promotion} lang={lang} />
      </div>
    </article>
  );
}

function toLocalDateTimeInput(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// ---- Empty form ----
const emptyForm = (): PromotionInput => ({
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  startsAt: toLocalDateTimeInput(new Date()),
  endsAt: toLocalDateTimeInput(Date.now() + 86400000),
  status: "draft",
  productIds: [],
});

// ---- Main component ----
export default function PromotionsManager() {
  const { t } = useTranslation();
  const isArabic = t("lang") === "ar";
  const lang = isArabic ? "ar" : "en";

  // Data
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("details");
  const [saving, setSaving] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotContext] = useState<PromotionCopilotFormContext | null>(null);
  const [copilotTarget] = useState<Promotion | null>(null);

  // View, search, filter, sort, pagination
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [rawSearch, setRawSearch] = useState("");
  const searchTerm = useDebouncedValue(rawSearch, 300);
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const { sortBy, sortDir, setSortBy, setSortDir, handleSort } = useSortableColumn<
    "name" | "discount" | "startsAt" | "endsAt"
  >("startsAt", "desc");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    tone?: "danger" | "warning" | "info";
    onConfirm: () => Promise<void>;
  } | null>(null);

  // ---- React Hook Form ----
  const formSchema = useMemo(() => createPromotionSchema(lang), [lang]);
  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyForm(),
  });
  const { register, handleSubmit, setValue, watch, reset, trigger, formState: { errors, isDirty } } = form;
  const watchProductIds = watch("productIds", []);
  const watchDiscountType = watch("discountType", "percentage");
  const watchDiscountValue = watch("discountValue", 0);
  const watchName = watch("name", "");
  const watchDescription = watch("description", "");
  const watchStartsAt = watch("startsAt", "");
  const watchEndsAt = watch("endsAt", "");

  // ---- Load data with cancellation and request ID ----
  const loadController = useRef<AbortController | null>(null);
  const latestRequestId = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (loadController.current) {
      loadController.current.abort();
    }
    const controller = new AbortController();
    loadController.current = controller;
    const effectiveSignal = signal || controller.signal;
    const requestId = ++latestRequestId.current;

    setLoading(true);
    setError("");
    try {
      const [nextPromotions, nextProducts] = await Promise.all([
        fetchPromotions({ signal: effectiveSignal }),
        fetchAdminProducts({ signal: effectiveSignal }),
      ]);
      if (!effectiveSignal.aborted && requestId === latestRequestId.current) {
        setPromotions(nextPromotions);
        setProducts(nextProducts);
      }
    } catch (cause) {
      if (!effectiveSignal.aborted && requestId === latestRequestId.current) {
        setError(cause instanceof Error ? cause.message : "Could not load promotions.");
      }
    } finally {
      if (!effectiveSignal.aborted && requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (loadController.current) {
        loadController.current.abort();
      }
    };
  }, [load]);

  // ---- Reset page and selection on filter change ----
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sortBy, sortDir]);

  // ---- Derived data (decorated, filtered, sorted, paginated) ----
  const promotionsWithStatus: DecoratedPromotion[] = useMemo(() => {
    return promotions.map((p) => ({
      ...p,
      status: getPromotionStatus(p),
      isExpiringSoon: isExpiringSoon(p, 3),
    }));
  }, [promotions]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const existingPromotionsByProduct = useMemo(() => {
    const byProduct = new Map<string, string[]>();
    for (const promotion of promotionsWithStatus) {
      if (promotion.status === "expired" || promotion.status === "archived") continue;
      for (const productId of promotion.productIds) {
        byProduct.set(productId, [...(byProduct.get(productId) ?? []), promotion.name]);
      }
    }
    return byProduct;
  }, [promotionsWithStatus]);
  const copilotDraft = useMemo(() => {
    const validIso = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
    return {
      id: editing?.id,
      name: watchName,
      description: watchDescription,
      discountType: watchDiscountType,
      discountValue: watchDiscountValue,
      startsAt: validIso(watchStartsAt),
      endsAt: validIso(watchEndsAt),
      productIds: watchProductIds,
    };
  }, [editing?.id, watchDescription, watchDiscountType, watchDiscountValue, watchEndsAt, watchName, watchProductIds, watchStartsAt]);
  const campaignSchedule = useMemo(() => {
    const groups = new Map<string, DecoratedPromotion[]>();
    for (const campaign of promotionsWithStatus) {
      const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) || (campaign.description?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      if (!matchesSearch || (statusFilter !== "all" && campaign.status !== statusFilter)) continue;
      const key = toLocalDateTimeInput(campaign.startsAt).slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), campaign]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [promotionsWithStatus, searchTerm, statusFilter]);

  const filtered = useMemo(() => {
    return promotionsWithStatus.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [promotionsWithStatus, searchTerm, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => comparePromotions(a, b, sortBy, sortDir));
  }, [filtered, sortBy, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, page]);

  // ---- Clamp page if the result set shrinks below the current page (e.g.
  // after a bulk delete removes the last items on the final page) ----
  useEffect(() => {
    setPage((p) => Math.max(1, Math.min(p, Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE)))));
  }, [sorted.length]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);

  // Bulk selection uses the visible (sorted) list
  const bulk = useBulkSelection(sorted);

  // ---- Metrics (single pass using decorated list) ----
  const metrics = useMemo(() => {
    let total = promotions.length;
    let live = 0, scheduled = 0, paused = 0, expired = 0, expiring = 0;
    let percentageDiscountTotal = 0;
    let percentageDiscountCount = 0;
    const promotedProductIds = new Set<string>();
    for (const p of promotionsWithStatus) {
      if (p.status === "active") live++;
      else if (p.status === "scheduled") scheduled++;
      else if (p.status === "paused") paused++;
      else if (p.status === "expired") expired++;
      if (p.isExpiringSoon) expiring++;
      if (p.discountType === "percentage") {
        percentageDiscountTotal += p.discountValue;
        percentageDiscountCount++;
      }
      if (p.status === "active" || p.status === "scheduled") {
        p.productIds.forEach((productId) => promotedProductIds.add(productId));
      }
    }
    return {
      total, live, scheduled, paused, expired, expiring,
      avgPercentageDiscount: percentageDiscountCount ? percentageDiscountTotal / percentageDiscountCount : 0,
      productsUnderPromotion: promotedProductIds.size,
    };
  }, [promotionsWithStatus, promotions.length]);

  const statusTabs = useMemo(() => ([
    { key: "all" as const, label: isArabic ? "الكل" : "All", count: metrics.total },
    { key: "active" as const, label: t("promotions.live"), count: metrics.live },
    { key: "scheduled" as const, label: t("promotions.scheduled"), count: metrics.scheduled },
    { key: "paused" as const, label: t("promotions.paused"), count: metrics.paused },
    { key: "expired" as const, label: t("promotions.expired"), count: metrics.expired },
    { key: "draft" as const, label: isArabic ? "مسودات" : "Drafts", count: promotionsWithStatus.filter((item) => item.status === "draft").length },
    { key: "archived" as const, label: isArabic ? "مؤرشف" : "Archived", count: promotionsWithStatus.filter((item) => item.status === "archived").length },
  ]), [isArabic, t, metrics, promotionsWithStatus]);

  // ---- Handlers ----
  const openCreate = useCallback(() => {
    setEditing(null);
    setEditorTab("details");
    reset(emptyForm());
    setOpen(true);
  }, [reset]);

  const openEdit = useCallback((promotion: Promotion) => {
    setEditing(promotion);
    setEditorTab("details");
    reset({
      name: promotion.name,
      description: promotion.description ?? "",
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      startsAt: toLocalDateTimeInput(promotion.startsAt),
      endsAt: toLocalDateTimeInput(promotion.endsAt),
      status: getPromotionStatus(promotion),
      productIds: promotion.productIds,
    });
    setOpen(true);
  }, [reset]);

  const applyCopilotProposal = useCallback((proposal: PromotionCopilotProposal) => {
    const context = copilotContext ?? copilotDraft;
    const fallback = emptyForm();
    const toLocalInput = (value: string | undefined, defaultValue: string) => {
      if (!value || !Number.isFinite(Date.parse(value))) return defaultValue;
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    };
    const defaults: PromotionFormValues = copilotTarget ? {
      name: copilotTarget.name,
      description: copilotTarget.description ?? "",
      discountType: copilotTarget.discountType,
      discountValue: copilotTarget.discountValue,
      startsAt: toLocalInput(copilotTarget.startsAt, fallback.startsAt),
      endsAt: toLocalInput(copilotTarget.endsAt, fallback.endsAt),
      status: getPromotionStatus(copilotTarget),
      productIds: copilotTarget.productIds,
    } : fallback;
    reset(defaults);
    reset({
      name: proposal.name ?? context.name ?? defaults.name,
      description: proposal.description ?? context.description ?? defaults.description ?? "",
      discountType: proposal.discountType ?? context.discountType ?? defaults.discountType,
      discountValue: proposal.discountValue ?? context.discountValue ?? defaults.discountValue,
      startsAt: toLocalInput(proposal.startsAt ?? context.startsAt, defaults.startsAt),
      endsAt: toLocalInput(proposal.endsAt ?? context.endsAt, defaults.endsAt),
      status: "draft",
      productIds: proposal.productIds.length > 0 ? proposal.productIds : context.productIds,
    }, { keepDefaultValues: true });
    setEditing(copilotTarget);
    setEditorTab("details");
    setCopilotOpen(false);
    setOpen(true);
  }, [copilotContext, copilotDraft, copilotTarget, reset]);

  const duplicatePromotion = useCallback(async (promotion: Promotion) => {
    try {
      const duplicate = await savePromotion({
        name: `${promotion.name} (copy)`, description: promotion.description ?? "",
        discountType: promotion.discountType, discountValue: promotion.discountValue,
        startsAt: promotion.startsAt, endsAt: promotion.endsAt, status: "draft", productIds: promotion.productIds,
      });
      setPromotions((current) => [duplicate, ...current]);
      toast.success(t("promotions.duplicated"));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t("promotions.saveError"));
    }
  }, [t]);

  const onSave = useCallback(async (data: PromotionFormValues) => {
    setSaving(true);
    try {
      await savePromotion(
        {
          ...data,
          startsAt: new Date(data.startsAt).toISOString(),
          endsAt: new Date(data.endsAt).toISOString(),
        },
        editing?.id
      );
      toast.success(editing ? t("promotions.updated") : t("promotions.scheduled"));
      setOpen(false);
      void load(); // background refresh
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t("promotions.saveError"));
    } finally {
      setSaving(false);
    }
  }, [editing, load, t]);

  const toggle = useCallback(async (promotion: Promotion) => {
    const nextEnabled = !promotion.isEnabled;
    // Optimistically update only this row; rollback is scoped to the same row
    // so a concurrent refresh or a different mutation is never overwritten.
    setPromotions((current) => current.map((item) => item.id === promotion.id
      ? { ...item, isEnabled: nextEnabled, status: nextEnabled ? "active" : "paused" }
      : item));
    try {
      const persisted = await setPromotionEnabled(promotion.id, nextEnabled);
      setPromotions((current) => current.map((item) => item.id === promotion.id ? persisted : item));
    } catch (cause) {
      setPromotions((current) => current.map((item) => item.id === promotion.id ? promotion : item));
      toast.error(cause instanceof Error ? cause.message : t("promotions.toggleError"));
    }
  }, [t]);

  // ---- Optimistic delete with snapshot ----
  const handleDelete = useCallback(async (promotion: Promotion) => {
    setConfirmDialog({
      open: true,
      title: t("promotions.deleteTitle"),
      description: t("promotions.deleteConfirm", { name: promotion.name }),
      tone: "danger",
      onConfirm: async () => {
        const previous = promotions;
        // Optimistic: remove
        setPromotions((current) => current.filter((p) => p.id !== promotion.id));
        setConfirmDialog(null);
        try {
          await deletePromotion(promotion.id);
          toast.success(t("promotions.deleted"));
          void load(); // background refresh
        } catch (cause) {
          // Rollback to full previous snapshot
          setPromotions(previous);
          toast.error(cause instanceof Error ? cause.message : t("promotions.deleteError"));
        }
      },
    });
  }, [promotions, t, load]);

  // ---- Bulk actions (optimistic with snapshot) ----
  const bulkAction = useCallback(async (action: "enable" | "disable" | "delete") => {
    if (bulk.count === 0) return;
    const selectedIds = Array.from(bulk.selected as Set<string>) as string[];
    const previous = promotions;

    if (action === "delete") {
      setConfirmDialog({
        open: true,
        title: t("promotions.bulkDeleteTitle"),
        description: t("promotions.bulkDeleteConfirm", { count: bulk.count }),
        tone: "danger",
        onConfirm: async () => {
          // Optimistic: remove all selected
          setPromotions((current) => current.filter((p) => !bulk.selected.has(p.id)));
          bulk.clear();
          setConfirmDialog(null);
          try {
            await bulkDeletePromotions(selectedIds);
            toast.success(t("promotions.bulkDeleted"));
            void load();
          } catch (cause) {
            // Rollback to full previous snapshot
            setPromotions(previous);
            toast.error(cause instanceof Error ? cause.message : t("promotions.bulkDeleteError"));
          }
        },
      });
      return;
    }

    const enabled = action === "enable";
    // Optimistic: update all selected
    setPromotions((current) =>
      current.map((p) =>
        bulk.selected.has(p.id) ? { ...p, isEnabled: enabled, status: enabled ? "active" : "paused" } : p
      )
    );
    bulk.clear();
    try {
      if (enabled) {
        await bulkEnablePromotions(selectedIds);
      } else {
        await bulkDisablePromotions(selectedIds);
      }
      toast.success(enabled ? t("promotions.bulkEnabled") : t("promotions.bulkDisabled"));
      void load();
    } catch (cause) {
      // Rollback to full previous snapshot
      setPromotions(previous);
      toast.error(cause instanceof Error ? cause.message : t("promotions.bulkActionError"));
    }
  }, [bulk, promotions, t, load]);

  const resetFilters = useCallback(() => {
    setRawSearch("");
    setStatusFilter("all");
    setSortBy("startsAt");
    setSortDir("desc");
  }, [setSortBy, setSortDir]);

  const hasActiveFilters = Boolean(rawSearch) || statusFilter !== "all";
  const thClass = "px-5 py-3 text-start text-xs font-black uppercase tracking-[0.18em] text-slate-500";

  const goToProducts = useCallback(async () => {
    const detailsValid = await trigger([
      "name", "description", "discountType", "discountValue", "status", "startsAt", "endsAt",
    ], { shouldFocus: true });
    if (detailsValid) setEditorTab("products");
  }, [trigger]);

  const requestEditorClose = useCallback(() => {
    if (saving) return;
    if (!isDirty) {
      setOpen(false);
      return;
    }
    setConfirmDialog({
      open: true,
      title: isArabic ? "تجاهل التغييرات؟" : "Discard changes?",
      description: isArabic
        ? "لديك تغييرات غير محفوظة في هذا العرض. سيتم فقدها إذا أغلقت المحرر."
        : "This promotion has unsaved changes. Closing the editor will discard them.",
      tone: "warning",
      onConfirm: async () => {
        setOpen(false);
        setConfirmDialog(null);
      },
    });
  }, [isArabic, isDirty, saving]);

  // ---- Render ----
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-fuchsia-50/60 p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 shadow-sm">
              <SparklesIcon className="h-3.5 w-3.5" />{isArabic ? "مركز الحملات" : "Campaign control center"}
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{t("promotions.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{isArabic ? "أنشئ وجدول وراجع عروض المنتجات من مساحة عمل واحدة، مع أسعار مباشرة وفحص تلقائي للتعارضات." : "Create, schedule, and review product offers from one workspace with live pricing and automatic conflict checks."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{metrics.live} {isArabic ? "نشط الآن" : "live now"}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700"><CalendarDaysIcon className="h-3.5 w-3.5" />{metrics.scheduled} {isArabic ? "مجدول" : "scheduled"}</span>
              {metrics.expiring > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><ClockIcon className="h-3.5 w-3.5" />{metrics.expiring} {isArabic ? "ينتهي قريباً" : "expiring soon"}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" onClick={() => { void load(); }} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"><ArrowPathIcon className={cn("h-4 w-4", loading && "animate-spin")} />{isArabic ? "تحديث" : "Refresh"}</button>
            <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-5 text-sm font-black text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-50"><PlusIcon className="h-4 w-4" />{t("promotions.new")}</button>
            <button type="button" disabled={COPILOT_UNAVAILABLE} className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#111827,#6d28d9)] px-5 text-sm font-black text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"><SparklesIcon className="h-4 w-4 transition group-hover:rotate-12" />{isArabic ? "قريباً" : "Coming soon"}</button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label={t("promotions.total")} value={metrics.total} icon={TagIcon} tone="slate" />
        <AdminMetricCard label={t("promotions.live")} value={metrics.live} icon={CheckBadgeIcon} tone="emerald" />
        <AdminMetricCard label={t("promotions.expiringSoon")} value={metrics.expiring} icon={ClockIcon} tone="amber" />
        <AdminMetricCard label={t("promotions.productsUnderPromo")} value={metrics.productsUnderPromotion} tone="sky" />
        <AdminMetricCard label={isArabic ? "متوسط خصم النسبة" : "Avg. percentage discount"} value={`${metrics.avgPercentageDiscount.toFixed(0)}%`} icon={SparklesIcon} tone="violet" />
      </div>

      <AdminErrorBanner message={error} />

      <AdminSectionCard
        eyebrow={t("promotions.eyebrow")}
        title={t("promotions.title")}
        description={t("promotions.description")}
        accent="violet"
        bodyClassName="p-0"
      >
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="p-4 md:p-6"><AdminTableSkeleton rows={6} /></div>
          )
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-white/80 px-4 py-4 md:px-6">
              <div className="flex items-center justify-between gap-3 overflow-x-auto">
                <AdminTabBar tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    aria-pressed={viewMode === "grid"}
                    aria-label={isArabic ? "\u0639\u0631\u0636 \u0634\u0628\u0643\u064a" : "Grid view"}
                    className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md transition", viewMode === "grid" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                  >
                    <Squares2X2Icon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("calendar")}
                    aria-pressed={viewMode === "calendar"}
                    aria-label={isArabic ? "عرض التقويم" : "Calendar view"}
                    className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md transition", viewMode === "calendar" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    aria-pressed={viewMode === "list"}
                    aria-label={isArabic ? "عرض قائمة" : "List view"}
                    className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md transition", viewMode === "list" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                  >
                    <ListBulletIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <AdminSearchField
                  value={rawSearch}
                  onChange={setRawSearch}
                  placeholder={t("promotions.search")}
                  className="w-full sm:max-w-sm"
                />
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <XMarkIcon className="me-1 h-4 w-4" />
                      {t("promotions.reset")}
                    </button>
                  )}
                  <div className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
                    {sorted.length} {t("promotions.promotion")}
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk action bar */}
            <AdminBulkActionBar
              selectedCount={bulk.count}
              lang={lang}
              onClear={bulk.clear}
              actions={[
                { key: "enable", label: t("promotions.enable"), icon: CheckBadgeIcon, onClick: () => bulkAction("enable") },
                { key: "disable", label: t("promotions.disable"), icon: XMarkIcon, onClick: () => bulkAction("disable") },
                { key: "delete", label: t("promotions.delete"), icon: TrashIcon, tone: "danger", onClick: () => bulkAction("delete") },
              ]}
            />

            {/* Content */}
            {promotions.length === 0 ? (
              <AdminEmptyState title={t("promotions.noPromotions")} description={t("promotions.noPromotionsDesc")} />
            ) : sorted.length === 0 ? (
              <AdminEmptyState title={t("promotions.noMatch")} description={t("promotions.noMatchDesc")} />
            ) : viewMode === "calendar" ? (
              <div className="space-y-4 p-4 md:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">{isArabic ? "نشطة الآن" : "Active now"}</p><p className="mt-1 text-xl font-black text-emerald-900">{metrics.live}</p></div>
                  <div className="rounded-xl border border-sky-100 bg-sky-50 p-3"><p className="text-xs font-bold text-sky-700">{isArabic ? "مجدولة" : "scheduled"}</p><p className="mt-1 text-xl font-black text-sky-900">{metrics.scheduled}</p></div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><p className="text-xs font-bold text-violet-700">{isArabic ? "تغطية المنتجات" : "Product coverage"}</p><p className="mt-1 text-xl font-black text-violet-900">{metrics.productsUnderPromotion}</p></div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2"><CalendarDaysIcon className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-black text-slate-900">{isArabic ? "الخط الزمني للحملات" : "Campaign timeline"}</h3></div>
                  <ol className="space-y-4">
                    {campaignSchedule.map(([date, campaigns]) => (
                      <li key={date} className="grid gap-2 border-s border-violet-200 ps-4 sm:grid-cols-[10rem_1fr]">
                        <p className="text-xs font-black text-violet-700">{new Date(`${date}T00:00:00`).toLocaleDateString(isArabic ? "ar-EG" : "en-EG", { month: "short", day: "numeric", year: "numeric" })}</p>
                        <div className="space-y-2">{campaigns.map((campaign) => (
                          <button key={campaign.id} type="button" onClick={() => openEdit(campaign)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-start transition hover:border-violet-300 hover:bg-violet-50">
                            <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{campaign.name}</span><span className="text-xs text-slate-500">{campaign.productIds.length} {isArabic ? "منتجات" : "products"} · {formatDiscount(campaign.discountType, campaign.discountValue)}</span></span>
                            <StatusPill status={campaign.status} lang={lang} t={t} />
                          </button>
                        ))}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
                {paginated.map((p) => (
                  <PromotionCard
                    key={p.id}
                    promotion={p}
                    lang={lang}
                    isArabic={isArabic}
                    t={t}
                    selected={bulk.isSelected(p.id)}
                    onSelect={() => bulk.toggle(p.id)}
                    productsById={productsById}
                    onEdit={() => openEdit(p)}
                    onDuplicate={() => duplicatePromotion(p)}
                    onToggle={() => toggle(p)}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50/90">
                    <tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={bulk.allSelected}
                          onChange={bulk.toggleAll}
                          className="h-4 w-4 rounded border-slate-300 accent-violet-600"
                          aria-label={t("promotions.selectAll")}
                        />
                      </th>
                      {([
                        { key: "name", label: t("promotions.promotion") },
                        { key: "discount", label: t("promotions.discount") },
                        { key: "startsAt", label: t("promotions.window") },
                      ] as const).map(({ key, label }) => (
                        <th key={key} className={thClass} aria-sort={sortBy === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" onClick={() => handleSort(key)} className="flex items-center gap-1 hover:text-slate-700">
                            {label}
                            <SortIcon active={sortBy === key} dir={sortDir} />
                          </button>
                        </th>
                      ))}
                      <th className={thClass}>{t("promotions.products")}</th>
                      <th className={thClass}>{t("promotions.status")}</th>
                      <th className={thClass} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100 transition hover:bg-violet-50/40">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={bulk.isSelected(p.id)}
                            onChange={() => bulk.toggle(p.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-violet-600"
                            aria-label={t("promotions.selectRow", { name: p.name })}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.description}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className={cn("inline-flex rounded-lg px-3 py-1.5 text-sm font-black ring-1", STATUS_TONE[p.status].badge)}>
                            {discountPreview(p)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="w-40">
                            <WindowProgress promotion={p} lang={lang} />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <ProductAvatarStack productIds={p.productIds} productsById={productsById} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill status={p.status} lang={lang} t={t} />
                        </td>
                        <td className="px-5 py-4 text-end">
                          <PromotionActionsMenu promotion={p} t={t} onEdit={() => openEdit(p)} onDuplicate={() => duplicatePromotion(p)} onToggle={() => toggle(p)} onDelete={() => handleDelete(p)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode !== "calendar" && (
              <AdminPaginationBar
                currentPage={page}
                totalPages={totalPages}
                totalItems={sorted.length}
                itemsPerPage={ITEMS_PER_PAGE}
                lang={lang}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </AdminSectionCard>

      {/* Complete two-step offer editor. Product assignment is intentionally a
          dedicated workspace so catalog data remains readable on every viewport. */}
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) requestEditorClose(); }}>
        <DialogContent className="flex h-[94vh] max-h-[94vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-0 bg-white p-0 shadow-2xl sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[1480px]">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 pb-0 pt-5 sm:px-6">
            <DialogHeader className="text-start">
              <div className="flex flex-wrap items-start justify-between gap-3 pe-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">{isArabic ? "إدارة الحملات" : "Campaign manager"}</p>
                  <DialogTitle className="mt-1 text-xl font-black text-slate-900">{editing ? t("promotions.editTitle") : t("promotions.newTitle")}</DialogTitle>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("promotions.dialogSubtitle")}</p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <button type="button" disabled={COPILOT_UNAVAILABLE} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#111827,#6d28d9)] px-3 text-xs font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"><SparklesIcon className="h-4 w-4" />{isArabic ? "قريباً" : "Coming soon"}</button>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                    <CubeIcon className="h-4 w-4 text-violet-600" />
                    {watchProductIds.length} {isArabic ? "منتج محدد" : "products selected"}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <nav className="mt-5 flex" aria-label={isArabic ? "خطوات إعداد العرض" : "Promotion setup steps"}>
              <button
                type="button"
                aria-current={editorTab === "details" ? "step" : undefined}
                onClick={() => setEditorTab("details")}
                className={cn("relative flex min-w-0 flex-1 items-center gap-3 border-b-2 px-2 pb-3 text-start transition sm:px-4", editorTab === "details" ? "border-violet-600 text-violet-700" : "border-transparent text-slate-400 hover:text-slate-700")}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black", editorTab === "details" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500")}>1</span>
                <span className="min-w-0"><span className="block truncate text-sm font-black">{isArabic ? "تفاصيل العرض" : "Offer details"}</span><span className="hidden truncate text-[11px] font-medium sm:block">{isArabic ? "الاسم والخصم والجدولة" : "Name, discount, and schedule"}</span></span>
              </button>
              <button
                type="button"
                aria-current={editorTab === "products" ? "step" : undefined}
                onClick={() => { void goToProducts(); }}
                className={cn("relative flex min-w-0 flex-1 items-center gap-3 border-b-2 px-2 pb-3 text-start transition sm:px-4", editorTab === "products" ? "border-violet-600 text-violet-700" : "border-transparent text-slate-400 hover:text-slate-700")}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black", editorTab === "products" ? "bg-violet-600 text-white" : watchProductIds.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{watchProductIds.length > 0 ? <CheckCircleIcon className="h-5 w-5" /> : "2"}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-black">{isArabic ? "إضافة المنتجات" : "Add products"}</span><span className="hidden truncate text-[11px] font-medium sm:block">{isArabic ? "الاختيار والأسعار والتعارضات" : "Selection, pricing, and conflicts"}</span></span>
              </button>
            </nav>
          </div>

          <form
            onSubmit={handleSubmit(onSave, (invalid) => {
              setEditorTab(invalid.productIds && Object.keys(invalid).length === 1 ? "products" : "details");
            })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
              {editorTab === "details" ? (
                <div className="mx-auto grid w-full max-w-[1320px] gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                  <div className="space-y-4">
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="promotion-basics-heading">
                      <div className="mb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">01</p>
                        <h3 id="promotion-basics-heading" className="mt-1 text-sm font-black text-slate-900">{isArabic ? "هوية العرض" : "Offer identity"}</h3>
                        <p className="mt-1 text-xs text-slate-500">{isArabic ? "استخدم اسماً واضحاً لفريق العمل ووصفاً موجزاً لهدف الحملة." : "Use a clear internal name and a concise description of the campaign goal."}</p>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-3"><label htmlFor="promotion-name" className="text-sm font-bold text-slate-700">{t("promotions.name")} <span className="text-rose-500">*</span></label><span className="text-[10px] font-semibold text-slate-400">{watchName.length}/120</span></div>
                          <input id="promotion-name" maxLength={120} autoComplete="off" {...register("name")} placeholder={isArabic ? "مثال: عروض العناية الأسبوعية" : "e.g. Weekly wellness offers"} className={cn("mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm shadow-sm outline-none transition focus:ring-4", errors.name ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-violet-400 focus:ring-violet-100")} />
                          {errors.name && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.name.message}</p>}
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3"><label htmlFor="promotion-description" className="text-sm font-bold text-slate-700">{isArabic ? "وصف العرض" : "Offer description"}</label><span className="text-[10px] font-semibold text-slate-400">{watch("description", "")?.length ?? 0}/500</span></div>
                          <textarea id="promotion-description" rows={3} maxLength={500} {...register("description")} placeholder={isArabic ? "اشرح الهدف أو الجمهور أو تعليمات الحملة…" : "Describe the goal, audience, or campaign instructions…"} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
                          {errors.description && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.description.message}</p>}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="promotion-discount-heading">
                      <div className="mb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">02</p>
                        <h3 id="promotion-discount-heading" className="mt-1 text-sm font-black text-slate-900">{isArabic ? "قاعدة الخصم" : "Discount rule"}</h3>
                        <p className="mt-1 text-xs text-slate-500">{isArabic ? "اختر طريقة الخصم، وستظهر الأسعار النهائية لكل منتج في الخطوة التالية." : "Choose how the discount is calculated; final product prices appear in the next step."}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={cn("cursor-pointer rounded-xl border p-3 transition", watchDiscountType === "percentage" ? "border-violet-300 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-slate-300")}><div className="flex items-center gap-2"><input type="radio" value="percentage" {...register("discountType")} className="accent-violet-600" /><span className="text-sm font-black text-slate-800">{t("promotions.percentage")}</span></div><p className="mt-1 ps-5 text-xs text-slate-500">{isArabic ? "نسبة من السعر الأساسي" : "A percentage of the base price"}</p></label>
                        <label className={cn("cursor-pointer rounded-xl border p-3 transition", watchDiscountType === "fixed_amount" ? "border-violet-300 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-slate-300")}><div className="flex items-center gap-2"><input type="radio" value="fixed_amount" {...register("discountType")} className="accent-violet-600" /><span className="text-sm font-black text-slate-800">{t("promotions.fixedAmount")}</span></div><p className="mt-1 ps-5 text-xs text-slate-500">{isArabic ? "مبلغ ثابت بالجنيه لكل منتج" : "A fixed EGP amount per product"}</p></label>
                      </div>
                      <div className="mt-4 max-w-sm">
                        <label htmlFor="promotion-discount-value" className="text-sm font-bold text-slate-700">{t("promotions.discountValue")} <span className="text-rose-500">*</span></label>
                        <div className="relative mt-1.5"><input id="promotion-discount-value" type="number" min="0.01" max={watchDiscountType === "percentage" ? 100 : undefined} step="0.01" {...register("discountValue", { valueAsNumber: true })} className={cn("h-11 w-full rounded-xl border bg-white px-3 pe-16 text-sm font-black tabular-nums shadow-sm outline-none transition focus:ring-4", errors.discountValue ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-violet-400 focus:ring-violet-100")} /><span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{watchDiscountType === "percentage" ? "%" : "EGP"}</span></div>
                        {errors.discountValue && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.discountValue.message}</p>}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="promotion-schedule-heading">
                      <div className="mb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">03</p>
                        <h3 id="promotion-schedule-heading" className="mt-1 text-sm font-black text-slate-900">{isArabic ? "الجدولة والنشر" : "Schedule and publishing"}</h3>
                        <p className="mt-1 text-xs text-slate-500">{isArabic ? "تتحول العروض المفعّلة تلقائياً بين مجدول ونشط حسب التوقيت." : "Enabled offers automatically move between scheduled and live based on this window."}</p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor="promotion-status" className="text-sm font-bold text-slate-700">{isArabic ? "حالة سير العمل" : "Workflow status"}</label>
                          <select id="promotion-status" {...register("status")} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100">
                            <option value="draft">{isArabic ? "مسودة — غير منشور" : "Draft — not published"}</option>
                            <option value="scheduled">{isArabic ? "مجدول — يبدأ تلقائياً" : "Scheduled — starts automatically"}</option>
                            <option value="active">{isArabic ? "نشط — حسب الفترة" : "Live — within the window"}</option>
                            <option value="paused">{isArabic ? "موقوف مؤقتاً" : "Paused"}</option>
                            {editing && getPromotionStatus(editing) === "expired" && (
                              <option value="expired">{isArabic ? "منتهٍ — غير مفعل" : "Expired — inactive"}</option>
                            )}
                            <option value="archived">{isArabic ? "مؤرشف" : "Archived"}</option>
                          </select>
                          {errors.status && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.status.message}</p>}
                        </div>
                        <div><label htmlFor="promotion-starts-at" className="text-sm font-bold text-slate-700">{t("promotions.startsAt")} <span className="text-rose-500">*</span></label><input id="promotion-starts-at" type="datetime-local" {...register("startsAt")} className={cn("mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm shadow-sm outline-none focus:ring-4", errors.startsAt ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-violet-400 focus:ring-violet-100")} />{errors.startsAt && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.startsAt.message}</p>}</div>
                        <div><label htmlFor="promotion-ends-at" className="text-sm font-bold text-slate-700">{t("promotions.endsAt")} <span className="text-rose-500">*</span></label><input id="promotion-ends-at" type="datetime-local" {...register("endsAt")} className={cn("mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm shadow-sm outline-none focus:ring-4", errors.endsAt ? "border-rose-300 focus:ring-rose-100" : "border-slate-200 focus:border-violet-400 focus:ring-violet-100")} />{errors.endsAt && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.endsAt.message}</p>}</div>
                      </div>
                    </section>
                  </div>

                  <aside className="grid gap-4 md:grid-cols-2 xl:sticky xl:top-0 xl:block xl:self-start xl:space-y-4">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{isArabic ? "معاينة مباشرة" : "Live preview"}</p>
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-5 text-white shadow-xl shadow-violet-900/15">
                        <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
                        <div className="relative"><div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide backdrop-blur"><SparklesIcon className="h-3 w-3" />{watchDiscountValue > 0 ? formatDiscount(watchDiscountType, watchDiscountValue) : "—"}</div><p className="mt-5 line-clamp-2 min-h-14 text-xl font-black">{watchName || (isArabic ? "اسم العرض" : "Promotion name")}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-violet-100"><ClockIcon className="h-3.5 w-3.5" />{watchStartsAt && watchEndsAt ? `${new Date(watchStartsAt).toLocaleDateString(isArabic ? "ar-EG" : "en-EG")} → ${new Date(watchEndsAt).toLocaleDateString(isArabic ? "ar-EG" : "en-EG")}` : (isArabic ? "حدد فترة العرض" : "Set the offer window")}</p></div>
                      </div>
                    </div>
                    <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", errors.productIds ? "border-rose-200" : "border-slate-200")}>
                      <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><CubeIcon className="h-5 w-5" /></span><span className="text-2xl font-black text-slate-900">{watchProductIds.length}</span></div><p className="mt-3 text-sm font-black text-slate-800">{isArabic ? "المنتجات المشمولة" : "Included products"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{watchProductIds.length > 0 ? (isArabic ? "يمكنك مراجعة الأسعار والمخزون والتعارضات في الخطوة التالية." : "Review pricing, stock, and conflicts in the next step.") : (isArabic ? "يلزم اختيار منتج واحد على الأقل قبل حفظ العرض." : "At least one product is required before this offer can be saved.")}</p><button type="button" onClick={() => { void goToProducts(); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 hover:bg-violet-100">{isArabic ? "اختيار المنتجات" : "Choose products"}<ArrowRightIcon className="h-4 w-4 rtl:rotate-180" /></button>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[1400px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                  <PromotionProductSelector
                    knownProducts={productsById}
                    selectedIds={watchProductIds}
                    onToggle={(id: string) => {
                      const current = (watchProductIds ?? []) as string[];
                      const next = current.includes(id) ? current.filter((pid: string) => pid !== id) : [...current, id];
                      setValue("productIds", next, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                    }}
                    onSelectionChange={(ids: string[]) => setValue("productIds", ids, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                    discountPreview={watchDiscountValue > 0 ? formatDiscount(watchDiscountType, watchDiscountValue) : undefined}
                    discountType={watchDiscountType}
                    discountValue={watchDiscountValue}
                    startsAt={watchStartsAt}
                    endsAt={watchEndsAt}
                    excludePromotionId={editing?.id}
                  />
                  {errors.productIds && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{errors.productIds.message}</div>}
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={requestEditorClose} disabled={saving} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t("promotions.cancel")}</button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {editorTab === "products" && <button type="button" onClick={() => setEditorTab("details")} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />{isArabic ? "العودة للتفاصيل" : "Back to details"}</button>}
                  {editorTab === "details" ? <button type="button" onClick={() => { void goToProducts(); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700">{isArabic ? "التالي: إضافة المنتجات" : "Next: add products"}<ArrowRightIcon className="h-4 w-4 rtl:rotate-180" /></button> : <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}{saving ? t("promotions.saving") : t("promotions.save")}</button>}
                </div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PromotionCopilotWorkspace
        key={copilotContext?.id ?? "new-promotion"}
        open={copilotOpen}
        locale={lang}
        productsById={productsById}
        existingPromotionsByProduct={existingPromotionsByProduct}
        currentDraft={copilotContext ?? copilotDraft}
        onClose={() => setCopilotOpen(false)}
        onApply={applyCopilotProposal}
      />

      {/* Confirmation dialog */}
      {confirmDialog && (
        <AdminConfirmDialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog(null)}
          onConfirm={async () => {
            await confirmDialog.onConfirm();
          }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          tone={confirmDialog.tone || "info"}
          lang={lang}
        />
      )}
    </div>
  );
}
