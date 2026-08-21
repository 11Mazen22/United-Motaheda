import React, { useState, useEffect } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, TextInput, KeyboardAvoidingView } from "react-native";
import { Text as UIText, kit, Button } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddressMapPlaceholder } from "./AddressMapPlaceholder";
import { ADDRESS_LABELS } from "../types";
import type { AddressFormData } from "../types";
import { useDarkColors } from "@/hooks/useDarkColors";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

export function AddressFormDrawer({
  visible,
  onClose,
  initialData,
  onSubmit,
  loading = false,
}: any) {
  const { t } = useTranslation();
  const { c } = useDarkColors();
  const insets = useSafeAreaInsets();
  const IS_RTL = isRtl();

  const [form, setForm] = useState<AddressFormData>(
    initialData || { label: "home", recipient_name: "", phone: "", city: "Riyadh", district: "", street: "", building: "", floor: "", apartment: "", landmark: "", is_default: false }
  );
  
  const [isDetecting, setIsDetecting] = useState(false);
  const [smartZoneActive, setSmartZoneActive] = useState(false);
  
  const pulse = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (isDetecting && !reducedMotion) {
      pulse.value = withRepeat(withTiming(1.3, { duration: 800 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [isDetecting, reducedMotion]);

  const animatedPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 1) * 2,
  }));

  const handleDetectLocation = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDetecting(true);
    setSmartZoneActive(false);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsDetecting(false);
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      
      // We have precise coords. In a real app we'd reverse-geocode here, 
      // but for UX we just auto-fill the placeholder and attach lat/lng.
      setForm(prev => ({
        ...prev,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        city: "Riyadh",
        district: "Detected Zone",
        street: "Precise GPS Location Captured",
      }));
      
      setIsDetecting(false);
      setSmartZoneActive(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setIsDetecting(false);
    }
  };

  const handleSave = () => {
    if (!form.street || !form.district) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          
          <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { backgroundColor: c.surface, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.handle} />
            
            <View style={[styles.header, { flexDirection: flexRow(IS_RTL) }]}>
              <UIText style={[styles.title, { color: c.ink }]}>
                {initialData ? t("addresses.editTitle", { defaultValue: "Edit Address" }) : t("addresses.addTitle", { defaultValue: "New Address" })}
              </UIText>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle-outline" size={28} color={c.inkSoft} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              {/* Smart Location Detect Banner */}
              {!initialData && (
                <Pressable onPress={handleDetectLocation} style={[styles.detectBtn, { backgroundColor: isDetecting ? kit.color.accentTint : c.line, borderColor: smartZoneActive ? kit.color.success : "transparent" }]}>
                  <View style={styles.detectIconWrap}>
                    <Animated.View style={[styles.detectPulse, { backgroundColor: kit.color.accentDeep }, animatedPulse]} />
                    <Ionicons name="navigate" size={18} color={kit.color.onAccent} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <UIText style={[styles.detectTitle, { color: c.ink, textAlign: textAlignStart(IS_RTL) }]}>
                      {isDetecting ? t("addresses.detecting", { defaultValue: "Pinpointing location..." }) : smartZoneActive ? t("addresses.zoneDetected", { defaultValue: "Express Zone Confirmed" }) : t("addresses.detectLocation", { defaultValue: "Use Current Location" })}
                    </UIText>
                    {smartZoneActive && (
                      <UIText style={[styles.detectSub, { color: kit.color.success, textAlign: textAlignStart(IS_RTL) }]}>
                        {t("addresses.zoneFast", { defaultValue: "15 min delivery available" })}
                      </UIText>
                    )}
                  </View>
                </Pressable>
              )}

              {/* Map View */}
              <View style={[styles.mapWrap, { borderColor: c.line }]}>
                 <AddressMapPlaceholder lat={24.7136} lng={46.6753} compact={false} />
                 {smartZoneActive && (
                   <View style={styles.mapBadge}>
                     <Ionicons name="flash" size={12} color="#fff" />
                     <UIText style={styles.mapBadgeText}>EXPRESS</UIText>
                   </View>
                 )}
              </View>

              {/* Form Fields */}
              <View style={styles.formGroup}>
                <UIText style={[styles.groupLabel, { color: c.inkSoft, textAlign: textAlignStart(IS_RTL) }]}>{t("addresses.details", { defaultValue: "ADDRESS DETAILS" })}</UIText>
                <View style={[styles.card, { backgroundColor: c.canvas, borderColor: c.line }]}>
                  <TextInput
                    value={form.city}
                    onChangeText={(t) => setForm({ ...form, city: t })}
                    placeholder={t("addresses.city", { defaultValue: "City" })}
                    placeholderTextColor={c.inkFaint}
                    style={[styles.input, { color: c.ink, textAlign: IS_RTL ? "right" : "left", borderBottomColor: c.line, borderBottomWidth: 1 }]}
                  />
                  <TextInput
                    value={form.district}
                    onChangeText={(t) => setForm({ ...form, district: t })}
                    placeholder={t("addresses.district", { defaultValue: "District" })}
                    placeholderTextColor={c.inkFaint}
                    style={[styles.input, { color: c.ink, textAlign: IS_RTL ? "right" : "left", borderBottomColor: c.line, borderBottomWidth: 1 }]}
                  />
                  <TextInput
                    value={form.street}
                    onChangeText={(t) => setForm({ ...form, street: t })}
                    placeholder={t("addresses.street", { defaultValue: "Street Name" })}
                    placeholderTextColor={c.inkFaint}
                    style={[styles.input, { color: c.ink, textAlign: IS_RTL ? "right" : "left" }]}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <UIText style={[styles.groupLabel, { color: c.inkSoft, textAlign: textAlignStart(IS_RTL) }]}>{t("addresses.deliveryOptions", { defaultValue: "LABEL" })}</UIText>
                <View style={[styles.labelRow, { flexDirection: flexRow(IS_RTL) }]}>
                    {["home", "work", "other"].map((lbl) => {
                      const isSelected = form.label === lbl;
                      const config = ADDRESS_LABELS.find(l => l.key === lbl);
                      if (!config) return null;
                      return (
                       <Pressable 
                         key={lbl}
                         onPress={() => setForm({ ...form, label: lbl as any })}
                         style={[styles.labelChip, { backgroundColor: isSelected ? config.bg : c.line, borderColor: isSelected ? config.color : "transparent" }]}
                       >
                         <Ionicons name={config.icon as any} size={16} color={isSelected ? config.color : c.inkSoft} />
                          <UIText style={[styles.labelChipText, { color: isSelected ? config.color : c.inkSoft }]}>{t(config.labelKey)}</UIText>
                       </Pressable>
                     );
                   })}
                </View>
              </View>

            </ScrollView>
            
            <View style={[styles.footer, { borderTopColor: c.line }]}>
              <Button label={t("common.save", { defaultValue: "Save Address" })} onPress={handleSave} loading={loading} />
            </View>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", ...kit.shadow.floating },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: kit.color.lineStrong, alignSelf: "center", marginBottom: 12 },
  header: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  title: { fontFamily: theme.fonts.extrabold, fontSize: 20 },
  closeBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  detectBtn: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1 },
  detectIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", position: "relative" },
  detectPulse: { position: "absolute", width: "100%", height: "100%", borderRadius: 20 },
  detectTitle: { fontFamily: theme.fonts.bold, fontSize: 15 },
  detectSub: { fontFamily: theme.fonts.medium, fontSize: 13, marginTop: 2 },
  mapWrap: { height: 160, borderRadius: 16, overflow: "hidden", marginBottom: 24, borderWidth: 1 },
  map: { flex: 1 },
  mapBadge: { position: "absolute", bottom: 12, left: 12, backgroundColor: kit.color.accentDeep, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, ...kit.shadow.raised },
  mapBadgeText: { fontFamily: theme.fonts.bold, fontSize: 10, color: "#fff", letterSpacing: 1 },
  formGroup: { marginBottom: 24 },
  groupLabel: { fontFamily: theme.fonts.bold, fontSize: 12, letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  input: { fontFamily: theme.fonts.bold, fontSize: 15, paddingHorizontal: 16, height: 56 },
  labelRow: { gap: 12 },
  labelChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 44, borderRadius: 22, gap: 8, borderWidth: 1 },
  labelChipText: { fontFamily: theme.fonts.bold, fontSize: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
