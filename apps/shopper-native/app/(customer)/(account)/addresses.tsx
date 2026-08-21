import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useDarkColors } from '@/hooks/useDarkColors';

import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { showConfirmSheet, showErrorSheet } from "@/shared/store/appSheetStore";

import { Ionicons } from "@expo/vector-icons";

import { kit } from "@pharmacy/ui-native";

import { theme } from "@pharmacy/design-tokens";

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

  const { c } = useDarkColors();

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

            {({ pressed }) => <View style={[styles.back, pressed && styles.backP]}><Ionicons name={BACK_CHEVRON} size={18} color={c.inkSoft} /></View>}

          </Pressable>

          <View style={styles.tile}><Ionicons name="location-outline" size={22} color={c.accentDeep} /></View>

          <View style={{ flex: 1 }}>

            <UIText style={[styles.hTitle, { textAlign: TA }]}>{t("addresses.title")}</UIText>

            <UIText style={[styles.hSub, { textAlign: TA }]}> {addresses.length > 0 ? t("addresses.savedCount", { count: addresses.length }) : t("addresses.addFirst")} </UIText>

          </View>

          <Pressable onPress={handleAdd} style={styles.addT} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("addresses.addNew")}>

            {({ pressed }) => <View style={[styles.add, pressed && styles.addP]}><Ionicons name="add" size={20} color={c.accentDeep} /></View>}

          </Pressable>

        </View>

      </Animated.View>



      {addresses.length > 0 && <Animated.View entering={FadeIn.duration(280)} style={[s.chips, { flexDirection: flexRow(RTL) }]}> 

        <View style={[s.chip, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="location" size={12} color={c.accentDeep} />

          <UIText style={s.chipT}>{t("addresses.count", { count: addresses.length })}</UIText>

        </View>

        {defaultAddr && <View style={[s.chip, s.chipOk, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="checkmark-circle" size={12} color={c.success} />

          <UIText style={[s.chipT, { color: c.success }]}> {defaultAddr.city} • {t("addresses.default")} </UIText>

        </View>}

      </Animated.View>}



      {isSkeleton ? <View style={styles.loadWrap}>{[1, 2, 3].map(i => <Shimmer key={i} />)}</View>

        : isError ? <View style={styles.emptyW}><EmptyState icon="wifi-outline" title={t("errors.network").split(".")[0]} description={t("errors.network")} actionLabel={t("common.retry")} onAction={() => user?.id && fetch(user.id)} /></View>

        : isEmpty ? <View style={styles.emptyW}><EmptyState icon="location-outline" title={t("addresses.emptyTitle")} description={t("addresses.emptyDesc")} actionLabel={t("addresses.emptyAction")} onAction={handleAdd} /></View>

        : <FlatList data={addresses} keyExtractor={i => i.id} renderItem={renderItem} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}

            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}

            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} progressBackgroundColor={c.surface} />}

            ListHeaderComponent={addresses.length > 1 ? <View style={[s.secLbl, { flexDirection: flexRow(RTL) }]}> 

              <View style={s.secBadge}><Ionicons name="map-outline" size={14} color={c.accentDeep} /></View>

              <View style={{ flex: 1 }}>

                <UIText style={[s.secEye, { textAlign: TA }]}>{t("addresses.savedCount", { count: addresses.length })}</UIText>

              </View>

            </View> : null}

            ListFooterComponent={<Animated.View entering={FadeInDown.duration(320).delay(addresses.length * 60 + 100)}>

              <Pressable onPress={handleAdd} style={s.addCardT} accessibilityRole="button" accessibilityLabel={t("addresses.addNew")}>

                {({ pressed }) => <View style={[s.addCard, { flexDirection: flexRow(RTL) }, pressed && s.addCardP]}> 

                  <View style={s.addIcon}><Ionicons name="add" size={22} color={c.accentDeep} /></View>

                  <View style={{ flex: 1 }}>

                    <UIText style={[s.addLbl, { textAlign: TA }]}>{t("addresses.addNew")}</UIText>

                    <UIText style={[s.addSub, { textAlign: TA }]}>{t("addresses.addNewDesc")}</UIText>

                  </View>

                  <Ionicons name={FORWARD_CHEVRON} size={14} color={c.accentDeep} />

                </View>}

              </Pressable>

            </Animated.View>}

          />}



      <AddressFormDrawer visible={drawer} address={editing} onClose={() => setDrawer(false)} onSubmit={handleSubmit} loading={submitting} />

    </View>

  );

}



const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, ...kit.shadow.raised },

  hRow: { flexDirection: flexRow(RTL), alignItems: "center", gap: 12, minHeight: 38 },

  backT: { borderRadius: 20, flexShrink: 0 },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised },

  backP: { backgroundColor: kit.color.well, transform: [{ scale: 0.94 }] },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: theme.fonts.black, fontSize: 18, letterSpacing: -0.4, color: kit.color.ink, includeFontPadding: false, textAlign: TA },

  hSub: { fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, includeFontPadding: false, textAlign: TA, marginTop: 1 },

  addT: { borderRadius: 13, flexShrink: 0 },

  add: { width: 42, height: 42, borderRadius: 13, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", ...kit.shadow.raised },

  addP: { transform: [{ scale: 0.93 }] },

  loadWrap: { flex: 1, padding: 20, gap: 12 },

  shimmer: { height: 180, borderRadius: 20, backgroundColor: kit.color.well },

  emptyW: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },

  list: { padding: 20, paddingBottom: 40 },

});



const s = StyleSheet.create({

  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line },

  chip: { alignItems: "center", gap: 5, backgroundColor: kit.color.accentTint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: kit.color.line },

  chipOk: { backgroundColor: kit.color.successTint, borderColor: kit.color.success + "30" },

  chipT: { fontSize: 10, fontFamily: theme.fonts.bold, color: kit.color.accentDeep, includeFontPadding: false },

  secLbl: { alignItems: "center", gap: 12, marginBottom: 14 },

  secBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  secEye: { fontSize: 10, fontFamily: theme.fonts.bold, color: kit.color.accentDeep, letterSpacing: 0.4, textAlign: TA, includeFontPadding: false },

  addCardT: { borderRadius: 18, marginTop: 14 },

  addCard: { alignItems: "center", gap: 14, padding: 16, borderRadius: 18, backgroundColor: kit.color.surface, borderWidth: 1.5, borderColor: kit.color.line, borderStyle: "dashed", ...kit.shadow.raised },

  addCardP: { backgroundColor: kit.color.accentTint, borderColor: "rgba(14,126,116,0.30)" },

  addIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  addLbl: { fontSize: 13, fontFamily: theme.fonts.bold, color: kit.color.ink, includeFontPadding: false },

  addSub: { fontSize: 11, fontFamily: theme.fonts.regular, color: kit.color.inkFaint, marginTop: 2, includeFontPadding: false },

});
