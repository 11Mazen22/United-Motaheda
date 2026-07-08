import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../components/UI";

const GOOGLE_RED = "#EA4335";

/** Google's official "G" mark — kept as inline SVG so it renders identically
 *  everywhere (no icon-font glyph is an accurate multi-color "G"). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

interface GoogleButtonProps {
  label: string;
  className?: string;
}

/** "Continue with Google" — shared by LoginForm and RegisterForm so both
 *  sign-in surfaces stay pixel-identical and behave the same on failure. */
export function GoogleButton({ label, className }: GoogleButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Navigates the browser away on success — setLoading(false) below only
      // ever actually runs on the error path (or if the user is fast enough
      // to see this before the redirect fires).
      await loginWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start Google sign-in.";
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className={cn(
        "inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[15px] font-bold text-slate-800 shadow-sm transition-all",
        "hover:bg-slate-50 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:border-teal-300",
        "active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white disabled:hover:shadow-sm",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" style={{ color: GOOGLE_RED }} />
      ) : (
        <GoogleMark />
      )}
      {label}
    </button>
  );
}

/** "or" divider between the Google button and the email/password form. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
