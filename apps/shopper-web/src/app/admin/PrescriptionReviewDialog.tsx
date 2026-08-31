import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, ShieldAlert, X, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../components/UI";
import { toast } from "sonner";

export interface ReviewDialogDetailRow {
  label: string;
  value: string;
}

export interface ReviewDialogTarget {
  title: string;
  subtitle: string;
  detailRows: ReviewDialogDetailRow[];
  /** Extra warning shown for controlled substances / WhatsApp-source rows. */
  warning?: string;
  /** Full URL to the prescription image bucket */
  imageUrl?: string | null;
}

interface PrescriptionReviewDialogProps {
  open: boolean;
  onClose: () => void;
  target: ReviewDialogTarget | null;
  onApprove: (adminNotes?: string) => Promise<void>;
  onReject: (rejectionReason: string, adminNotes?: string) => Promise<void>;
  lang: "ar" | "en";
}

export default function PrescriptionReviewDialog({
  open,
  onClose,
  target,
  onApprove,
  onReject,
  lang,
}: PrescriptionReviewDialogProps) {
  const isArabic = lang === "ar";
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionReasonError, setRejectionReasonError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("idle");
      setAdminNotes("");
      setRejectionReason("");
      setRejectionReasonError("");
    }
  }, [open]);

  if (!target) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(adminNotes.trim() || undefined);
      toast.success(isArabic ? "تمت الموافقة بنجاح" : "Approved successfully");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectionReasonError(isArabic ? "يرجى كتابة سبب الرفض" : "Please provide a rejection reason");
      toast.error(isArabic ? "يرجى كتابة سبب الرفض" : "Please provide a rejection reason");
      return;
    }
    setRejectionReasonError("");
    setLoading(true);
    try {
      await onReject(rejectionReason.trim(), adminNotes.trim() || undefined);
      toast.success(isArabic ? "تم الرفض" : "Rejected");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100">
              <FileText className="h-5 w-5 text-teal-700" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg font-black text-slate-900">
                {target.title}
              </DialogTitle>
              <DialogDescription className="mt-0.5 truncate text-sm text-slate-500">
                {target.subtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {target.warning && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">{target.warning}</p>
            </div>
          )}

          {/* Prescription Image */}
          {target.imageUrl && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex justify-center">
              <img 
                src={target.imageUrl} 
                alt="Prescription" 
                className="max-h-[400px] object-contain w-full"
              />
            </div>
          )}

          {/* Detail rows */}
          <div className="grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            {target.detailRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-500">{row.label}</span>
                <span className="truncate font-bold text-slate-800" dir="auto">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Admin notes — always available */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-800">
              {isArabic ? "ملاحظات داخلية (اختياري)" : "Internal Notes (optional)"}
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder={isArabic ? "ملاحظات للفريق فقط…" : "Notes for the team only…"}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Rejection reason — only when rejecting */}
          {mode === "rejecting" && (
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-800">
                {isArabic ? "* سبب الرفض (يظهر للعميل)" : "* Rejection Reason (shown to customer)"}
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionReasonError && e.target.value.trim()) setRejectionReasonError("");
                }}
                rows={2}
                placeholder={isArabic ? "مثال: رقم الوصفة غير صحيح…" : "e.g., The Rx number couldn't be verified…"}
                aria-invalid={!!rejectionReasonError}
                className={cn(
                  "w-full resize-none rounded-xl border bg-white p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2",
                  rejectionReasonError
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                    : "border-rose-200 focus:border-rose-400 focus:ring-rose-100",
                )}
                autoFocus
              />
              {rejectionReasonError && (
                <p className="mt-1.5 text-xs font-semibold text-rose-600">{rejectionReasonError}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={mode === "rejecting" ? () => setMode("idle") : onClose}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-55"
            >
              <X className="h-4 w-4" />
              {mode === "rejecting" ? (isArabic ? "رجوع" : "Back") : (isArabic ? "إغلاق" : "Close")}
            </button>

            {mode === "idle" && (
              <button
                type="button"
                onClick={() => setMode("rejecting")}
                disabled={loading}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-55",
                )}
              >
                <XCircle className="h-4 w-4" />
                {isArabic ? "رفض" : "Reject"}
              </button>
            )}

            <button
              type="button"
              onClick={mode === "rejecting" ? handleReject : handleApprove}
              disabled={loading}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition disabled:opacity-55",
                mode === "rejecting" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700",
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "rejecting" ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {mode === "rejecting" ? (isArabic ? "تأكيد الرفض" : "Confirm Rejection") : (isArabic ? "موافقة" : "Approve")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
