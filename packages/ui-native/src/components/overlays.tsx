import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal as RNModal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideInUp, SlideOutDown, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Text } from "./primitives";
import { useTheme } from "../theme";

export type ToastType = "success" | "error" | "info" | "warning";
export type ToastPosition = "top" | "bottom";
export interface ToastItem { id: number; message: string; type: ToastType; position: ToastPosition; duration: number; }
interface ToastApi { enqueue: (message: string, type?: ToastType, options?: Partial<Pick<ToastItem, "position" | "duration">>) => void; }
let nextToastId = 1;
let imperativeEnqueue: ToastApi["enqueue"] | undefined;
const ToastContext = createContext<ToastApi>({ enqueue: () => undefined });

/** Imperative toast API retained for stores, API clients, and non-component code. */
export function showToast(message: string, type: ToastType = "info", options?: Partial<Pick<ToastItem, "position" | "duration">>): void {
  imperativeEnqueue?.(message, type, options);
}

export interface ToastProviderProps { children: React.ReactNode; }
/** Owns the global FIFO toast queue. Mount once near the app root. */
export function ToastProvider({ children }: ToastProviderProps): React.ReactElement {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const enqueue = useCallback<ToastApi["enqueue"]>((message, type = "info", options) => setQueue((items) => [...items, { id: nextToastId++, message, type, position: options?.position ?? "top", duration: options?.duration ?? 3000 }]), []);
  useEffect(() => { imperativeEnqueue = enqueue; return () => { if (imperativeEnqueue === enqueue) imperativeEnqueue = undefined; }; }, [enqueue]);
  const current = queue[0];
  useEffect(() => { if (!current) return; const timer = setTimeout(() => setQueue((items) => items.slice(1)), current.duration); return () => clearTimeout(timer); }, [current]);
  return <ToastContext.Provider value={useMemo(() => ({ enqueue }), [enqueue])}>{children}<Toast item={current} onDismiss={() => setQueue((items) => items.slice(1))} /></ToastContext.Provider>;
}
export function useToast(): ToastApi { return useContext(ToastContext); }
/** Compatibility store-like facade for existing imperative integrations. */
export const useToastStore = Object.assign(() => ({ visible: false, message: "", type: "info" as ToastType, show: showToast, hide: () => undefined }), { getState: () => ({ visible: false, message: "", type: "info" as ToastType, show: showToast, hide: () => undefined }) });

export interface ToastProps { item?: ToastItem; onDismiss?: () => void; }
/** Animated accessible toast host. With no props it hosts imperative `showToast` calls. */
export function Toast(props: ToastProps): React.ReactElement {
  const [standalone, setStandalone] = useState<ToastItem>();
  const enqueue = useCallback<ToastApi["enqueue"]>((message, type = "info", options) => setStandalone({ id: nextToastId++, message, type, position: options?.position ?? "top", duration: options?.duration ?? 3000 }), []);
  useEffect(() => { if (!props.item) { imperativeEnqueue = enqueue; return () => { if (imperativeEnqueue === enqueue) imperativeEnqueue = undefined; }; } }, [enqueue, props.item]);
  const item = props.item ?? standalone;
  useEffect(() => { if (!props.item && standalone) { const timer = setTimeout(() => setStandalone(undefined), standalone.duration); return () => clearTimeout(timer); } }, [props.item, standalone]);
  const insets = useSafeAreaInsets(); const { theme, isRTL } = useTheme();
  if (!item) return <></>;
  const color = item.type === "success" ? theme.colors.status.success : item.type === "error" ? theme.colors.status.error : item.type === "warning" ? theme.colors.status.warning : theme.colors.status.info;
  const dismiss = props.onDismiss ?? (() => setStandalone(undefined));
  return <Animated.View entering={item.position === "top" ? SlideInUp : SlideInDown} exiting={item.position === "top" ? SlideOutUp : SlideOutDown} accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.toast, theme.shadows[4], item.position === "top" ? { top: insets.top + 8 } : { bottom: insets.bottom + 8 }, { backgroundColor: theme.colors.canvas.surfaceElevated, borderStartColor: color, flexDirection: isRTL ? "row-reverse" : "row" }]}><Pressable onPress={dismiss} style={styles.toastInner}><Text>{item.message}</Text></Pressable></Animated.View>;
}

export interface ModalProps { visible: boolean; onDismiss: () => void; children: React.ReactNode; position?: "center" | "bottom"; dismissOnBackdrop?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string; }
/** Accessible center/bottom modal with a fading backdrop. */
export function Modal({ visible, onDismiss, children, position = "center", dismissOnBackdrop = true, style, accessibilityLabel }: ModalProps): React.ReactElement {
  const { theme } = useTheme();
  return <RNModal visible={visible} transparent animationType="none" onRequestClose={onDismiss}><View style={[styles.modalRoot, position === "bottom" && styles.modalBottom]} accessibilityViewIsModal accessibilityLabel={accessibilityLabel}><Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.canvas.overlay }]}><Pressable disabled={!dismissOnBackdrop} onPress={onDismiss} style={StyleSheet.absoluteFill} /></Animated.View><Animated.View entering={position === "bottom" ? SlideInDown : FadeIn} exiting={position === "bottom" ? SlideOutDown : FadeOut} style={[styles.modalPanel, theme.shadows[4], { backgroundColor: theme.colors.canvas.surfaceElevated }, position === "bottom" && styles.bottomPanel, style]}>{children}</Animated.View></View></RNModal>;
}

export interface BottomSheetProps { visible?: boolean; onDismiss: () => void; children: React.ReactNode; snapPoints: ReadonlyArray<number | `${number}%`>; initialSnapIndex?: number; backdrop?: boolean; style?: StyleProp<ViewStyle>; }
/** Gesture-driven bottom sheet with configurable snap points. */
export function BottomSheet({ visible = true, onDismiss, children, snapPoints, initialSnapIndex = 0, backdrop = true, style }: BottomSheetProps): React.ReactElement {
  const currentIndex = useRef(Math.max(0, Math.min(initialSnapIndex, snapPoints.length - 1)));
  const pan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8, onPanResponderRelease: (_, gesture) => { if (gesture.dy > 90) { if (currentIndex.current >= snapPoints.length - 1) onDismiss(); else currentIndex.current += 1; } else if (gesture.dy < -90) currentIndex.current = Math.max(0, currentIndex.current - 1); } }), [onDismiss, snapPoints.length]);
  return <Modal visible={visible} onDismiss={onDismiss} position="bottom" dismissOnBackdrop={backdrop} style={[styles.sheet, style]}><View {...pan.panHandlers} style={styles.handleArea} accessibilityLabel="Drag sheet"><View style={styles.handle} /></View>{children}</Modal>;
}

export interface DialogProps { visible: boolean; title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void | Promise<void>; onCancel: () => void; dismissOnBackdrop?: boolean; }
/** Blocking confirmation dialog with async confirm loading. */
export function Dialog({ visible, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, onConfirm, onCancel, dismissOnBackdrop = false }: DialogProps): React.ReactElement { const [loading, setLoading] = useState(false); const confirm = async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); } }; return <Modal visible={visible} onDismiss={onCancel} dismissOnBackdrop={dismissOnBackdrop} accessibilityLabel={title}><View style={{ gap: 12 }}><Text variant="h3">{title}</Text>{message ? <Text color="secondary">{message}</Text> : null}<View style={styles.dialogActions}><Button title={cancelLabel} variant="ghost" onPress={onCancel} /><Button title={confirmLabel} variant={destructive ? "danger" : "primary"} loading={loading} onPress={confirm} /></View></View></Modal>; }

const styles = StyleSheet.create({
  toast: { position: "absolute", start: 16, end: 16, zIndex: 9999, minHeight: 48, borderStartWidth: 4, borderRadius: 12, alignItems: "center" }, toastInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center" },
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }, modalBottom: { justifyContent: "flex-end", padding: 0 }, modalPanel: { width: "100%", maxWidth: 520, padding: 20, borderRadius: 16 }, bottomPanel: { maxWidth: undefined, borderBottomStartRadius: 0, borderBottomEndRadius: 0, borderTopStartRadius: 24, borderTopEndRadius: 24, paddingBottom: 32 },
  sheet: { minHeight: 150 }, handleArea: { minHeight: 48, alignItems: "center", justifyContent: "center" }, handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#94A3B8" }, dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
});
