import React, { useState, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View, TextInput, KeyboardAvoidingView } from "react-native";
import { Text as UIText, Button, PressableScale } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion } from "react-native-reanimated";
import { AddressMapPlaceholder } from "./AddressMapPlaceholder";
import { ADDRESS_LABELS } from "../types";
import type { AddressFormData, AddressLabel } from "../types";
import { useTheme, sheetMotion, type NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { showErrorSheet } from "@/shared/store/appSheetStore";
import { reverseGeocode } from "@/lib/geocoding";
import { fetchPlacesSuggestions, type PlacesSuggestion } from "@/lib/placesApi";

interface AddressFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  initialData?: AddressFormData;
  onSubmit: (form: AddressFormData) => void;
  loading?: boolean;
  /** Passed down from the host screen's own useSafeAreaInsets() — reading
   *  the hook directly inside this component was returning bogus/inflated
   *  values, since a bare RN <Modal> renders in its own native root outside
   *  the app's SafeAreaProvider tree, and that showed up as a large blank
   *  gap at the bottom of the drawer instead of a normal safe-area inset. */
  insetsBottom?: number;
}

export function AddressFormDrawer({
  visible,
  onClose,
  initialData,
  onSubmit,
  loading = false,
  insetsBottom = 0,
}: AddressFormDrawerProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const IS_RTL = isRtl();

  const [form, setForm] = useState<AddressFormData>(
    initialData || { label: "home", recipient_name: "", phone: "", city: "", district: "", street: "", building: "", floor: "", apartment: "", landmark: "", delivery_instructions: "", location_source: "manual", is_default: false }
  );

  const [isDetecting, setIsDetecting] = useState(false);
  const [smartZoneActive, setSmartZoneActive] = useState(false);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  // Marks the field editable-state dirty relative to the last GPS fix, so a
  // customer who detects their location and then corrects the street name
  // gets location_source="gps_corrected" — distinct from a pure GPS read or
  // a fully manual entry. See spec: coordinates and the written address are
  // different data with different trust levels; this is what lets the
  // backend/driver tell them apart later.
  const editAfterDetect = (patch: Partial<AddressFormData>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (prev.location_source === "gps") next.location_source = "gps_corrected";
      return next;
    });
  };

  // Smart address search — Geoapify autocomplete-as-you-type, replacing
  // manual free-text city/district/street entry with "search once, get
  // everything filled" (address, district, city, lat/lng all resolved
  // together, so the map and the fields can never disagree with each other).
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const id = setTimeout(() => {
      fetchPlacesSuggestions(q, { signal: controller.signal })
        .then((results) => {
          if (controller.signal.aborted) return;
          setSuggestions(results);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 350);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const handleSelectSuggestion = (s: PlacesSuggestion) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setForm((prev) => ({
      ...prev,
      city: s.city ?? prev.city,
      district: s.district ?? prev.district,
      street: s.street ?? s.formatted,
      building: s.houseNumber ?? prev.building,
      lat: s.lat,
      lng: s.lng,
      location_source: "manual",
      location_accuracy_m: undefined,
    }));
    setSearchQuery(s.formatted);
    setShowSuggestions(false);
    setSmartZoneActive(true);
  };

  const pulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (isDetecting && !reducedMotion) {
      pulse.value = withRepeat(withTiming(1.3, { duration: 800 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [isDetecting, reducedMotion, pulse]);

  const animatedPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 1) * 2,
  }));

  const handleDetectLocation = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDetecting(true);
    setSmartZoneActive(false);
    
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showErrorSheet(
          t("addresses.locationServicesOffTitle", "Location services are off"),
          t("addresses.locationServicesOffBody", "Turn on location services for this device, then try again."),
        );
        setIsDetecting(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showErrorSheet(
          t("addresses.locationDeniedTitle", "Location access denied"),
          t("addresses.locationDeniedBody", "You can still enter your address manually below, or allow location access in your device settings to detect it automatically."),
        );
        setIsDetecting(false);
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setAccuracyM(loc.coords.accuracy ?? null);

      let resolvedCity = form.city;
      let resolvedDistrict = form.district;
      let resolvedStreet = form.street;
      let resolvedFormatted = "";

      // Geoapify first — it's the same index the search box and the map use,
      // so a GPS-detected address reads consistently with a typed/selected
      // one (same district naming, same Arabic transliteration). Falls back
      // to the OS's on-device geocoder (works offline, no API key) only if
      // Geoapify can't be reached.
      const geo = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      if (geo) {
        resolvedCity = geo.city || resolvedCity;
        resolvedDistrict = geo.district || resolvedDistrict;
        resolvedStreet = geo.street || resolvedStreet;
        resolvedFormatted = geo.formatted;
      } else {
        try {
          const [place] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (place) {
            resolvedCity = place.city || place.region || resolvedCity;
            resolvedDistrict = place.district || place.subregion || resolvedDistrict;
            resolvedStreet = [place.street, place.name].filter(Boolean).join(" ") || resolvedStreet;
            resolvedFormatted = [resolvedStreet, resolvedDistrict, resolvedCity].filter(Boolean).join("، ");
          }
        } catch {
          // Both failed (offline, no result) — keep the real GPS coords but
          // leave the text fields for the user to fill in, rather than
          // writing fake placeholder text over their input.
        }
      }

      setForm(prev => ({
        ...prev,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        location_source: "gps",
        location_accuracy_m: loc.coords.accuracy ?? undefined,
        city: resolvedCity,
        district: resolvedDistrict,
        street: resolvedStreet,
      }));
      if (resolvedFormatted) setSearchQuery(resolvedFormatted);

      setIsDetecting(false);
      setSmartZoneActive(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showErrorSheet(
        t("addresses.locationFailedTitle", "Couldn't get your location"),
        t("addresses.locationFailedBody", "Please try again, or enter your address manually below."),
      );
      setIsDetecting(false);
    }
  };

  const handleSave = () => {
    const missing = !form.city ? t("addresses.city", "City")
      : !form.district ? t("addresses.district", "District")
      : !form.street ? t("addresses.street", "Street Name")
      : null;
    if (missing) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showErrorSheet(t("addressForm.missingFieldsTitle", "Missing Information"), t("common.requiredField", { field: missing }));
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <Animated.View entering={sheetMotion.backdropEnter} exiting={sheetMotion.backdropExit} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <Animated.View entering={sheetMotion.enter} exiting={sheetMotion.exit} style={[styles.sheet, { backgroundColor: theme.colors.canvas.surface, paddingTop: 12 }]}>
            <View style={styles.handle} />
            
            <View style={[styles.header, { flexDirection: flexRow(IS_RTL) }]}>
              <UIText style={[styles.title, { color: theme.colors.text.primary }]}>
                {initialData ? t("addresses.editTitle", { defaultValue: "Edit Address" }) : t("addresses.addTitle", { defaultValue: "New Address" })}
              </UIText>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle-outline" size={28} color={theme.colors.text.secondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Smart address search — type once, get city/district/street/
                  coordinates filled together from Geoapify's live index. */}
              <View style={styles.searchWrap}>
                <View style={[styles.searchBar, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.background, borderColor: theme.colors.border.default }]}>
                  <Ionicons name="search" size={18} color={theme.colors.text.muted} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={(v) => { setSearchQuery(v); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={t("addresses.searchPlaceholder", { defaultValue: "ابحث عن شارع أو منطقة..." })}
                    placeholderTextColor={theme.colors.text.muted}
                    style={[styles.searchInput, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left" }]}
                  />
                  {searchLoading && <ActivityIndicator size="small" color={theme.colors.brand.primary} />}
                </View>

                {showSuggestions && suggestions.length > 0 && (
                  <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[styles.suggestionsBox, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[2]]}>
                    {suggestions.map((s) => (
                      <PressableScale
                        key={s.placeId}
                        onPress={() => handleSelectSuggestion(s)}
                        scaleTo={0.98}
                        style={[styles.suggestionRow, { borderBottomColor: theme.colors.border.default }]}
                      >
                        <Ionicons name="location-outline" size={16} color={theme.colors.brand.primary} />
                        <View style={{ flex: 1 }}>
                          <UIText numberOfLines={1} style={[styles.suggestionText, { color: theme.colors.text.primary, textAlign: textAlignStart(IS_RTL) }]}>
                            {s.formatted}
                          </UIText>
                        </View>
                      </PressableScale>
                    ))}
                  </Animated.View>
                )}
              </View>

              {/* Smart Location Detect Banner */}
              {!initialData && (
                <Pressable onPress={handleDetectLocation} style={[styles.detectBtn, { backgroundColor: isDetecting ? theme.colors.brand.primaryLight : theme.colors.border.default, borderColor: smartZoneActive ? theme.colors.status.success : "transparent" }]}>
                  <View style={styles.detectIconWrap}>
                    <Animated.View style={[styles.detectPulse, { backgroundColor: theme.colors.brand.primary }, animatedPulse]} />
                    <Ionicons name="navigate" size={18} color={theme.colors.text.inverse} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <UIText style={[styles.detectTitle, { color: theme.colors.text.primary, textAlign: textAlignStart(IS_RTL) }]}>
                      {isDetecting ? t("addresses.detecting", { defaultValue: "Pinpointing location..." }) : smartZoneActive ? t("addresses.zoneDetected", { defaultValue: "Express Zone Confirmed" }) : t("addresses.detectLocation", { defaultValue: "Use Current Location" })}
                    </UIText>
                    {smartZoneActive && (
                      <UIText style={[styles.detectSub, { color: theme.colors.status.success, textAlign: textAlignStart(IS_RTL) }]}>
                        {t("addresses.zoneFast", { defaultValue: "15 min delivery available" })}
                      </UIText>
                    )}
                  </View>
                </Pressable>
              )}

              {/* Map View — shows the real detected/typed coordinates. Geocodes
                  from the typed city/district/street when the user hasn't
                  used "Use Current Location" yet, instead of a fixed pin. */}
              <View style={[styles.mapWrap, { borderColor: theme.colors.border.default }]}>
                 <AddressMapPlaceholder
                   lat={form.lat}
                   lng={form.lng}
                   addressHint={form.lat == null ? { street: form.street, building: form.building ?? "", district: form.district, city: form.city } : undefined}
                   compact={false}
                 />
                 {smartZoneActive && (
                   <View style={styles.mapBadge}>
                     <Ionicons name="flash" size={12} color="#fff" />
                     <UIText style={styles.mapBadgeText}>{t("addresses.expressBadge")}</UIText>
                   </View>
                 )}
              </View>

              {/* GPS provenance — only shown once we actually have a fix, so
                  the customer knows whether this location is a live device
                  read, a corrected read, or fully manual before they confirm. */}
              {form.lat != null && (
                <View style={[styles.sourceRow, { backgroundColor: theme.colors.canvas.background, borderColor: theme.colors.border.default }]}>
                  <Ionicons
                    name={form.location_source === "manual" ? "create-outline" : "navigate-circle-outline"}
                    size={14}
                    color={theme.colors.text.muted}
                  />
                  <UIText style={[styles.sourceText, { color: theme.colors.text.secondary, textAlign: textAlignStart(IS_RTL) }]}>
                    {form.location_source === "gps"
                      ? t("addresses.sourceGps", "Detected automatically")
                      : form.location_source === "gps_corrected"
                        ? t("addresses.sourceGpsCorrected", "Detected, then corrected by you")
                        : t("addresses.sourceManual", "Entered manually")}
                    {accuracyM != null && form.location_source !== "manual"
                      ? ` · ${t("addresses.accuracyApprox", { defaultValue: "±{{m}}m accuracy", m: Math.round(accuracyM) })}`
                      : ""}
                  </UIText>
                </View>
              )}

              {/* Form Fields */}
              <View style={styles.formGroup}>
                <UIText style={[styles.groupLabel, { color: theme.colors.text.secondary, textAlign: textAlignStart(IS_RTL) }]}>{t("addresses.details", { defaultValue: "ADDRESS DETAILS" })}</UIText>
                <View style={[styles.card, { backgroundColor: theme.colors.canvas.background, borderColor: theme.colors.border.default }]}>
                  <TextInput
                    value={form.city}
                    onChangeText={(v) => editAfterDetect({ city: v })}
                    placeholder={t("addresses.city", { defaultValue: "City" })}
                    placeholderTextColor={theme.colors.text.muted}
                    style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                  />
                  <TextInput
                    value={form.district}
                    onChangeText={(v) => editAfterDetect({ district: v })}
                    placeholder={t("addresses.district", { defaultValue: "District" })}
                    placeholderTextColor={theme.colors.text.muted}
                    style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                  />
                  <TextInput
                    value={form.street}
                    onChangeText={(v) => editAfterDetect({ street: v })}
                    placeholder={t("addresses.street", { defaultValue: "Street Name" })}
                    placeholderTextColor={theme.colors.text.muted}
                    style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                  />
                  <View style={[styles.splitRow, { flexDirection: flexRow(IS_RTL) }]}>
                    <TextInput
                      value={form.building}
                      onChangeText={(v) => editAfterDetect({ building: v })}
                      placeholder={t("addresses.building", { defaultValue: "Building" })}
                      placeholderTextColor={theme.colors.text.muted}
                      style={[styles.input, styles.splitInput, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                    />
                    <TextInput
                      value={form.floor ?? ""}
                      onChangeText={(v) => editAfterDetect({ floor: v })}
                      placeholder={t("addresses.floor", { defaultValue: "Floor" })}
                      placeholderTextColor={theme.colors.text.muted}
                      style={[styles.input, styles.splitInput, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                    />
                    <TextInput
                      value={form.apartment ?? ""}
                      onChangeText={(v) => editAfterDetect({ apartment: v })}
                      placeholder={t("addresses.apartment", { defaultValue: "Apt." })}
                      placeholderTextColor={theme.colors.text.muted}
                      style={[styles.input, styles.splitInput, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                    />
                  </View>
                  <TextInput
                    value={form.landmark ?? ""}
                    onChangeText={(v) => editAfterDetect({ landmark: v })}
                    placeholder={t("addresses.landmark", { defaultValue: "Nearby landmark (optional)" })}
                    placeholderTextColor={theme.colors.text.muted}
                    style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left", borderBottomColor: theme.colors.border.default, borderBottomWidth: 1 }]}
                  />
                  <TextInput
                    value={form.delivery_instructions ?? ""}
                    onChangeText={(v) => setForm({ ...form, delivery_instructions: v })}
                    placeholder={t("addresses.deliveryInstructions", { defaultValue: "Delivery instructions (optional)" })}
                    placeholderTextColor={theme.colors.text.muted}
                    style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left" }]}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <UIText style={[styles.groupLabel, { color: theme.colors.text.secondary, textAlign: textAlignStart(IS_RTL) }]}>{t("addresses.deliveryOptions", { defaultValue: "LABEL" })}</UIText>
                <View style={[styles.labelRow, { flexDirection: flexRow(IS_RTL) }]}>
                    {ADDRESS_LABELS.map(({ key: lbl }) => {
                      const isSelected = form.label === lbl;
                      const config = ADDRESS_LABELS.find(l => l.key === lbl);
                      if (!config) return null;
                      return (
                       <Pressable 
                         key={lbl}
                          onPress={() => setForm({ ...form, label: lbl as AddressLabel })}
                         style={[styles.labelChip, { backgroundColor: isSelected ? config.bg : theme.colors.border.default, borderColor: isSelected ? config.color : "transparent" }]}
                       >
                          <Ionicons name={config.icon} size={16} color={isSelected ? config.color : theme.colors.text.secondary} />
                          <UIText style={[styles.labelChipText, { color: isSelected ? config.color : theme.colors.text.secondary }]}>{t(config.labelKey)}</UIText>
                       </Pressable>
                     );
                   })}
                </View>
              </View>

            </ScrollView>
            
            <View style={[styles.footer, { borderTopColor: theme.colors.border.default, paddingBottom: Math.max(insetsBottom, 20) }]}>
              <Button label={t("common.save", { defaultValue: "Save Address" })} onPress={handleSave} loading={loading} />
            </View>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", ...theme.shadows[3] },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: theme.colors.border.strong, alignSelf: "center", marginBottom: 12 },
  header: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  title: { fontFamily: legacyTheme.fonts.extrabold, fontSize: 20 },
  closeBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16 },
  searchWrap: { marginBottom: 12, zIndex: 20 },
  searchBar: { alignItems: "center", gap: 10, height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: legacyTheme.fonts.medium, fontSize: 15, height: "100%" },
  suggestionsBox: { position: "absolute", top: 58, start: 0, end: 0, borderRadius: 14, borderWidth: 1, overflow: "hidden", zIndex: 30 },
  suggestionRow: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { fontFamily: legacyTheme.fonts.semibold, fontSize: 13, flex: 1 },
  detectBtn: { flexDirection: flexRow(isRtl()), alignItems: "center", padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1 },
  detectIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", position: "relative" },
  detectPulse: { position: "absolute", width: "100%", height: "100%", borderRadius: 20 },
  detectTitle: { fontFamily: legacyTheme.fonts.bold, fontSize: 15 },
  detectSub: { fontFamily: legacyTheme.fonts.medium, fontSize: 13, marginTop: 2 },
  mapWrap: { height: 160, borderRadius: 16, overflow: "hidden", marginBottom: 24, borderWidth: 1 },
  map: { flex: 1 },
  mapBadge: { position: "absolute", bottom: 12, start: 12, backgroundColor: theme.colors.brand.primary, flexDirection: flexRow(isRtl()), alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, ...theme.shadows[1] },
  mapBadgeText: { fontFamily: legacyTheme.fonts.bold, fontSize: 10, color: "#fff", letterSpacing: 1 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  sourceText: { fontFamily: legacyTheme.fonts.medium, fontSize: 12, flex: 1 },
  splitRow: { gap: 8 },
  splitInput: { flex: 1, paddingHorizontal: 10 },
  formGroup: { marginBottom: 24 },
  groupLabel: { fontFamily: legacyTheme.fonts.bold, fontSize: 12, letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  input: { fontFamily: legacyTheme.fonts.bold, fontSize: 15, paddingHorizontal: 16, height: 56 },
  labelRow: { gap: 12 },
  labelChip: { flexDirection: flexRow(isRtl()), alignItems: "center", paddingHorizontal: 16, height: 44, borderRadius: 22, gap: 8, borderWidth: 1 },
  labelChipText: { fontFamily: legacyTheme.fonts.bold, fontSize: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: theme.colors.canvas.surface },
  });
}
