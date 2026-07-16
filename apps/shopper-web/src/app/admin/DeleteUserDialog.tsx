import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../components/UI";
import { type DeleteUserPayload } from "../../services/adminUsersApi";
import { toast } from "sonner";

interface DeleteUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: { id: string; fullName: string; email: string } | null;
  lang: "ar" | "en";
  onDelete: (payload: DeleteUserPayload) => Promise<void>;
}

const REASONS = [
  { value: "policy_violation", labelAr: "انتهاك السياسات", labelEn: "Policy Violation" },
  { value: "fraud",            labelAr: "احتيال مؤكد",     labelEn: "Confirmed Fraud" },
  { value: "duplicate",        labelAr: "حساب مكرر",       labelEn: "Duplicate Account" },
  { value: "spam",             labelAr: "حساب بريد عشوائي", labelEn: "Spam Account" },
  { value: "user_request",     labelAr: "طلب المستخدم",    labelEn: "User Request" },
  { value: "other",            labelAr: "سبب آخر",         labelEn: "Other" },
];

export default function DeleteUserDialog({
  open,
  onClose,
  user,
  lang,
  onDelete,
}: DeleteUserDialogProps) {
  const isArabic = lang === "ar";
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setAdminNotes("");
      setConfirmText("");
    } else {
      confirmRef.current?.focus();
    }
  }, [open]);

  const expectedConfirm = user?.email ?? "";
  const canSubmit = Boolean(reason) && confirmText === expectedConfirm;

  const handleSubmit = async () => {
    if (!user || !canSubmit || loading) return;

    const payload: DeleteUserPayload = {
      userId: user.id,
      reason,
      adminNotes: adminNotes.trim() || undefined,
    };

    setLoading(true);
    try {
      await onDelete(payload);
      toast.success(
        isArabic
          ? `تم حذف حساب ${user.fullName}`
          : `${user.fullName}'s account deleted`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <Trash2 className="h-5 w-5 text-red-600" />
            </span>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900">
                {isArabic ? "حذف الحساب" : "Delete Account"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-slate-500">
                {user.fullName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Destructive warning */}
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-800">
                  {isArabic ? "هذا الإجراء لا يمكن التراجع عنه" : "This action cannot be undone"}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {isArabic
                    ? "سيتم حذف بيانات تسجيل الدخول والبيانات المرتبطة بالحساب نهائيًا مع الاحتفاظ بسجلات التدقيق والتشغيل مجهولة الهوية."
                    : "Sign-in access and account-owned data will be permanently deleted. Audit and operational history will be retained without the user's identity."}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="delete-user-reason" className="mb-1.5 block text-sm font-bold text-slate-800">
              {isArabic ? "* سبب الحذف" : "* Deletion Reason"}
            </label>
            <select
              id="delete-user-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="">{isArabic ? "اختر السبب…" : "Select a reason…"}</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {isArabic ? r.labelAr : r.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Admin notes */}
          <div>
            <label htmlFor="delete-user-notes" className="mb-1.5 block text-sm font-bold text-slate-800">
              {isArabic ? "ملاحظات إضافية (اختياري)" : "Additional Notes (optional)"}
            </label>
            <textarea
              id="delete-user-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={isArabic ? "ملاحظات تُسجَّل في سجل الحذف…" : "Notes recorded in the deletion log…"}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </div>

          {/* Confirm by typing email */}
          <div>
            <label htmlFor="delete-user-confirmation" className="mb-1.5 block text-sm font-bold text-slate-800">
              {isArabic
                ? `* للتأكيد، اكتب البريد الإلكتروني للمستخدم:`
                : `* To confirm, type the user's email address:`}
              <span className="ms-1 font-black text-slate-900" dir="ltr">{user.email}</span>
            </label>
            <input
              ref={confirmRef}
              id="delete-user-confirmation"
              type="email"
              dir="ltr"
              required
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              className={cn(
                "h-10 w-full rounded-lg border bg-white px-3 font-mono text-sm text-slate-800 outline-none transition",
                confirmText === expectedConfirm && confirmText.length > 0
                  ? "border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  : "border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-100",
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !canSubmit}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isArabic ? "حذف الحساب نهائيًا" : "Delete Account Permanently"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
