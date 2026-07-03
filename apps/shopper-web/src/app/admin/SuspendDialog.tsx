import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, FileText, Loader2, ShieldOff, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../components/UI";
import { suspendUser, type SuspendUserPayload } from "../../services/adminUsersApi";
import { POLICIES } from "../../data/policyData";
import { toast } from "sonner";

interface SuspendDialogProps {
  open: boolean;
  onClose: () => void;
  user: { id: string; fullName: string; email: string } | null;
  adminId: string;
  adminEmail?: string;
  lang: "ar" | "en";
  onSuccess: () => void;
}

const DELETION_REASONS = [
  { value: "permanent", labelAr: "دائم", labelEn: "Permanent" },
  { value: "temporary", labelAr: "مؤقت", labelEn: "Temporary" },
] as const;

export default function SuspendDialog({
  open,
  onClose,
  user,
  adminId,
  adminEmail,
  lang,
  onSuccess,
}: SuspendDialogProps) {
  const isArabic = lang === "ar";
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [durationType, setDurationType] = useState<"permanent" | "temporary">("permanent");
  const [expiresAt, setExpiresAt] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedCodes([]);
      setDurationType("permanent");
      setExpiresAt("");
      setAdminNotes("");
    }
  }, [open]);

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (selectedCodes.length === 0) {
      toast.error(isArabic ? "اختر سببًا واحدًا على الأقل" : "Select at least one policy violation");
      return;
    }
    if (durationType === "temporary" && !expiresAt) {
      toast.error(isArabic ? "حدد تاريخ انتهاء التعليق المؤقت" : "Set an expiry date for temporary suspension");
      return;
    }

    const payload: SuspendUserPayload = {
      userId: user.id,
      reasonCodes: selectedCodes,
      adminNotes: adminNotes.trim() || undefined,
      durationType,
      expiresAt: durationType === "temporary" ? expiresAt : undefined,
      adminId,
      adminEmail,
    };

    setLoading(true);
    try {
      await suspendUser(payload);
      toast.success(
        isArabic
          ? `تم تعليق حساب ${user.fullName} بنجاح`
          : `${user.fullName}'s account suspended`,
      );
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to suspend user";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const severityColors: Record<string, string> = {
    low: "border-slate-200 bg-slate-50 text-slate-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    critical: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
              <ShieldOff className="h-5 w-5 text-rose-600" />
            </span>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900">
                {isArabic ? "تعليق الحساب" : "Suspend Account"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-slate-500">
                {user.fullName} · <span dir="ltr">{user.email}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              {isArabic
                ? "سيتم تسجيل خروج المستخدم من جميع الأجهزة وسيُحظر تسجيل الدخول حتى يتم رفع التعليق."
                : "The user will be blocked from signing in until the suspension is lifted."}
            </p>
          </div>

          {/* Policy violations */}
          <div>
            <label className="mb-2.5 block text-sm font-bold text-slate-800">
              {isArabic ? "* انتهاكات السياسة (اختر واحدًا أو أكثر)" : "* Policy Violations (select one or more)"}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {POLICIES.map((policy) => {
                const selected = selectedCodes.includes(policy.code);
                return (
                  <button
                    key={policy.code}
                    type="button"
                    onClick={() => toggleCode(policy.code)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-start transition-all",
                      selected
                        ? "border-rose-300 bg-rose-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        selected ? "border-rose-500 bg-rose-500" : "border-slate-300 bg-white",
                      )}
                    >
                      {selected && (
                        <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-white">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {policy.code}
                        </span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", severityColors[policy.severity])}>
                          {policy.severity}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-semibold text-slate-800">
                        {isArabic ? policy.titleAr : policy.titleEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-2.5 block text-sm font-bold text-slate-800">
              {isArabic ? "مدة التعليق" : "Suspension Duration"}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DELETION_REASONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDurationType(opt.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all",
                    durationType === opt.value
                      ? "border-rose-300 bg-rose-50 text-rose-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {isArabic ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
            {durationType === "temporary" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  <Calendar className="me-1 inline h-3.5 w-3.5" />
                  {isArabic ? "تاريخ انتهاء التعليق" : "Suspension Expiry Date"}
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                />
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-800">
              <FileText className="me-1.5 inline h-4 w-4 text-slate-400" />
              {isArabic ? "ملاحظات الإدارة (اختياري)" : "Admin Notes (optional)"}
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              placeholder={isArabic ? "سبب إضافي أو تفاصيل تُرسل للمستخدم…" : "Additional reason or details shown to the user…"}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-55"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              {isArabic ? "تعليق الحساب" : "Suspend Account"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
