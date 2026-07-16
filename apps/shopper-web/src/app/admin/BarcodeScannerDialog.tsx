/**
 * BarcodeScannerDialog.tsx – Premium barcode scanner
 * Clean camera overlay, refined dialogs, and polished scanning states.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  QrCodeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { cn } from "../components/UI";

interface Props {
  open: boolean;
  productId: string;
  onClose: () => void;
  onCapture: (productId: string, barcode: string) => void;
  lang: "ar" | "en";
}

export default function BarcodeScannerDialog({ open, productId, onClose, onCapture, lang }: Props) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const startCamera = useCallback(async () => {
    setError("");
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Real barcode decoding — continuously analyzes video frames until a
      // barcode is found. A per-frame `error` (typically NotFoundException)
      // fires on almost every frame where nothing was detected yet; that is
      // expected scanning noise, not a failure, so it's silently ignored.
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
        if (result) {
          setBarcode(result.getText());
          setScanning(false);
          controlsRef.current?.stop();
        }
      });
      controlsRef.current = controls;
    } catch (e) {
      setError(lang === "ar" ? "لا يمكن الوصول للكاميرا" : "Cannot access camera");
      setScanning(false);
    }
  }, [lang]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    if (open && mode === "camera") {
      void startCamera();
    }
    return () => { stopCamera(); };
  }, [open, mode, startCamera, stopCamera]);

  const handleSave = () => {
    if (!barcode.trim()) return;
    onCapture(productId, barcode.trim());
    setBarcode("");
  };

  const handleClose = () => {
    stopCamera();
    setBarcode("");
    setError("");
    setMode("camera");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c1222]/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#e8eaed] bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8eaed] bg-[#fafbfc] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0fdfa]">
              <QrCodeIcon className="h-5 w-5 text-[#0f766e]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0f766e]">{lang === "ar" ? "مسح الباركود" : "Scan barcode"}</p>
              <h3 className="mt-0.5 text-lg font-extrabold text-[#1a1d21]">{lang === "ar" ? "التقاط الباركود" : "Barcode capture"}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={lang === "ar" ? "إقفال" : "Close"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8eaed] bg-white text-[#5f6368] transition hover:bg-[#f7f8fa]"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 border-b border-[#e8eaed] px-6 py-3">
          <button
            type="button"
            onClick={() => { setMode("camera"); setBarcode(""); setError(""); }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition",
              mode === "camera" ? "bg-[#1a1d21] text-white shadow-sm" : "bg-white text-[#5f6368] border border-[#e8eaed] hover:bg-[#f7f8fa]",
            )}
          >
            <CameraIcon className="h-3.5 w-3.5" />
            {lang === "ar" ? "الكاميرا" : "Camera"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("manual"); stopCamera(); setBarcode(""); setError(""); }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition",
              mode === "manual" ? "bg-[#1a1d21] text-white shadow-sm" : "bg-white text-[#5f6368] border border-[#e8eaed] hover:bg-[#f7f8fa]",
            )}
          >
            <QrCodeIcon className="h-3.5 w-3.5" />
            {lang === "ar" ? "يدوي" : "Manual"}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
            >
              <XMarkIcon className="h-4 w-4" />
              {error}
            </div>
          )}

          {mode === "camera" && (
            <div className="relative overflow-hidden rounded-2xl border border-[#e8eaed] bg-[#0c1222]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-48 w-64">
                  {/* Corner brackets */}
                  <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-[#0d9488]" />
                  <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-[#0d9488]" />
                  <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-[#0d9488]" />
                  <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-[#0d9488]" />
                  {/* Scan line */}
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-[#0d9488]/50 animate-pulse" />
                </div>
              </div>
              {scanning && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-[#1a1d21] shadow-lg">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-[#0d9488]" />
                    {lang === "ar" ? "جارٍ المسح..." : "Scanning..."}
                  </div>
                </div>
              )}
              {barcode && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50/90 px-4 py-2 text-xs font-bold text-emerald-700 shadow-lg">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    {barcode}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "manual" && (
            <div>
              <label className="text-sm font-bold text-[#1a1d21]">{lang === "ar" ? "أدخل الباركود" : "Enter barcode"}</label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder={lang === "ar" ? "مثال: 6224000000000" : "e.g., 6224000000000"}
                dir="ltr"
                className="mt-2 h-11 w-full rounded-xl border border-[#e8eaed] bg-[#f7f8fa] px-4 text-sm font-semibold text-[#1a1d21] outline-none transition focus:border-[#0d9488] focus:bg-white focus:ring-2 focus:ring-[#0d9488]/10 placeholder:text-[#9aa0a6]"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!barcode.trim()}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1d21] px-5 text-sm font-bold text-white shadow-md transition hover:bg-[#2d3139] disabled:opacity-40 active:scale-95"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {lang === "ar" ? "حفظ الباركود" : "Save barcode"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e8eaed] bg-white px-5 text-sm font-bold text-[#5f6368] transition hover:bg-[#f7f8fa]"
            >
              <XMarkIcon className="h-4 w-4" />
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}