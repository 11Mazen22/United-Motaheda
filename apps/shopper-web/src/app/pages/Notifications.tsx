import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getSupabaseClient } from "../../lib/supabaseClient";

interface AppNotification {
  id: string;
  type: string;
  category: string | null;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

function formatDate(value: string, lang: "ar" | "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function webActionUrl(actionUrl: string): string {
  const orderMatch = actionUrl.match(/^\/order\/([^/?#]+)/);
  if (orderMatch) return `/orders?order=${encodeURIComponent(orderMatch[1])}`;
  if (actionUrl.startsWith("/(pharmacist)/") || actionUrl.startsWith("/(driver)/")) return "/profile";
  if (actionUrl.startsWith("/prescriptions/")) return "/profile";
  return actionUrl;
}

export default function Notifications() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (!user?.id) return;
    if (manual) setRefreshing(true);
    setError(null);
    try {
      const { data, error: queryError } = await getSupabaseClient()
        .from("notifications")
        .select("id, type, category, title, body, action_url, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      setItems((data ?? []) as AppNotification[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (lang === "ar" ? "تعذر تحميل الإشعارات." : "Unable to load notifications."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang, user?.id]);

  useEffect(() => {
    void load();
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`shopper-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        ({ new: row }) => setItems((current) => {
          const next = row as AppNotification;
          return current.some((item) => item.id === next.id) ? current : [next, ...current];
        }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        ({ new: row }) => setItems((current) => current.map((item) => item.id === (row as AppNotification).id ? row as AppNotification : item)),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, user?.id]);

  const markRead = useCallback(async (id: string) => {
    if (!user?.id) return;
    const previous = items;
    setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
    const { error: mutationError } = await getSupabaseClient()
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (mutationError) {
      setItems(previous);
      setError(mutationError.message);
    }
  }, [items, user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    const { error: mutationError } = await getSupabaseClient()
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (mutationError) {
      setItems(previous);
      setError(mutationError.message);
    }
  }, [items, user?.id]);

  const unread = items.filter((item) => !item.is_read).length;
  const text = lang === "ar"
    ? { title: "الإشعارات", unread: `${unread} غير مقروء`, allRead: "تحديد الكل كمقروء", retry: "إعادة المحاولة", empty: "لا توجد إشعارات", error: "تعذر تحميل الإشعارات." }
    : { title: "Notifications", unread: `${unread} unread`, allRead: "Mark all read", retry: "Retry", empty: "No notifications yet", error: "Unable to load notifications." };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">United Pharmacies</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{text.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{text.unread}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load(true)} className="rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50" aria-label={text.retry}>
            {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          </button>
          {unread > 0 && <button onClick={() => void markAllRead()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"><CheckCheck className="h-4 w-4" />{text.allRead}</button>}
        </div>
      </div>

      {loading ? <div className="space-y-3">{[1, 2, 3].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div> : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700"><p>{text.error}</p><button onClick={() => void load(true)} className="mt-4 font-bold underline">{text.retry}</button></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><Bell className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{text.empty}</p></div>
      ) : (
        <div className="space-y-3">{items.map((item) => <article key={item.id} className={`rounded-2xl border p-5 transition ${item.is_read ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50/60"}`}>
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-xl bg-emerald-100 p-2 text-emerald-700"><Bell className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">{item.title}</h2><time className="text-xs text-slate-400">{formatDate(item.created_at, lang)}</time></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p><div className="mt-4 flex flex-wrap gap-3">{!item.is_read && <button onClick={() => void markRead(item.id)} className="text-xs font-bold text-emerald-700 underline">{lang === "ar" ? "تحديد كمقروء" : "Mark as read"}</button>}{item.action_url && <button onClick={() => { void markRead(item.id); navigate(webActionUrl(item.action_url!)); }} className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 underline"><ExternalLink className="h-3 w-3" />{lang === "ar" ? "فتح" : "Open"}</button>}</div></div>
          </div>
        </article>)}</div>
      )}
    </main>
  );
}
