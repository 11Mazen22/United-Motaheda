import React, { useCallback, useMemo, useState } from "react";

import { FlatList, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";


import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import * as Haptics from "expo-haptics";

import { useTranslation } from "react-i18next";

import { FAQAccordion, FAQCategoryRail } from "@/features/faq";

import { EmptyState } from "@/components/ui/EmptyState";

import { FAQ_DATA, FAQ_CATEGORIES, type FAQCategory, type FAQItem } from "@/features/faq";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);

const WA_URL = `https://wa.me/201112343212?text=${encodeURIComponent("مرحباً، لدي سؤال لم أجد إجابته في صفحة الأسئلة الشائعة.")}`;



function openSupport() {

  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});

  Linking.openURL(WA_URL).catch(() => {});

}



export default function FAQScreen() {

  const router = useRouter(), insets = useSafeAreaInsets(), { t } = useTranslation();

  const [query, setQuery] = useState("");

  const [cat, setCat] = useState<FAQCategory | "all">("all");

  const [expanded, setExpanded] = useState<string | null>(null);

  const [barH, setBarH] = useState(100);



  const counts = useMemo(() => {

    const c: Record<string, number> = { all: FAQ_DATA.length };

    FAQ_CATEGORIES.forEach(cat => { c[cat.key] = FAQ_DATA.filter(f => f.category === cat.key).length; });

    return c;

  }, []);



  const filtered = useMemo(() => {

    let items = FAQ_DATA;

    if (cat !== "all") items = items.filter(f => f.category === cat);

    if (query.trim()) { const q = query.trim().toLowerCase(); items = items.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)); }

    return items;

  }, [cat, query]);



  const toggle = useCallback((id: string) => setExpanded(p => p === id ? null : id), []);

  const renderItem = useCallback(({ item, index }: { item: FAQItem; index: number }) => (

    <FAQAccordion item={item} index={index} expanded={expanded === item.id} onToggle={() => toggle(item.id)} />

  ), [expanded, toggle]);



  return (

    <View style={[s.screen, { paddingTop: insets.top }]}> 



      <Animated.View entering={FadeIn.duration(220)} style={[s.header, { flexDirection: flexRow(RTL) }]}> 

        <Pressable onPress={() => router.back()} style={s.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

          <Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} />

        </Pressable>

        <View style={s.tile}><Ionicons name="help-circle-outline" size={22} color={theme.colors.brand.primary} /></View>

        <View style={{ flex: 1 }}>

          <UIText style={[s.hTitle, { textAlign: TA }]}>{t("faq.title")}</UIText>

          <UIText style={[s.hSub, { textAlign: TA }]}>{t("faq.subtitle", { q: FAQ_DATA.length, c: FAQ_CATEGORIES.length })}</UIText>

        </View>

      </Animated.View>



      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={s.searchWrap}>

        <View style={[s.searchBar, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />

          <TextInput value={query} onChangeText={setQuery} placeholder={t("faq.searchPlaceholder")} placeholderTextColor={theme.colors.text.muted} style={s.searchInput} textAlign={TA as "left" | "right"} />

          {query.length > 0 && <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("faq.clearSearch")}>

            <Ionicons name="close-circle" size={16} color={theme.colors.text.muted} />

          </Pressable>}

        </View>

      </Animated.View>



      <View style={s.rail}><FAQCategoryRail selected={cat} onSelect={setCat} counts={counts} /></View>



      <FlatList data={filtered} keyExtractor={i => i.id} renderItem={renderItem}

        contentContainerStyle={[s.list, { paddingBottom: barH + 20 }]} showsVerticalScrollIndicator={false}

        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}

        ListHeaderComponent={filtered.length > 0 ? <Animated.View entering={FadeIn.duration(200)} style={s.results}>

          <UIText style={[s.resultsT, { textAlign: TA }]}>{t("faq.resultCount", { count: filtered.length })}{query ? ` ${t("faq.forQuery", { q: query })}` : ""}</UIText>

        </Animated.View> : null}

        ListEmptyComponent={<View style={{ paddingTop: 40 }}><EmptyState icon="help-circle-outline" title={t("faq.noResults")} description={query ? t("faq.noResultsInQuery") : t("faq.noResultsInCat")} /></View>}

      />



      <Animated.View entering={FadeInDown.duration(300)} onLayout={e => setBarH(e.nativeEvent.layout.height)}

        style={[s.contactBar, { paddingBottom: insets.bottom + 12 }]}> 

        <View style={[s.contactRow, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.brand.primary} />

          <UIText style={[s.contactTxt, { textAlign: TA }]}>{t("faq.notFound")}</UIText>

          <Pressable onPress={openSupport} style={s.contactBtnT} accessibilityRole="button" accessibilityLabel={t("faq.contactUs")}>

            {({ pressed }) => <View style={[s.contactBtn, { flexDirection: flexRow(RTL) }, pressed && s.contactBtnP]}> 

              <UIText style={s.contactBtnTxt}>{t("faq.contactUs")}</UIText>

              <Ionicons name={FORWARD_CHEVRON} size={12} color={theme.colors.brand.primary} />

            </View>}

          </Pressable>

        </View>

      </Animated.View>

    </View>

  );

}



const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  header: { alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default, ...theme.shadows[1] },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.canvas.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1], flexShrink: 0 },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: legacyTheme.fonts.black, fontSize: 18, letterSpacing: -0.3, color: theme.colors.text.primary, includeFontPadding: false },

  hSub: { fontFamily: legacyTheme.fonts.semibold, fontSize: 11, color: theme.colors.text.muted, includeFontPadding: false },



  searchWrap: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: theme.colors.canvas.background },

  searchBar: { alignItems: "center", gap: 10, backgroundColor: theme.colors.canvas.surfaceMuted, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: theme.colors.border.default },

  searchInput: { flex: 1, fontFamily: legacyTheme.fonts.regular, fontSize: 13, color: theme.colors.text.primary, paddingVertical: 0, includeFontPadding: false } as unknown as never,



  rail: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default, backgroundColor: theme.colors.canvas.background },

  list: { padding: 20 },

  results: { marginBottom: 12 },

  resultsT: { fontFamily: legacyTheme.fonts.semibold, fontSize: 11, color: theme.colors.text.muted, includeFontPadding: false },



  contactBar: { position: "absolute", bottom: 0, start: 0, end: 0, backgroundColor: theme.colors.canvas.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border.default, paddingTop: 12, paddingHorizontal: 20, ...theme.shadows[1] },

  contactRow: { alignItems: "center", gap: 8 },

  contactTxt: { flex: 1, fontFamily: legacyTheme.fonts.semibold, fontSize: 12, color: theme.colors.text.secondary, includeFontPadding: false },

  contactBtnT: { borderRadius: 10, flexShrink: 0 },

  contactBtn: { alignItems: "center", gap: 4, backgroundColor: theme.colors.brand.primaryLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border.default },

  contactBtnP: { backgroundColor: theme.colors.border.default },

  contactBtnTxt: { fontFamily: legacyTheme.fonts.bold, fontSize: 11, color: theme.colors.brand.primary, includeFontPadding: false },

});
