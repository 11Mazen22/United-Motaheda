/**
 * BranchMapCard — production-grade branch card with embedded Google Maps.
 *
 * Performance strategy:
 *   • WebView is NOT mounted until the card has been visible on screen
 *     (controlled by `visible` prop from the parent list).
 *   • While hidden a lightweight skeleton placeholder occupies the same
 *     height so scroll position never jumps.
 *   • Each card is React.memo — re-renders only when `visible` flips or
 *     branch identity changes.
 *   • WebView is given `androidLayerType="hardware"` for GPU compositing.
 *   • `startInLoadingState` + custom spinner avoids the blank-flash.
 *   • Error state offers a retry tap without unmounting the whole card.
 *
 * BranchMapList — virtualises visibility: only the card whose top edge
 * has entered the ScrollView viewport (+ a 300 px look-ahead) gets
 * `visible=true`. All others stay as skeletons until scrolled to.
 * Once revealed, `visible` stays true (no unloading on scroll-away).
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import WebView from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Text as UIText } from "@pharmacy/ui-native";
import { kit }            from "@pharmacy/ui-native";
import { theme }          from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { BRANCHES, buildBranchMapEmbedUrl } from "@/features/delivery/branches/data";
import type { Branch } from "@/features/delivery/branches/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

/** Height of the embedded map iframe inside each card */
const MAP_HEIGHT = 220;
/** How many px below the fold to pre-load cards (look-ahead) */
const PRELOAD_OFFSET = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openDirections(lat: number, lng: number): void {
  const url =
    Platform.OS === "ios"
      ? `maps://?q=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}`;
  Linking.canOpenURL(url)
    .then((can) =>
      Linking.openURL(
        can ? url : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      ),
    )
    .catch(() =>
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      ),
    );
}

function haptic() {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
}

// ─── Map skeleton (shown before WebView mounts) ───────────────────────────────

const MapSkeleton = memo(function MapSkeleton() {
  return (
    <View style={sk.root}>
      <View style={sk.pulse} />
      <View style={sk.iconWrap}>
        <Ionicons name="map-outline" size={28} color={kit.color.inkFaint} />
        <UIText style={sk.hint}>جارٍ تحميل الخريطة…</UIText>
      </View>
    </View>
  );
});

const sk = StyleSheet.create({
  root: {
    height:          MAP_HEIGHT,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: kit.color.line,
    opacity:         0.35,
  },
  iconWrap: { alignItems: "center", gap: 8 },
  hint: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
});

// ─── Map embed (WebView) ──────────────────────────────────────────────────────

interface MapEmbedProps {
  lat:  number;
  lng:  number;
  zoom: number;
}

const MapEmbed = memo(function MapEmbed({ lat, lng, zoom }: MapEmbedProps) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const retryKey = useRef(0);
  const [, forceRetry] = useState(0);

  const handleRetry = useCallback(() => {
    retryKey.current += 1;
    setLoadState("loading");
    forceRetry((n) => n + 1);
    haptic();
  }, []);

  const src = buildBranchMapEmbedUrl(lat, lng, zoom);

  return (
    <View style={me.root}>
      {/* Spinner overlay while loading */}
      {loadState === "loading" && (
        <View style={me.overlay} pointerEvents="none">
          <View style={me.spinnerRing} />
          <UIText style={me.spinnerText}>جارٍ التحميل…</UIText>
        </View>
      )}

      {/* Error state */}
      {loadState === "error" && (
        <Pressable
          onPress={handleRetry}
          style={me.errorBox}
          accessibilityRole="button"
          accessibilityLabel="إعادة تحميل الخريطة"
        >
          <Ionicons name="cloud-offline-outline" size={26} color={kit.color.inkFaint} />
          <UIText style={me.errorText}>تعذّر تحميل الخريطة</UIText>
          <View style={me.retryBtn}>
            <Ionicons name="refresh-outline" size={13} color={kit.color.accentDeep} />
            <UIText style={me.retryText}>إعادة المحاولة</UIText>
          </View>
        </Pressable>
      )}

      {/* The actual WebView — always mounted so it can load quietly */}
      <WebView
        key={retryKey.current}
        source={{ uri: src }}
        style={[me.webview, loadState === "error" && me.webviewHidden]}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        startInLoadingState={false}   // we handle our own spinner
        javaScriptEnabled             // maps embed requires JS to render
        domStorageEnabled={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback={false}
        androidLayerType="hardware"   // GPU layer for smooth compositing
        onLoadEnd={() => setLoadState("ready")}
        onError={() => setLoadState("error")}
        onHttpError={() => setLoadState("error")}
        accessibilityLabel="خريطة الفرع"
      />
    </View>
  );
});

const me = StyleSheet.create({
  root:         { height: MAP_HEIGHT, overflow: "hidden" },
  webview:      { flex: 1, backgroundColor: kit.color.well },
  webviewHidden: { opacity: 0, position: "absolute" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          10,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
    gap:             10,
  },
  spinnerRing: {
    width:       36,
    height:      36,
    borderRadius: 18,
    borderWidth:  2.5,
    borderColor:  kit.color.line,
    borderTopColor: kit.color.accent,
  },
  spinnerText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  errorBox: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          10,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
    gap:             8,
  },
  errorText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  retryBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    marginTop:         4,
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  retryText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
});

// ─── Branch capability pill ───────────────────────────────────────────────────

interface CapPillProps {
  icon:  React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}

const CapPill = memo(function CapPill({ icon, label }: CapPillProps) {
  return (
    <View style={[cp.root, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name={icon} size={11} color={kit.color.accentDeep} />
      <UIText style={cp.label}>{label}</UIText>
    </View>
  );
});

const cp = StyleSheet.create({
  root: {
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  label: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
});

// ─── Main card ────────────────────────────────────────────────────────────────

export interface BranchMapCardProps {
  branch:  Branch;
  /** Controls whether the WebView is mounted — set by the parent list */
  visible: boolean;
}

export const BranchMapCard = memo(function BranchMapCard({
  branch,
  visible,
}: BranchMapCardProps) {
  const handleDirections = useCallback(() => {
    haptic();
    openDirections(branch.lat, branch.lng);
  }, [branch.lat, branch.lng]);

  const handlePhone = useCallback(() => {
    haptic();
    Linking.openURL(`tel:${branch.phones[0]}`).catch(() => {});
  }, [branch.phones]);

  return (
    <View style={card.root}>
      {/* ── Header ── */}
      <View style={[card.header, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[card.iconBadge, branch.isPrimary && card.iconBadgePrimary]}>
          <Ionicons
            name={branch.isPrimary ? "star" : "medkit-outline"}
            size={15}
            color={branch.isPrimary ? "#F59E0B" : kit.color.accentDeep}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <UIText style={[card.name, { textAlign: TEXT_START }]} numberOfLines={1}>
            {IS_RTL ? branch.nameAr : branch.nameEn}
          </UIText>
          <UIText style={[card.area, { textAlign: TEXT_START }]} numberOfLines={1}>
            {IS_RTL ? branch.area : branch.area}
          </UIText>
        </View>

        {/* Phone tap */}
        {branch.phones[0] && (
          <Pressable
            onPress={handlePhone}
            hitSlop={8}
            style={({ pressed }) => [card.phoneBtn, pressed && card.phoneBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={`اتصل بـ ${IS_RTL ? branch.nameAr : branch.nameEn}`}
          >
            <Ionicons name="call-outline" size={15} color={kit.color.accentDeep} />
          </Pressable>
        )}
      </View>

      {/* ── Map ── */}
      <View style={card.mapWrap}>
        {visible ? (
          <MapEmbed lat={branch.lat} lng={branch.lng} zoom={branch.mapZoom} />
        ) : (
          <MapSkeleton />
        )}
      </View>

      {/* ── Footer ── */}
      <View style={card.footer}>
        {/* Address */}
        <View style={[card.addressRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="location-outline" size={13} color={kit.color.inkFaint} />
          <UIText style={[card.address, { textAlign: TEXT_START }]} numberOfLines={2}>
            {IS_RTL ? branch.addressAr : branch.addressEn}
          </UIText>
        </View>

        {/* Hours */}
        <View style={[card.addressRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="time-outline" size={13} color={kit.color.inkFaint} />
          <UIText style={[card.address, { textAlign: TEXT_START }]} numberOfLines={1}>
            {IS_RTL ? branch.hoursAr : branch.hoursEn}
          </UIText>
        </View>

        {/* Capability pills */}
        <View style={[card.pills, IS_RTL ? card.pillsRtl : card.pillsLtr]}>
          {branch.pickupEnabled        && <CapPill icon="walk-outline"         label="استلام" />}
          {branch.acceptsPrescriptions && <CapPill icon="document-text-outline" label="وصفات"  />}
          {branch.is24h                && <CapPill icon="time-outline"          label="٢٤ ساعة"/>}
          {branch.deliveryEnabled      && <CapPill icon="bicycle-outline"       label="توصيل"  />}
        </View>

        {/* Directions CTA */}
        <Pressable
          onPress={handleDirections}
          style={({ pressed }) => [
            card.directionsBtn,
            { flexDirection: flexRow(IS_RTL) },
            pressed && card.directionsBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`الاتجاهات إلى ${IS_RTL ? branch.nameAr : branch.nameEn}`}
        >
          <Ionicons name="navigate-outline" size={15} color="#fff" />
          <UIText style={card.directionsTxt}>
            {IS_RTL ? "الحصول على الاتجاهات" : "Get Directions"}
          </UIText>
        </Pressable>
      </View>
    </View>
  );
});

const card = StyleSheet.create({
  root: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    marginBottom:    16,
  },

  // Header
  header: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  iconBadge: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  iconBadgePrimary: {
    backgroundColor: "#FEF3C7",
    borderColor:     "#FDE68A",
  },
  name: {
    fontFamily:         theme.fonts.extrabold,
    fontSize:           14,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    includeFontPadding: false,
  },
  area: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  phoneBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  phoneBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },

  // Map
  mapWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    overflow:          "hidden",
  },

  // Footer
  footer:     { padding: 14, gap: 10 },
  addressRow: { alignItems: "flex-start", gap: 7 },
  address: {
    flex:               1,
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    color:              kit.color.inkSoft,
    lineHeight:         18,
    includeFontPadding: false,
  },

  pills:    { flexWrap: "wrap", gap: 6 },
  pillsLtr: { flexDirection: "row" },
  pillsRtl: { flexDirection: "row-reverse" },

  directionsBtn: {
    alignItems:      "center",
    justifyContent:  "center",
    gap:             7,
    backgroundColor: kit.color.accent,
    borderRadius:    kit.radius.lg,
    paddingVertical: 12,
    marginTop:       2,
    ...kit.shadow.brandGlow,
  },
  directionsBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  directionsTxt: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    color:              "#fff",
    includeFontPadding: false,
  },
});

// ─── List with lazy visibility ────────────────────────────────────────────────

interface CardMeta {
  id:      string;
  yTop:    number;   // card's top offset inside the ScrollView
  visible: boolean;
}

/**
 * BranchMapList — renders all branch cards with lazy WebView mounting.
 *
 * Two rendering modes:
 *   • standalone (default): wraps cards in its own ScrollView. Use when this
 *     is the only scrollable content on screen.
 *   • flat (`flat` prop): renders bare Views with no wrapper ScrollView.
 *     Use when embedded inside an existing ScrollView (e.g. About screen).
 *     Visibility is triggered by the parent via the `scrollY` + `viewHeight`
 *     props, OR cards self-reveal via their own onLayout after a short delay.
 */
export interface BranchMapListProps2 {
  branches?: readonly Branch[];
  /** Render without a wrapping ScrollView (for embedding inside one). */
  flat?: boolean;
}

export const BranchMapList = memo(function BranchMapList({
  branches = BRANCHES,
  flat = false,
}: BranchMapListProps2) {
  // Track each card's y-position and whether it's been revealed
  const metaRef = useRef<Map<string, CardMeta>>(
    new Map(branches.map((b) => [b.id, { id: b.id, yTop: 0, visible: false }])),
  );
  const [, setVisibilityVersion] = useState(0);
  const scrollYRef    = useRef(0);
  const viewHeightRef = useRef(0);

  /** Reveal any card whose top is within the current viewport + look-ahead */
  const revealVisible = useCallback(() => {
    const scrollY    = scrollYRef.current;
    const viewHeight = viewHeightRef.current || 9999; // in flat mode reveal all
    const threshold  = scrollY + viewHeight + PRELOAD_OFFSET;
    let changed = false;
    metaRef.current.forEach((meta) => {
      if (!meta.visible && meta.yTop <= threshold) {
        meta.visible = true;
        changed = true;
      }
    });
    if (changed) setVisibilityVersion((v) => v + 1);
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y;
      revealVisible();
    },
    [revealVisible],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewHeightRef.current = e.nativeEvent.layout.height;
      revealVisible();
    },
    [revealVisible],
  );

  // In flat mode, reveal cards progressively via staggered timeouts so the
  // first card loads immediately and each subsequent one follows after a short
  // delay — a clean performance-conscious substitute for scroll detection.
  const [flatVisible, setFlatVisible] = useState<Set<string>>(() => {
    if (!flat) return new Set();
    // First card visible immediately
    const s = new Set<string>();
    if (branches.length > 0) s.add(branches[0].id);
    return s;
  });

  useEffect(() => {
    if (!flat || branches.length <= 1) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    branches.forEach((b, i) => {
      if (i === 0) return; // already visible
      const t = setTimeout(() => {
        setFlatVisible((prev) => {
          const next = new Set(prev);
          next.add(b.id);
          return next;
        });
      }, i * 600); // stagger 600 ms per card — maps are heavy
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, branches.length]);

  if (flat) {
    return (
      <>
        {branches.map((branch) => (
          <BranchMapCard
            key={branch.id}
            branch={branch}
            visible={flatVisible.has(branch.id)}
          />
        ))}
      </>
    );
  }

  return (
    <ScrollView
      onScroll={handleScroll}
      onLayout={handleLayout}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={false}
    >
      {branches.map((branch) => {
        const meta = metaRef.current.get(branch.id)!;
        return (
          <View
            key={branch.id}
            onLayout={(e) => {
              meta.yTop = e.nativeEvent.layout.y;
              revealVisible();
            }}
          >
            <BranchMapCard
              branch={branch}
              visible={meta.visible}
            />
          </View>
        );
      })}
    </ScrollView>
  );
});
