/**
 * NotificationsManager — Powerful admin hub for push notifications.
 * Features: templates, realtime live-feed, type analytics, history filter, bulk delete.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  BellAlertIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  SignalIcon,
  SparklesIcon as SparklesOutlineIcon,
  TagIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  BoltIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import { toast } from "sonner";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/LanguageContext";
import { AdminConfirmDialog, useDebouncedValue } from "./adminShared";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType  = "order" | "offer" | "health" | "system";
type SendTarget = "all" | "user";
type HistFilter = NotifType | "all";

interface SentNotification {
  id:         string;
  user_id:    string | null;
  type:       NotifType;
  title:      string;
  body:       string;
  is_read:    boolean;
  created_at: string;
}

interface RecipientUser {
  id:       string;
  fullName: string;
  email:    string;
  phone:    string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const TYPE_META: Record<NotifType, {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
  ring:   string;
  icon:   React.ElementType;
}> = {
  order:  { label: "تحديث الطلب",  color: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-200",   ring: "ring-teal-300/40",   icon: BellIcon         },
  offer:  { label: "عروض وخصومات", color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  ring: "ring-amber-300/40",  icon: TagIcon          },
  health: { label: "تنبيه صحي",    color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200",ring: "ring-emerald-300/40",icon: BellAlertIcon    },
  system: { label: "إشعار النظام", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", ring: "ring-purple-300/40", icon: SparklesIcon     },
};

// ─── Quick templates ──────────────────────────────────────────────────────────

const QUICK_TEMPLATES: { type: NotifType; title: string; body: string }[] = [
  { type: "order",  title: "تم تأكيد طلبك ✓",         body: "طلبك قيد التجهيز وسيصل إليك خلال الوقت المحدد." },
  { type: "order",  title: "طلبك في الطريق 🚚",         body: "الشحن على الطريق إليك — التوصيل خلال 30-60 دقيقة." },
  { type: "order",  title: "تم التسليم بنجاح 🎉",       body: "وصل طلبك. نتمنى أن تكون تجربتك ممتازة!" },
  { type: "offer",  title: "عرض خاص اليوم فقط 🎁",     body: "خصم 20% على جميع منتجات الرعاية الشخصية حتى منتصف الليل." },
  { type: "offer",  title: "خصومات الأسبوع 🏷️",        body: "وفّر حتى 30% على المكملات الغذائية والفيتامينات." },
  { type: "health", title: "تذكير بالجرعة اليومية 💊",  body: "حان وقت دوائك. اعتنِ بصحتك دائماً." },
  { type: "health", title: "نصيحة صحية 🌿",            body: "اشرب كميات كافية من الماء يومياً للحفاظ على نشاطك." },
  { type: "system", title: "تحديث جديد متاح 🆕",        body: "حدّث التطبيق الآن للاستمتاع بأحدث المميزات." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────



function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} ي`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, gradient, glowColor, iconBg, iconShadow, valueColor, delta,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
  iconBg: string;
  iconShadow: string;
  valueColor: string;
  delta?: number;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)" }}
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r ${gradient}`} />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: `radial-gradient(ellipse 80% 60% at 10% 0%, ${glowColor}, transparent)` }}
      />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: iconBg, boxShadow: `0 4px 12px ${iconShadow}` }}
          >
            <Icon className="h-5 w-5" style={{ color: valueColor }} />
          </span>
        </div>
        <p className="mt-3 text-3xl font-black tracking-tight" style={{ color: valueColor }}>{value}</p>
        {delta !== undefined && delta > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            +{delta} اليوم
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Type breakdown bar ───────────────────────────────────────────────────────

function TypeBreakdown({ sent }: { sent: SentNotification[] }) {
  const counts = useMemo(() => {
    const c: Record<NotifType, number> = { order: 0, offer: 0, health: 0, system: 0 };
    sent.forEach((n) => { if (c[n.type] !== undefined) c[n.type]++; });
    return c;
  }, [sent]);

  const total = sent.length || 1;
  const colors: Record<NotifType, string> = {
    order: "bg-teal-400", offer: "bg-amber-400", health: "bg-emerald-400", system: "bg-purple-400",
  };

  return (
    <div className="space-y-2">
      {(Object.entries(counts) as [NotifType, number][]).map(([type, count]) => {
        const pct = Math.round((count / total) * 100);
        const meta = TYPE_META[type];
        return (
          <div key={type} className="flex items-center gap-3">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
              <meta.icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">{meta.label}</span>
                <span className="text-xs font-black text-slate-900">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${colors[type]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Recipient avatar ─────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#0E7E74", "#0EA5E9", "#6366F1", "#F59E0B", "#EC4899", "#8B5CF6", "#10B981", "#EF4444"];

function avatarColor(seed: string): string {
  const hash = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function RecipientAvatar({ name, email }: { name: string; email: string }) {
  const display = name || email;
  const initials = display
    ? display.split(name ? " " : "@").slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("").slice(0, 2)
    : "?";
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
      style={{ backgroundColor: avatarColor(display || "?") }}
    >
      {initials || "?"}
    </span>
  );
}

// ─── Recipient picker — search users by name/phone/email, multi-select ────────

function UserRecipientPicker({
  selected,
  onChange,
  lang,
}: {
  selected: RecipientUser[];
  onChange: (users: RecipientUser[]) => void;
  lang: "ar" | "en";
}) {
  const [query, setQuery]     = useState("");
  const debounced              = useDebouncedValue(query, 300);
  const [results, setResults] = useState<RecipientUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen]       = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const like = `%${term}%`;
    getSupabaseClient()
      .from("profiles")
      .select("id, full_name, email, phone")
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(8)
      .then(({ data }) => {
        if (cancelled) return;
        const selectedIds = new Set(selected.map((s) => s.id));
        const rows = ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; phone: string | null }>)
          .filter((r) => !selectedIds.has(r.id))
          .map((r) => ({ id: r.id, fullName: r.full_name ?? "", email: r.email ?? "", phone: r.phone ?? "" }));
        setResults(rows);
        setSearching(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addUser = (u: RecipientUser) => {
    onChange([...selected, u]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };
  const removeUser = (id: string) => onChange(selected.filter((s) => s.id !== id));

  return (
    <div ref={containerRef} className="relative">
      {/* Selected recipient chips */}
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 py-1 ps-1 pe-2 text-xs font-bold text-teal-800"
            >
              <RecipientAvatar name={u.fullName} email={u.email} />
              <span className="max-w-[140px] truncate">{u.fullName || u.email || u.phone}</span>
              <button
                type="button"
                onClick={() => removeUser(u.id)}
                className="ms-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-teal-600 hover:bg-teal-200"
                aria-label={lang === "ar" ? "إزالة" : "Remove"}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={lang === "ar" ? "ابحث بالاسم أو الهاتف أو البريد…" : "Search by name, phone, or email…"}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
      </div>

      {/* Results dropdown */}
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {searching ? (
            <div className="p-3 text-center text-xs font-semibold text-slate-400">
              {lang === "ar" ? "جارٍ البحث…" : "Searching…"}
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center text-xs font-semibold text-slate-400">
              {lang === "ar" ? "لا توجد نتائج" : "No matches found"}
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => addUser(u)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-slate-50"
                >
                  <RecipientAvatar name={u.fullName} email={u.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{u.fullName || (lang === "ar" ? "بدون اسم" : "Unnamed")}</p>
                    <p className="truncate text-xs text-slate-400" dir="ltr">{[u.phone, u.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Compose form ─────────────────────────────────────────────────────────────

function ComposeCard() {
  const { lang } = useLanguage();
  const [type,    setType]    = useState<NotifType>("system");
  const [title,   setTitle]   = useState("");
  const [body,    setBody]    = useState("");
  const [target,  setTarget]  = useState<SendTarget>("all");
  const [recipients, setRecipients] = useState<RecipientUser[]>([]);
  const [sending, setSending] = useState(false);
  const [confirmBroadcastOpen, setConfirmBroadcastOpen] = useState(false);
  const [broadcastCount, setBroadcastCount] = useState<number | null>(null);

  // Apply template
  const applyTemplate = (tmpl: typeof QUICK_TEMPLATES[number]) => {
    setType(tmpl.type);
    setTitle(tmpl.title);
    setBody(tmpl.body);
  };

  const handleSend = useCallback(async () => {
    if (!title.trim() || !body.trim()) return;
    if (target === "user" && recipients.length === 0) return;
    setSending(true);
    try {
      const sb = getSupabaseClient();
      const cleanTitle = title.trim();
      const cleanBody  = body.trim();

      if (target === "all") {
        // ── Broadcast path ────────────────────────────────────────────────
        // The previous version called the `broadcast_notification` RPC. That
        // function isn't deployed on this Supabase instance, so it 404'd and
        // surfaced the "فشل الإرسال" error to the admin every time.
        //
        // We now enqueue the broadcast durably via `enqueue_notification_batch`
        // (see supabase/migrations/20260713090000_notification_delivery_pipeline.sql):
        //   1. Pull every active user ID from `profiles` (the source of truth
        //      for app accounts — same table the native app reads/writes).
        //   2. The RPC inserts one `notifications` row per recipient (each
        //      insert is instantly picked up by this screen's own realtime
        //      subscription below, and by the mobile app's per-user channel)
        //      and one `notification_outbox` row per recipient.
        //   3. A scheduled worker (supabase/functions/notification-worker)
        //      claims the outbox and pushes to every registered Expo device
        //      token, with retries and per-user preference checks — so closed
        //      apps still wake up, without the client waiting on that work.
        const { data: profiles, error: pErr } = await sb
          .from("profiles")
          .select("id");
        if (pErr) throw pErr;

        const userIds = (profiles ?? [])
          .map((p) => (p as { id?: string }).id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);

        if (userIds.length === 0) {
          throw new Error("No user accounts found to broadcast to.");
        }

        const { error: queueError } = await sb.rpc("enqueue_notification_batch", {
          p_recipient_ids: userIds,
          p_event_type: type,
          p_category: type === "offer" ? "promotions" : "account_updates",
          p_title: cleanTitle,
          p_body: cleanBody,
          p_data: { source: "admin_broadcast", type },
          p_action_url: null,
          p_idempotency_namespace: `admin:${crypto.randomUUID()}`,
        });
        if (queueError) throw queueError;
      } else {
        // ── Selected-recipients path (1 or more) ────────────────────────────
        // Same durable enqueue/outbox/worker pipeline as the broadcast path
        // above, scoped to the chosen recipients.
        const { error: queueError } = await sb.rpc("enqueue_notification_batch", {
          p_recipient_ids: recipients.map((recipient) => recipient.id),
          p_event_type: type,
          p_category: type === "offer" ? "promotions" : "account_updates",
          p_title: cleanTitle,
          p_body: cleanBody,
          p_data: { source: "admin_compose", type },
          p_action_url: null,
          p_idempotency_namespace: `admin:${crypto.randomUUID()}`,
        });
        if (queueError) throw queueError;
      }

      toast.success(lang === "ar" ? "تم الإرسال بنجاح!" : "Sent successfully!");
      setTitle("");
      setBody("");
      setRecipients([]);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[NotificationsManager] send failed:", err);
      }
      toast.error(lang === "ar" ? "فشل الإرسال. تحقق من إعداد Supabase." : "Failed. Check Supabase config.");
    } finally {
      setSending(false);
    }
  }, [type, title, body, target, recipients, lang]);

  const handleSendClick = useCallback(() => {
    if (target === "all") {
      setBroadcastCount(null);
      setConfirmBroadcastOpen(true);
      // Best-effort recipient count for the confirmation copy — doesn't block
      // opening the dialog, and handleSend re-fetches the real ids itself.
      void getSupabaseClient()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .then(({ count }) => setBroadcastCount(count ?? null));
      return;
    }
    void handleSend();
  }, [target, handleSend]);

  const isValid = title.trim().length > 0 && body.trim().length > 0 && (target === "all" || recipients.length > 0);
  const meta    = TYPE_META[type];

  return (
    <div className="flex flex-col gap-5">
      {/* Templates */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <BoltIcon className="h-4 w-4" />
          </div>
          <p className="text-sm font-black text-slate-900">
            {lang === "ar" ? "قوالب سريعة" : "Quick Templates"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4">
          {QUICK_TEMPLATES.map((tmpl, i) => {
            const m = TYPE_META[tmpl.type];
            return (
              <button
                key={i}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-start transition-all hover:shadow-sm hover:-translate-y-px active:scale-[.98] ${m.bg} ${m.border}`}>
                <m.icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${m.color}`} />
                <div className="min-w-0">
                  <p className={`truncate text-xs font-black ${m.color}`}>{tmpl.title}</p>
                  <p className="truncate text-[10px] text-slate-500">{tmpl.body}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compose */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <PaperAirplaneIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">
              {lang === "ar" ? "إنشاء إشعار" : "Compose"}
            </p>
            <p className="text-xs text-slate-400">
              {lang === "ar" ? "يُسلَّم فورياً عبر Supabase Realtime" : "Delivered instantly via Supabase Realtime"}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Type */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {lang === "ar" ? "النوع" : "Type"}
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(Object.entries(TYPE_META) as [NotifType, typeof TYPE_META[NotifType]][]).map(([k, m]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-all ${
                    type === k
                      ? `${m.bg} ${m.border} ${m.color} ring-2 ring-offset-1 ${m.ring}`
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}>
                  <m.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {lang === "ar" ? "المستلمون" : "Recipients"}
            </label>
            <div className="flex gap-2">
              {[
                { key: "all" as const,  label: lang === "ar" ? "الجميع" : "All",        icon: MegaphoneIcon },
                { key: "user" as const, label: lang === "ar" ? "مستخدم محدد" : "Specific User", icon: UserIcon },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTarget(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                    target === key
                      ? "border-teal-300 bg-teal-50 text-teal-700 ring-2 ring-offset-1 ring-teal-300/40"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
            {target === "user" && (
              <div className="mt-2">
                <UserRecipientPicker selected={recipients} onChange={setRecipients} lang={lang} />
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {lang === "ar" ? "العنوان" : "Title"}
              </label>
              <span className={`text-xs font-semibold ${title.length > 70 ? "text-amber-600" : "text-slate-400"}`}>
                {title.length}/80
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder={lang === "ar" ? "مثال: تم تأكيد طلبك بنجاح ✓" : "e.g. Order confirmed ✓"}
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {/* Body */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {lang === "ar" ? "النص" : "Body"}
              </label>
              <span className={`text-xs font-semibold ${body.length > 180 ? "text-amber-600" : "text-slate-400"}`}>
                {body.length}/200
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder={lang === "ar" ? "النص التفصيلي للإشعار…" : "Notification body text…"}
              dir="rtl"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {/* Live preview */}
          {(title || body) && (
            <div className={`overflow-hidden rounded-xl border ${meta.border} ${meta.bg} p-3.5`}>
              <div className="mb-2 flex items-center gap-1.5">
                <SparklesOutlineIcon className={`h-3.5 w-3.5 ${meta.color}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${meta.color} opacity-70`}>
                  {lang === "ar" ? "معاينة" : "Preview"}
                </span>
              </div>
              {/* Fake phone notification */}
              <div className="flex items-start gap-2.5 rounded-xl bg-white/80 px-3 py-2.5 shadow-sm backdrop-blur">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
                  <meta.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black ${meta.color} truncate`}>{title || "—"}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{body || "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Send */}
          <button
            type="button"
            onClick={handleSendClick}
            disabled={!isValid || sending}
            className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-slate-800 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
            {sending && (
              <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-teal-900/30 via-transparent to-teal-900/30" />
            )}
            <PaperAirplaneIcon className="h-4 w-4" />
            {sending
              ? (lang === "ar" ? "جارٍ الإرسال…" : "Sending…")
              : target === "all"
                ? (lang === "ar" ? "إرسال لجميع المستخدمين" : "Broadcast to all users")
                : recipients.length > 0
                  ? (lang === "ar"
                    ? `إرسال إلى ${recipients.length} ${recipients.length === 1 ? "مستخدم" : "مستخدمين"}`
                    : `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`)
                  : (lang === "ar" ? "اختر مستلماً واحداً على الأقل" : "Select at least one recipient")}
          </button>
        </div>
      </div>

      <AdminConfirmDialog
        open={confirmBroadcastOpen}
        onClose={() => setConfirmBroadcastOpen(false)}
        onConfirm={handleSend}
        title={lang === "ar" ? "تأكيد البث للجميع" : "Confirm broadcast to all"}
        description={
          broadcastCount != null
            ? (lang === "ar"
              ? `أنت على وشك إرسال إشعار إلى ${broadcastCount} مستخدم. هل تريد الاستمرار؟`
              : `You are about to notify ${broadcastCount} users. Continue?`)
            : (lang === "ar"
              ? "أنت على وشك إرسال إشعار إلى جميع المستخدمين. هل تريد الاستمرار؟"
              : "You are about to notify all users. Continue?")
        }
        tone="warning"
        confirmLabel={lang === "ar" ? "إرسال" : "Send"}
        lang={lang}
      />
    </div>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({ n, onDelete, isNew }: { n: SentNotification; onDelete: (id: string) => void; isNew?: boolean }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  return (
    <div className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition-all hover:shadow-sm hover:-translate-y-px ${
      isNew ? "notif-row-enter" : ""
    } ${n.is_read ? "border-slate-100 bg-white" : `${meta.bg} ${meta.border}`}`}>
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
        <meta.icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{n.title}</p>
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400 tabular-nums">
            <ClockIcon className="h-3 w-3" />
            {relativeTime(n.created_at)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.body}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          {n.user_id === null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              <MegaphoneIcon className="h-3 w-3" />
              broadcast
            </span>
          )}
          {!n.is_read && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              جديد
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(n.id)}
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-300 opacity-0 transition-all group-hover:border-red-200 group-hover:bg-red-50 group-hover:text-red-500 group-hover:opacity-100">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  sent,
  loading,
  liveCount,
  onDelete,
  onDeleteAll,
}: {
  sent:        SentNotification[];
  loading:     boolean;
  liveCount:   number;
  onDelete:    (id: string) => void;
  onDeleteAll: () => void;
}) {
  const { lang } = useLanguage();
  const [filter,   setFilter]   = useState<HistFilter>("all");
  const [newIds,   setNewIds]   = useState<Set<string>>(new Set());
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const prevLen = sent.length;

  // Track newly arrived items
  useEffect(() => {
    if (sent.length > prevLen && sent[0]) {
      setNewIds((p) => new Set([...p, sent[0].id]));
      const t = setTimeout(() => setNewIds((p) => { const s = new Set(p); s.delete(sent[0].id); return s; }), 3000);
      return () => clearTimeout(t);
    }
  }, [sent.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => filter === "all" ? sent : sent.filter((n) => n.type === filter),
    [sent, filter],
  );

  const filterTabs: { key: HistFilter; label: string }[] = [
    { key: "all",    label: lang === "ar" ? "الكل"    : "All"    },
    { key: "order",  label: lang === "ar" ? "الطلبات" : "Orders" },
    { key: "offer",  label: lang === "ar" ? "العروض"  : "Offers" },
    { key: "health", label: lang === "ar" ? "الصحة"   : "Health" },
    { key: "system", label: lang === "ar" ? "النظام"  : "System" },
  ];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <ClockIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">
              {lang === "ar" ? "سجل الإشعارات" : "History"}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              {liveCount > 0 ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-emerald-600 font-semibold">
                    {liveCount} {lang === "ar" ? "جديد" : "new"}
                  </span>
                </>
              ) : (
                <>
                  <SignalIcon className="h-3 w-3 text-slate-300" />
                  {lang === "ar" ? `${sent.length} إشعار` : `${sent.length} notifications`}
                </>
              )}
            </p>
          </div>
        </div>

        {sent.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100">
            <TrashIcon className="h-3.5 w-3.5" />
            {lang === "ar" ? "مسح السجل المعروض" : "Clear visible history"}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-2.5">
        {filterTabs.map((t) => {
          const count = t.key === "all" ? sent.length : sent.filter((n) => n.type === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                filter === t.key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}>
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${filter === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="max-h-[560px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
            <BellIcon className="h-12 w-12 text-slate-200" />
            <p className="text-sm font-semibold">{lang === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filtered.map((n) => (
              <NotifRow
                key={n.id}
                n={n}
                isNew={newIds.has(n.id)}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>

      <AdminConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={onDeleteAll}
        title={lang === "ar" ? "مسح السجل المعروض؟" : "Clear visible history?"}
        description={
          lang === "ar"
            ? `سيتم حذف ${sent.length} إشعار المعروض حالياً نهائياً. لا يمكن التراجع عن هذا الإجراء.`
            : `This will permanently delete the ${sent.length} notifications currently shown. This cannot be undone.`
        }
        tone="danger"
        confirmLabel={lang === "ar" ? "حذف" : "Delete"}
        lang={lang}
      />
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NotificationsManager() {
  const { lang } = useLanguage();
  const [sent,      setSent]      = useState<SentNotification[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  // Initial fetch
  useEffect(() => {
    getSupabaseClient()
      .from("notifications")
      .select("id, user_id, type, title, body, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setSent((data ?? []) as SentNotification[]);
        setLoading(false);
      }, () => setLoading(false));
  }, []);

  // Realtime subscription — admin watches all new notifications
  useEffect(() => {
    const sb = getSupabaseClient();
    const channel = sb
      .channel("admin-notifs-live-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: SentNotification }) => {
          setSent((prev) => {
            if (prev.some((n) => n.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          setLiveCount((c) => c + 1);
          setTimeout(() => setLiveCount((c) => Math.max(0, c - 1)), 3000);
        },
      )
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setSent((prev) => prev.filter((n) => n.id !== id));
    try { await getSupabaseClient().from("notifications").delete().eq("id", id); } catch { /**/ }
  }, []);

  const handleDeleteAll = useCallback(async () => {
    const ids = sent.map((n) => n.id);
    setSent([]);
    try { await getSupabaseClient().from("notifications").delete().in("id", ids); } catch { /**/ }
  }, [sent]);

  const unread = sent.filter((n) => !n.is_read).length;
  const today  = sent.filter((n) => new Date(n.created_at).toDateString() === new Date().toDateString()).length;
  const broadcasts = sent.filter((n) => n.user_id === null).length;

  return (
    <div className="space-y-6">

      {/* ── Stats row ── */}
      <div className="stagger-children grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={lang === "ar" ? "إجمالي المُرسَل" : "Total Sent"}  value={sent.length} icon={BellIcon}          gradient="from-teal-600 to-emerald-700"   glowColor="rgba(14,126,116,0.06)"   iconBg="rgba(14,126,116,0.12)"  iconShadow="rgba(14,126,116,0.35)"  valueColor="#134e4a" delta={today} />
        <StatCard label={lang === "ar" ? "أُرسلت اليوم"   : "Sent Today"}  value={today}       icon={PaperAirplaneIcon} gradient="from-blue-600 to-indigo-700"    glowColor="rgba(59,130,246,0.06)"   iconBg="rgba(59,130,246,0.12)"  iconShadow="rgba(59,130,246,0.3)"   valueColor="#1e3a8a" />
        <StatCard label={lang === "ar" ? "غير مقروءة"     : "Unread"}      value={unread}      icon={BellAlertIcon}     gradient="from-amber-500 to-orange-600"   glowColor="rgba(245,158,11,0.06)"   iconBg="rgba(245,158,11,0.12)"  iconShadow="rgba(245,158,11,0.3)"   valueColor="#78350f" />
        <StatCard label={lang === "ar" ? "بث عام"          : "Broadcasts"}  value={broadcasts}  icon={MegaphoneIcon}     gradient="from-violet-600 to-purple-700"  glowColor="rgba(139,92,246,0.06)"   iconBg="rgba(139,92,246,0.12)"  iconShadow="rgba(139,92,246,0.3)"   valueColor="#3b0764" />
      </div>

      {/* ── Analytics + compose ──────────── History ── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="flex flex-col gap-5">
          {/* Type breakdown */}
          {sent.length > 0 && (
            <div className="section-enter admin-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: "120ms" }}>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <CheckCircleIcon className="h-4 w-4" />
                </div>
                <p className="text-sm font-black text-slate-900">
                  {lang === "ar" ? "توزيع الإشعارات" : "Breakdown"}
                </p>
              </div>
              <TypeBreakdown sent={sent} />
            </div>
          )}

          <ComposeCard />
        </div>

        <HistoryPanel
          sent={sent}
          loading={loading}
          liveCount={liveCount}
          onDelete={handleDelete}
          onDeleteAll={handleDeleteAll}
        />
      </div>
    </div>
  );
}
