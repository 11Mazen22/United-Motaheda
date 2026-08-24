import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useTheme } from "@pharmacy/ui-native";

import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { showConfirmSheet, showErrorSheet } from "@/shared/store/appSheetStore";

import { Ionicons } from "@expo/vector-icons";


import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withRepeat, withTiming, useSharedValue } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";

import { useAddressStore, AddressCard, AddressFormDrawer, type Address, type AddressFormData } from "@/features/addresses";

import { EmptyState } from "@/components/ui/EmptyState";

import { Text as UIText } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);



function Shimmer() {

  const op = useSharedValue(0.5);

  useEffect(() => { op.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [op]);

  const aStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return <Animated.View style={[styles.shimmer, aStyle]} />;

}



const Row = React.memo(function Row({ item, index, onEdit, onDelete, onSetDefault }: {

  item: Address; index: number; onEdit: (a: Address) => void; onDelete: (a: Address) => void; onSetDefault: (a: Address) => void;

}) {

  return (

    <Animated.View entering={FadeInDown.duration(280).delay(index * 60)}>

      <AddressCard address={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} onSetDefault={() => onSetDefault(item)} />

    </Animated.View>

  );

});



export default function AddressesScreen() {

  const { theme } = useTheme();

  const router = useRouter(), insets = useSafeAreaInsets(), { t } = useTranslation();

  const { user } = useAuth();

  const addresses = useAddressStore(s => s.addresses);

  const loading = useAddressStore(s => s.loading);

  const fetchError = useAddressStore(s => s.error);

  const fetch = useAddressStore(s => s.fetch);

  const add = useAddressStore(s => s.add);

  const update = useAddressStore(s => s.update);

  const remove = useAddressStore(s => s.remove);

  const setDef = useAddressStore(s => s.setDefault);

  const [drawer, setDrawer] = useState(false);

  const [editing, setEditing] = useState<Address | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [refreshing, setRefreshing] = useState(false);



  useEffect(() => { if (user?.id) fetch(user.id); }, [user?.id, fetch]);



  const defaultAddr = useMemo(() => addresses.find(a => a.is_default), [addresses]);



  const onRefresh = useCallback(async () => {

    if (!user?.id) return;

    setRefreshing(true);

    await fetch(user.id);

    setRefreshing(false);

  }, [user?.id, fetch]);



  const handleAdd = useCallback(() => { setEditing(null); setDrawer(true); if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); }, []);



  const handleDelete = useCallback((addr: Address) => {

    showConfirmSheet(t("addresses.deleteTitle"), t("addresses.deleteMessage", { name: addr.recipient_name }), () => {

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

      remove(addr.id);

    }, { confirmLabel: t("addresses.deleteConfirm"), danger: true });

  }, [remove, t]);



  const handleSetDefault = useCallback((addr: Address) => {

    if (!user?.id) return;

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    setDef(addr.id, user.id);

  }, [user?.id, setDef]);



  const handleSubmit = useCallback(async (data: AddressFormData) => {

    if (!user?.id) return;

    setSubmitting(true);

    try {

      if (editing) await update(editing.id, user.id, data);

      else await add(user.id, data);

      setDrawer(false);

    } catch (err) {

      if (err instanceof Error && err.message === "duplicate_address") {

        showConfirmSheet(t("addresses.duplicateTitle", "العنوان موجود مسبقاً"), t("addresses.duplicateBody", "هذا العنوان محفوظ بالفعل في قائمة عناوينك. هل تريد استخدام العنوان الموجود؟"), () => setDrawer(false),

          { confirmLabel: t("addresses.duplicateUseExisting", "استخدام العنوان الموجود"), cancelLabel: t("addresses.duplicateEditNew", "تعديل العنوان") });

      } else {

        showErrorSheet(t("addresses.saveError"), t("addresses.saveErrorDesc"));

      }

    } finally { setSubmitting(false); }

  }, [user?.id, editing, update, add, t]);



  const renderItem = useCallback(({ item, index }: { item: Address; index: number }) => (

    <Row item={item} index={index} onEdit={setEditing} onDelete={handleDelete} onSetDefault={handleSetDefault} />

  ), [handleDelete, handleSetDefault]);



  const isSkeleton = loading && addresses.length === 0;

  const isError = !loading && !!fetchError && addresses.length === 0;

  const isEmpty = !loading && !fetchError && addresses.length === 0;



  return (

    <View style={styles.screen}>

      <Animated.View entering={FadeIn.duration(240)} style={[styles.header, { paddingTop: insets.top + 10 }]}>

        <View style={[styles.hRow, { flexDirection: flexRow(RTL) }]}> 

          <Pressable onPress={() => router.back()} style={styles.backT} accessibilityRole="button" accessibilityLabel={t("common.back")}>

            {({ pressed }) => <View style={[styles.back, pressed && styles.backP]}><Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} /></View>}

          </Pressable>

          <View style={styles.tile}><Ionicons name="location-outline" size={22} color={theme.colors.brand.primary} /></View>

          <View style={{ flex: 1 }}>

            <UIText style={[styles.hTitle, { textAlign: TA }]}>{t("addresses.title")}</UIText>

            <UIText style={[styles.hSub, { textAlign: TA }]}> {addresses.length > 0 ? t("addresses.savedCount", { count: addresses.length }) : t("addresses.addFirst")} </UIText>

          </View>

          <Pressable onPress={handleAdd} style={styles.addT} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("addresses.addNew")}>

            {({ pressed }) => <View style={[styles.add, pressed && styles.addP]}><Ionicons name="add" size={20} color={theme.colors.brand.primary} /></View>}

          </Pressable>

        </View>

      </Animated.View>



      {addresses.length > 0 && <Animated.View entering={FadeIn.duration(280)} style={[s.chips, { flexDirection: flexRow(RTL) }]}> 

        <View style={[s.chip, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="location" size={12} color={theme.colors.brand.primary} />

          <UIText style={s.chipT}>{t("addresses.count", { count: addresses.length })}</UIText>

        </View>

        {defaultAddr && <View style={[s.chip, s.chipOk, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="checkmark-circle" size={12} color={theme.colors.status.success} />

          <UIText style={[s.chipT, { color: theme.colors.status.success }]}> {defaultAddr.city} • {t("addresses.default")} </UIText>

        </View>}

      </Animated.View>}



      {isSkeleton ? <View style={styles.loadWrap}>{[1, 2, 3].map(i => <Shimmer key={i} />)}</View>

        : isError ? <View style={styles.emptyW}><EmptyState icon="wifi-outline" title={t("errors.network").split(".")[0]} description={t("errors.network")} actionLabel={t("common.retry")} onAction={() => user?.id && fetch(user.id)} /></View>

        : isEmpty ? <View style={styles.emptyW}><EmptyState icon="location-outline" title={t("addresses.emptyTitle")} description={t("addresses.emptyDesc")} actionLabel={t("addresses.emptyAction")} onAction={handleAdd} /></View>

        : <FlatList data={addresses} keyExtractor={i => i.id} renderItem={renderItem} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}

            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}

            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} colors={[theme.colors.brand.primary]} progressBackgroundColor={theme.colors.canvas.surface} />}

            ListHeaderComponent={addresses.length > 1 ? <View style={[s.secLbl, { flexDirection: flexRow(RTL) }]}> 

              <View style={s.secBadge}><Ionicons name="map-outline" size={14} color={theme.colors.brand.primary} /></View>

              <View style={{ flex: 1 }}>

                <UIText style={[s.secEye, { textAlign: TA }]}>{t("addresses.savedCount", { count: addresses.length })}</UIText>

              </View>

            </View> : null}

            ListFooterComponent={<Animated.View entering={FadeInDown.duration(320).delay(addresses.length * 60 + 100)}>

              <Pressable onPress={handleAdd} style={s.addCardT} accessibilityRole="button" accessibilityLabel={t("addresses.addNew")}>

                {({ pressed }) => <View style={[s.addCard, { flexDirection: flexRow(RTL) }, pressed && s.addCardP]}> 

                  <View style={s.addIcon}><Ionicons name="add" size={22} color={theme.colors.brand.primary} /></View>

                  <View style={{ flex: 1 }}>

                    <UIText style={[s.addLbl, { textAlign: TA }]}>{t("addresses.addNew")}</UIText>

                    <UIText style={[s.addSub, { textAlign: TA }]}>{t("addresses.addNewDesc")}</UIText>

                  </View>

                  <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.brand.primary} />

                </View>}

              </Pressable>

            </Animated.View>}

          />}



      <AddressFormDrawer visible={drawer} initialData={editing ?? undefined} onClose={() => setDrawer(false)} onSubmit={handleSubmit} loading={submitting} />

    </View>

  );

}



const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default, ...theme.shadows[1] },

  hRow: { flexDirection: flexRow(RTL), alignItems: "center", gap: 12, minHeight: 38 },

  backT: { borderRadius: 20, flexShrink: 0 },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.canvas.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1] },

  backP: { backgroundColor: theme.colors.canvas.surfaceMuted, transform: [{ scale: 0.94 }] },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: legacyTheme.fonts.black, fontSize: 18, letterSpacing: -0.4, color: theme.colors.text.primary, includeFontPadding: false, textAlign: TA },

  hSub: { fontFamily: legacyTheme.fonts.semibold, fontSize: 11, color: theme.colors.text.muted, includeFontPadding: false, textAlign: TA, marginTop: 1 },

  addT: { borderRadius: 13, flexShrink: 0 },

  add: { width: 42, height: 42, borderRadius: 13, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", ...theme.shadows[1] },

  addP: { transform: [{ scale: 0.93 }] },

  loadWrap: { flex: 1, padding: 20, gap: 12 },

  shimmer: { height: 180, borderRadius: 20, backgroundColor: theme.colors.canvas.surfaceMuted },

  emptyW: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },

  list: { padding: 20, paddingBottom: 40 },

});



const s = StyleSheet.create({

  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default },

  chip: { alignItems: "center", gap: 5, backgroundColor: theme.colors.brand.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border.default },

  chipOk: { backgroundColor: `${theme.colors.status.success}1A`, borderColor: theme.colors.status.success + "30" },

  chipT: { fontSize: 10, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary, includeFontPadding: false },

  secLbl: { alignItems: "center", gap: 12, marginBottom: 14 },

  secBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  secEye: { fontSize: 10, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary, letterSpacing: 0.4, textAlign: TA, includeFontPadding: false },

  addCardT: { borderRadius: 18, marginTop: 14 },

  addCard: { alignItems: "center", gap: 14, padding: 16, borderRadius: 18, backgroundColor: theme.colors.canvas.surface, borderWidth: 1.5, borderColor: theme.colors.border.default, borderStyle: "dashed", ...theme.shadows[1] },

  addCardP: { backgroundColor: theme.colors.brand.primaryLight, borderColor: "rgba(14,126,116,0.30)" },

  addIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  addLbl: { fontSize: 13, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.primary, includeFontPadding: false },

  addSub: { fontSize: 11, fontFamily: legacyTheme.fonts.regular, color: theme.colors.text.muted, marginTop: 2, includeFontPadding: false },

});
