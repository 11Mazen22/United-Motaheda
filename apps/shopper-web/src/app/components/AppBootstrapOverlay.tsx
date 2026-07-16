import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { images } from "../data";
import styles from "./AppBootstrapOverlay.module.css";

const COPY = {
  en: {
    eyebrow: "Care, connected",
    title: "Your pharmacy, ready when you are",
    subtitle: "Preparing a secure, seamless experience tailored to your care.",
    stages: ["Securing your session", "Preparing pharmacy services", "Finalising your workspace"],
    connection: "Connection needs attention",
    retry: "Try again",
    footer: "United Pharmacies · Digital care",
  },
  ar: {
    eyebrow: "رعاية متصلة",
    title: "صيدليتك جاهزة عندما تكون مستعداً",
    subtitle: "نُجهّز تجربة آمنة وسلسة صُممت لتناسب احتياجاتك الصحية.",
    stages: ["تأمين جلستك", "تجهيز خدمات الصيدلية", "إنهاء إعداد مساحتك"],
    connection: "تحتاج إلى التحقق من الاتصال",
    retry: "إعادة المحاولة",
    footer: "صيدليات المتحدة · رعاية رقمية",
  },
} as const;

export default function AppBootstrapOverlay({
  active,
  title,
  subtitle,
  error,
  onRetry,
  minVisibleMs = 600,
  showDelayMs = 120,
}: {
  active: boolean;
  title?: string;
  subtitle?: string;
  error?: string | null;
  onRetry?: (() => void) | undefined;
  minVisibleMs?: number;
  showDelayMs?: number;
}) {
  const { lang } = useLanguage();
  const copy = COPY[lang];
  const [visible, setVisible] = useState(false);
  const [canRender, setCanRender] = useState(false);
  const [stage, setStage] = useState(0);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const stageCount = copy.stages.length;

  useEffect(() => {
    if (active) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (visible || showTimerRef.current) return;

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        shownAtRef.current = Date.now();
        setStage(0);
        setCanRender(true);
        setVisible(true);
      }, showDelayMs);
      return;
    }

    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visible) {
      setCanRender(false);
      return;
    }

    const elapsed = Date.now() - (shownAtRef.current ?? Date.now());
    const remaining = Math.max(0, minVisibleMs - elapsed);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setVisible(false);
    }, remaining);
  }, [active, minVisibleMs, showDelayMs, visible]);

  useEffect(() => {
    if (!visible || error || reduceMotion) return;
    const timer = window.setInterval(() => setStage((current) => (current + 1) % stageCount), 1_500);
    return () => window.clearInterval(timer);
  }, [error, reduceMotion, stageCount, visible]);

  useEffect(() => {
    if (!visible) {
      const timer = window.setTimeout(() => setCanRender(false), reduceMotion ? 0 : 280);
      return () => window.clearTimeout(timer);
    }
  }, [reduceMotion, visible]);

  useEffect(() => () => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  }, []);

  const progress = error ? 1 : (stage + 1) / stageCount;
  const currentStage = error ? copy.connection : copy.stages[stage];
  const accessibleLabel = useMemo(() => `${copy.title}. ${currentStage}`, [copy.title, currentStage]);

  if (!canRender) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="united-pharmacies-bootstrap"
          className={`fixed inset-0 z-[100] overflow-hidden ${styles.overlay}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={accessibleLabel}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <span className={styles.lightBeam} />
          <span className={styles.grain} />
          <div className={styles.shell}>
            <main className={styles.main}>
              <motion.section
                className={styles.panel}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={styles.brandStage} aria-hidden="true">
                  <span className={styles.orbit} />
                  <span className={`${styles.orbit} ${styles.orbitOuter}`} />
                  <span className={styles.brandAura} />
                  <span className={styles.logoTile}><img src={images.logoMark} alt="" /></span>
                </div>

                <p className={styles.eyebrow}>{copy.eyebrow}</p>
                <h1 className={styles.title}>{title ?? copy.title}</h1>
                <p className={styles.subtitle}>{subtitle ?? copy.subtitle}</p>

                {error ? (
                  <div className={styles.error} role="alert">
                    <p>{error}</p>
                    {onRetry && <button type="button" className={styles.retry} onClick={onRetry}>{copy.retry}</button>}
                  </div>
                ) : (
                  <div className={styles.progressArea}>
                    <div className={styles.stageRow}>
                      <span>{currentStage}</span>
                      <strong>{Math.round(progress * 100)}%</strong>
                    </div>
                    <div className={styles.progressTrack} aria-hidden="true">
                      <motion.span
                        className={styles.progressFill}
                        animate={{ scaleX: progress }}
                        transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
                      />
                      <span className={styles.progressSheen} />
                    </div>
                    <div className={styles.stageDots} aria-hidden="true">
                      {copy.stages.map((item, index) => (
                        <span key={item} className={`${styles.stageDot} ${index === stage ? styles.stageDotActive : ""}`} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            </main>

            <footer className={styles.footer}>{copy.footer}</footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
