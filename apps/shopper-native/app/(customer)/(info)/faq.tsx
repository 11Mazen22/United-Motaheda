import React, { useCallback, useMemo, useState } from "react";

import { FlatList, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import { kit } from "@pharmacy/ui-native";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import * as Haptics from "expo-haptics";

import { useTranslation } from "react-i18next";

import { FAQAccordion, FAQCategoryRail } from "@/features/faq";

import { EmptyState } from "@/components/ui/EmptyState";

import { FAQ_DATA, FAQ_CATEGORIES, type FAQCategory, type FAQItem } from "@/features/faq";

import { theme } from "@pharmacy/design-tokens";

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

          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />

        </Pressable>

        <View style={s.tile}><Ionicons name="help-circle-outline" size={22} color={kit.color.accentDeep} /></View>

        <View style={{ flex: 1 }}>

          <UIText style={[s.hTitle, { textAlign: TA }]}>{t("faq.title")}</UIText>

          <UIText style={[s.hSub, { textAlign: TA }]}>{t("faq.subtitle", { q: FAQ_DATA.length, c: FAQ_CATEGORIES.length })}</UIText>

        </View>

      </Animated.View>



      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={s.searchWrap}>

        <View style={[s.searchBar, { flexDirection: flexRow(RTL) }]}> 

          <Ionicons name="search-outline" size={16} color={kit.color.inkFaint} />

          <TextInput value={query} onChangeText={setQuery} placeholder={t("faq.searchPlaceholder")} placeholderTextColor={kit.color.inkFaint} style={s.searchInput} textAlign={TA as "left" | "right"} />

          {query.length > 0 && <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("faq.clearSearch")}>

            <Ionicons name="close-circle" size={16} color={kit.color.inkFaint} />

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

          <Ionicons name="chatbubbles-outline" size={16} color={kit.color.accentDeep} />

          <UIText style={[s.contactTxt, { textAlign: TA }]}>{t("faq.notFound")}</UIText>

          <Pressable onPress={openSupport} style={s.contactBtnT} accessibilityRole="button" accessibilityLabel={t("faq.contactUs")}>

            {({ pressed }) => <View style={[s.contactBtn, { flexDirection: flexRow(RTL) }, pressed && s.contactBtnP]}> 

              <UIText style={s.contactBtnTxt}>{t("faq.contactUs")}</UIText>

              <Ionicons name={FORWARD_CHEVRON} size={12} color={kit.color.accentDeep} />

            </View>}

          </Pressable>

        </View>

      </Animated.View>

    </View>

  );

}



const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: { alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, ...kit.shadow.raised },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised, flexShrink: 0 },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: theme.fonts.black, fontSize: 18, letterSpacing: -0.3, color: kit.color.ink, includeFontPadding: false },

  hSub: { fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, includeFontPadding: false },



  searchWrap: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: kit.color.canvas },

  searchBar: { alignItems: "center", gap: 10, backgroundColor: kit.color.well, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: kit.color.line },

  searchInput: { flex: 1, fontFamily: theme.fonts.regular, fontSize: 13, color: kit.color.ink, paddingVertical: 0, includeFontPadding: false } as unknown as never,



  rail: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, backgroundColor: kit.color.canvas },

  list: { padding: 20 },

  results: { marginBottom: 12 },

  resultsT: { fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, includeFontPadding: false },



  contactBar: { position: "absolute", bottom: 0, start: 0, end: 0, backgroundColor: kit.color.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: kit.color.line, paddingTop: 12, paddingHorizontal: 20, ...kit.shadow.raised },

  contactRow: { alignItems: "center", gap: 8 },

  contactTxt: { flex: 1, fontFamily: theme.fonts.semibold, fontSize: 12, color: kit.color.inkSoft, includeFontPadding: false },

  contactBtnT: { borderRadius: 10, flexShrink: 0 },

  contactBtn: { alignItems: "center", gap: 4, backgroundColor: kit.color.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: kit.color.line },

  contactBtnP: { backgroundColor: kit.color.line },

  contactBtnTxt: { fontFamily: theme.fonts.bold, fontSize: 11, color: kit.color.accentDeep, includeFontPadding: false },

});
