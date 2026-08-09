import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { showConfirmSheet, showErrorSheet } from "@/shared/store/appSheetStore";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@pharmacy/ui-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useSharedValue,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth";
import {
  useAddressStore,
  AddressCard,
  AddressFormDrawer,
  type Address,
  type AddressFormData,
} from "@/features/addresses";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
function ShimmerCard() {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[s.skeletonCard, aStyle]} />;
}

// ─── AddressCardRow — hoisted at module scope so React never sees a new
//     component type on re-renders, preventing unmount/remount of every row.
const AddressCardRow = React.memo(function AddressCardRow({
  item,
  index,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  item:         Address;
  index:        number;
  onEdit:       (a: Address) => void;
  onDelete:     (a: Address) => void;
  onSetDefault: (a: Address) => void;
}) {
  const handleEdit       = useCallback(() => onEdit(item),       [onEdit, item]);
  const handleDelete     = useCallback(() => onDelete(item),     [onDelete, item]);
  const handleSetDefault = useCallback(() => onSetDefault(item), [onSetDefault, item]);

  return (
    <Animated.View entering={FadeInDown.duration(280).delay(index * 60)}>
      <AddressCard
        address={item}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />
    </Animated.View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AddressesScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();

  const addresses      = useAddressStore((s) => s.addresses);
  const loading        = useAddressStore((s) => s.loading);
  const fetchError     = useAddressStore((s) => s.error);
  const fetchAddresses = useAddressStore((s) => s.fetch);
  const addAddress     = useAddressStore((s) => s.add);
  const updateAddress  = useAddressStore((s) => s.update);
  const removeAddress  = useAddressStore((s) => s.remove);
  const setDefault     = useAddressStore((s) => s.setDefault);

  const [drawerVisible, setDrawerVisible]   = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [submitting, setSubmitting]         = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  useEffect(() => {
    if (user?.id) fetchAddresses(user.id);
  }, [user?.id, fetchAddresses]);

  const defaultAddr = useMemo(
    () => addresses.find((a) => a.is_default),
    [addresses]
  );

  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await fetchAddresses(user.id);
    setRefreshing(false);
  }, [user?.id, fetchAddresses]);

  const handleAdd = useCallback(() => {
    setEditingAddress(null);
    setDrawerVisible(true);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);

  const handleEdit = useCallback((addr: Address) => {
    setEditingAddress(addr);
    setDrawerVisible(true);
  }, []);

  const handleDelete = useCallback(
    (addr: Address) => {
      showConfirmSheet(
        t("addresses.deleteTitle"),
        t("addresses.deleteMessage", { name: addr.recipient_name }),
        () => {
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          removeAddress(addr.id);
        },
        { confirmLabel: t("addresses.deleteConfirm"), danger: true },
      );
    },
    [removeAddress, t]
  );

  const handleSetDefault = useCallback(
    (addr: Address) => {
      if (!user?.id) return;
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDefault(addr.id, user.id);
    },
    [user?.id, setDefault]
  );

  const handleSubmit = useCallback(
    async (data: AddressFormData) => {
      if (!user?.id) return;
      setSubmitting(true);
      try {
        if (editingAddress) {
          await updateAddress(editingAddress.id, user.id, data);
        } else {
          await addAddress(user.id, data);
        }
        setDrawerVisible(false);
      } catch (err) {
        // Duplicate address — show a specific message with a "use existing" CTA
        // instead of the generic save-error sheet so the user understands what
        // happened and is not left wondering why the save failed silently.
        if (err instanceof Error && err.message === "duplicate_address") {
          showConfirmSheet(
            t("addresses.duplicateTitle", "العنوان موجود مسبقاً"),
            t(
              "addresses.duplicateBody",
              "هذا العنوان محفوظ بالفعل في قائمة عناوينك. هل تريد استخدام العنوان الموجود؟",
            ),
            () => setDrawerVisible(false),
            {
              confirmLabel: t("addresses.duplicateUseExisting", "استخدام العنوان الموجود"),
              cancelLabel:  t("addresses.duplicateEditNew", "تعديل العنوان"),
            },
          );
        } else {
          showErrorSheet(t("addresses.saveError"), t("addresses.saveErrorDesc"));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [user?.id, editingAddress, updateAddress, addAddress, t]
  );

  const renderAddress = useCallback(
    ({ item, index }: { item: Address; index: number }) => (
      <AddressCardRow
        item={item}
        index={index}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />
    ),
    [handleEdit, handleDelete, handleSetDefault],
  );

  const showInitialSkeleton = loading && addresses.length === 0;
  const showError           = !loading && !!fetchError && addresses.length === 0;
  const showEmpty           = !loading && !fetchError && addresses.length === 0;

  return (
    <View style={s.screen}>

      {/* ── VIP Header ── */}
      <Animated.View entering={FadeIn.duration(240)} style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtnTouchable}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}>
          {({ pressed }) => (
            <View style={[s.backBtn, pressed && s.backBtnPressed]}>
              <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
            </View>
          )}
        </Pressable>

        <View style={s.iconTile}>
          <Ionicons name="location-outline" size={22} color={kit.color.accentDeep} />
        </View>

        <View style={{ flex: 1 }}>
          <UIText style={s.headerTitle}>{t("addresses.title")}</UIText>
          <UIText style={s.headerSubtitle}>
            {addresses.length > 0
              ? t("addresses.savedCount", { count: addresses.length })
              : t("addresses.addFirst")}
          </UIText>
        </View>

        <Pressable
          onPress={handleAdd}
          style={s.addBtnHeaderTouchable}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("addresses.addNew")}>
          {({ pressed }) => (
            <View style={[s.addBtnHeader, pressed && s.addBtnHeaderPressed]}>
              <Ionicons name="add" size={20} color={kit.color.accentDeep} />
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Stats chips */}
      {addresses.length > 0 && (
        <Animated.View entering={FadeIn.duration(280)} style={[s.statsRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.statChip, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="location" size={12} color={kit.color.accentDeep} />
            <UIText style={s.statText}>{t("addresses.count", { count: addresses.length })}</UIText>
          </View>
          {defaultAddr && (
            <View style={[s.statChip, s.statChipSuccess, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="checkmark-circle" size={12} color={kit.color.success} />
              <UIText style={[s.statText, { color: kit.color.success }]}>
                {defaultAddr.city}  •  {t("addresses.default")}
              </UIText>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── Content ── */}
      {showInitialSkeleton ? (
        <View style={s.loadingWrap}>
          {[1, 2, 3].map((i) => <ShimmerCard key={i} />)}
        </View>
      ) : showError ? (
        <View style={s.emptyWrap}>
          <EmptyState
            icon="wifi-outline"
            title={t("errors.network").split(".")[0]}
            description={t("errors.network")}
            actionLabel={t("common.retry")}
            onAction={() => user?.id && fetchAddresses(user.id)}
          />
        </View>
      ) : showEmpty ? (
        <View style={s.emptyWrap}>
          <EmptyState
            icon="location-outline"
            title={t("addresses.emptyTitle")}
            description={t("addresses.emptyDesc")}
            actionLabel={t("addresses.emptyAction")}
            onAction={handleAdd}
          />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderAddress}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={kit.color.accent}
              colors={[kit.color.accent]}
              progressBackgroundColor={kit.color.surface}
            />
          }
          ListHeaderComponent={
            addresses.length > 1 ? (
              <View style={[s.sectionLabel, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.sectionBadge}>
                  <Ionicons name="map-outline" size={14} color={kit.color.accentDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <UIText style={s.sectionEyebrow}>{t("addresses.allLocations")}</UIText>
                  <UIText style={s.sectionTitle}>{t("addresses.savedTitle")}</UIText>
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            <Animated.View
              entering={FadeInDown.duration(320).delay(addresses.length * 60 + 100)}>
              <Pressable
                onPress={handleAdd}
                style={s.addCardBtnTouchable}
                accessibilityRole="button"
                accessibilityLabel={t("addresses.addNew")}>
                {({ pressed }) => (
                  <View
                    style={[
                      s.addCardBtn,
                      { flexDirection: flexRow(IS_RTL) },
                      pressed && s.addCardBtnPressed,
                    ]}>
                    <View style={s.addCardIcon}>
                      <Ionicons name="add" size={22} color={kit.color.accentDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <UIText style={[s.addCardLabel, { textAlign: TEXT_START }]}>{t("addresses.addNew")}</UIText>
                      <UIText style={[s.addCardDesc, { textAlign: TEXT_START }]}>{t("addresses.addNewDesc")}</UIText>
                    </View>
                    <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.accentDeep} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          }
        />
      )}

      {/* ── Form Drawer ── */}
      <AddressFormDrawer
        visible={drawerVisible}
        address={editingAddress}
        onClose={() => setDrawerVisible(false)}
        onSubmit={handleSubmit}
        loading={submitting}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // Header
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingBottom:     16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  // Touchable wrapper carries only sizing/radius — visual styling lives on
  // the plain View inside instead of on the Pressable's own style, since a
  // raw Pressable's function-computed style has proven unreliable here.
  backBtnTouchable: {
    borderRadius: 20,
    flexShrink:   0,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  backBtnPressed: {
    backgroundColor: kit.color.well,
    transform:       [{ scale: 0.94 }],
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.4,
    color:              kit.color.ink,
    includeFontPadding: false,
    textAlign:          TEXT_START,
  },
  headerSubtitle: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
    textAlign:          TEXT_START,
    marginTop:          1,
  },
  addBtnHeaderTouchable: {
    borderRadius: 13,
    flexShrink:   0,
  },
  addBtnHeader: {
    width:           42,
    height:          42,
    borderRadius:    13,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  addBtnHeaderPressed: {
    transform: [{ scale: 0.93 }],
  },

  // Stats chips row
  statsRow: {
    gap:               8,
    paddingHorizontal: 20,
    paddingVertical:   10,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  statChip: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  statChipSuccess: {
    backgroundColor: kit.color.successTint,
    borderColor:     kit.color.success + "30",
  },
  statText: {
    fontSize:           10,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // Loading skeletons
  loadingWrap: { flex: 1, padding: 20, gap: 12 },
  skeletonCard: {
    height:          180,
    borderRadius:    20,
    backgroundColor: kit.color.well,
  },

  // Empty state
  emptyWrap: {
    flex:              1,
    justifyContent:    "center",
    paddingHorizontal: 20,
  },

  // List
  list: { padding: 20, paddingBottom: 40 },

  // Section label
  sectionLabel: {
    alignItems:   "center",
    gap:          12,
    marginBottom: 14,
  },
  sectionBadge: {
    width:           34,
    height:          34,
    borderRadius:    11,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  sectionEyebrow: {
    fontSize:           10,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.accentDeep,
    letterSpacing:      0.4,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  sectionTitle: {
    fontSize:           14,
    fontFamily:         theme.fonts.black,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    marginTop:          1,
    includeFontPadding: false,
  },

  // Add address CTA
  addCardBtnTouchable: {
    borderRadius: 18,
    marginTop:    14,
  },
  addCardBtn: {
    alignItems:      "center",
    gap:             14,
    padding:         16,
    borderRadius:    18,
    backgroundColor: kit.color.surface,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    borderStyle:     "dashed",
    ...kit.shadow.raised,
  },
  addCardBtnPressed: {
    backgroundColor: kit.color.accentTint,
    borderColor:     "rgba(14,126,116,0.30)",
  },
  addCardIcon: {
    width:           48,
    height:          48,
    borderRadius:    14,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  addCardLabel: {
    fontSize:           13,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  addCardDesc: {
    fontSize:           11,
    fontFamily:         theme.fonts.regular,
    color:              kit.color.inkFaint,
    marginTop:          2,
    includeFontPadding: false,
  },
});
