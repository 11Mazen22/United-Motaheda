import React, { useMemo } from "react";

import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import type { NativeTheme } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeInDown } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { theme as legacyTheme } from "@pharmacy/design-tokens";


import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);



function Section({ title, children, delay = 0, theme, styles }: { title: string; children: React.ReactNode; delay?: number; theme: NativeTheme; styles: ReturnType<typeof getStyles> }) {

  return (

    <Animated.View entering={FadeInDown.duration(350).delay(delay)} style={styles.sec}>

      <View style={styles.secHdr}>

        <View style={styles.secDot}><Ionicons name="shield-checkmark-outline" size={12} color={theme.colors.brand.primary} /></View>

        <UIText style={styles.secTitle}>{title}</UIText>

      </View>

      <UIText style={styles.secBody}>{children}</UIText>

    </Animated.View>

  );

}



export default function PrivacyScreen() {

  const { t } = useTranslation(), router = useRouter(), insets = useSafeAreaInsets();

  const { theme } = useTheme();

  const styles = useMemo(() => getStyles(theme), [theme]);



  return (

    <View style={[styles.screen, { paddingTop: insets.top }]}>

      <View style={styles.header}>

        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

          <Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} />

        </Pressable>

        <UIText style={styles.title}>{t("privacy.title")}</UIText>

        <View style={{ width: 38 }} />

      </View>



      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(300)} style={styles.updated}>

          <Ionicons name="calendar-outline" size={15} color={theme.colors.brand.primary} />

          <UIText style={styles.updatedT}>{t("privacy.lastUpdated", { date: "2025" })}</UIText>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(350).delay(40)} style={styles.intro}>

          <Ionicons name="shield-checkmark" size={20} color={theme.colors.brand.primary} />

          <UIText style={styles.introT}>{t("privacy.introBanner")}</UIText>

        </Animated.View>



        <Section title="١. المعلومات التي نجمعها" delay={80} theme={theme} styles={styles}>{`نجمع المعلومات التي تقدمها مباشرةً عند إنشاء حسابك أو تقديم طلب، وتشمل:
• الاسم الكامل وعنوان البريد الإلكتروني
• رقم الهاتف وعنوان التوصيل
• سجل الطلبات والمنتجات المفضلة

كما نجمع بيانات الاستخدام التلقائية مثل نوع الجهاز ونظام التشغيل والصفحات التي تزورها داخل التطبيق، وذلك لتحسين تجربتك.`}</Section>



        <Section title="٢. كيف نستخدم بياناتك" delay={120} theme={theme} styles={styles}>{`نستخدم معلوماتك للأغراض التالية:
• تنفيذ طلباتك وتتبع الشحنات والتواصل معك بشأنها
• تخصيص عروض المنتجات وتوصياتها وفق اهتماماتك
• إرسال إشعارات هامة تتعلق بطلباتك وحسابك
• تحسين خدماتنا وتطوير ميزات التطبيق
• الامتثال للمتطلبات القانونية والتنظيمية

لن نستخدم بياناتك لأغراض تسويقية دون موافقتك الصريحة.`}</Section>



        <Section title="٣. مشاركة البيانات مع الأطراف الثالثة" delay={160} theme={theme} styles={styles}>{`لا نبيع معلوماتك الشخصية لأطراف ثالثة. قد نشارك بياناتك بشكل محدود في الحالات الآتية:
• شركات الشحن والتوصيل لتنفيذ طلباتك
• مزودو خدمة الدفع الإلكتروني لمعالجة المعاملات المالية بأمان
• الجهات الحكومية والتنظيمية عند الاقتضاء القانوني

نلزم جميع شركاءنا بسياسات خصوصية صارمة وعدم إعادة استخدام بياناتك.`}</Section>



        <Section title="٤. أمان البيانات" delay={200} theme={theme} styles={styles}>{`نطبّق معايير أمان متقدمة لحماية بياناتك، تشمل:
• تشفير SSL/TLS لجميع البيانات المنقولة
• تشفير كلمات المرور باستخدام خوارزميات bcrypt
• مراجعات أمنية دورية لقاعدة البيانات والبنية التحتية
• التحقق الثنائي للعمليات الحساسة

رغم جهودنا الكاملة، لا يمكن ضمان أمان مطلق عبر الإنترنت، وننصحك بالحفاظ على سرية كلمة مرورك.`}</Section>



        <Section title="٥. ملفات التعريف (Cookies)" delay={240} theme={theme} styles={styles}>{`يستخدم التطبيق تقنيات تخزين محلية مشابهة للـ Cookies لحفظ:
• بيانات جلسة تسجيل الدخول
• محتويات سلة التسوق
• التفضيلات الشخصية مثل اللغة والمنطقة

هذه البيانات تُخزَّن على جهازك فقط ولا تُرسَل إلى أطراف ثالثة.`}</Section>



        <Section title="٦. حقوقك" delay={280} theme={theme} styles={styles}>{`يحق لك في أي وقت:
• الاطلاع على بياناتك الشخصية المحفوظة لدينا
• تصحيح أي معلومات غير دقيقة
• طلب حذف حسابك وجميع بياناتك
• إلغاء الاشتراك في الرسائل التسويقية
• الاعتراض على معالجة بياناتك لأغراض معينة

للتواصل حول هذه الحقوق: united.pharmacy.eg@gmail.com`}</Section>



        <Section title="٧. الاحتفاظ بالبيانات" delay={320} theme={theme} styles={styles}>{`نحتفظ ببياناتك طالما كان حسابك نشطاً أو لفترة ضرورية لتقديم خدماتنا. عند حذف حسابك، تُحذف بياناتك الشخصية خلال ٣٠ يوماً، باستثناء ما يُلزمنا القانون بالاحتفاظ به لأغراض ضريبية أو تنظيمية.`}</Section>



        <Section title="٨. تعديلات السياسة" delay={360} theme={theme} styles={styles}>{`نحتفظ بحق تعديل هذه السياسة في أي وقت. سنُعلمك بأي تغييرات جوهرية عبر إشعار داخل التطبيق أو البريد الإلكتروني قبل نفاذ التعديل بـ ٧ أيام على الأقل. استمرار استخدامك للتطبيق بعد التعديل يُعدّ قبولاً منك للسياسة المحدّثة.`}</Section>



        <UIText style={styles.foot}>{t("privacy.footer")}</UIText>

      </ScrollView>

    </View>

  );

}



function getStyles(theme: NativeTheme) {

  return StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  header: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default, ...theme.shadows[1] },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.canvas.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1] },

  title: { fontSize: 22, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary },

  content: { padding: 20 },

  updated: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: RTL ? "flex-start" : "flex-end", gap: 6, marginBottom: 14 },

  updatedT: { fontSize: 13, fontFamily: legacyTheme.fonts.semibold, color: theme.colors.brand.primary },

  intro: { flexDirection: flexRow(RTL), alignItems: "flex-start", gap: 10, backgroundColor: theme.colors.brand.primaryLight, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(14,126,116,0.20)", marginBottom: 20 },

  introT: { flex: 1, fontSize: 15, fontFamily: legacyTheme.fonts.semibold, color: theme.colors.text.primary, textAlign: TA, lineHeight: 22 },

  sec: { marginBottom: 28 },

  secHdr: { flexDirection: flexRow(RTL), alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default },

  secDot: { width: 26, height: 26, borderRadius: 8, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: "rgba(14,126,116,0.20)", alignItems: "center", justifyContent: "center" },

  secTitle: { fontSize: 17, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, flex: 1, textAlign: TA, letterSpacing: -0.3, includeFontPadding: false },

  secBody: { fontSize: 15, fontFamily: legacyTheme.fonts.regular, color: theme.colors.text.secondary, textAlign: TA, lineHeight: 28, includeFontPadding: false },

  foot: { fontSize: 11, color: theme.colors.text.muted, textAlign: "center", paddingTop: 16 },

  });

}
