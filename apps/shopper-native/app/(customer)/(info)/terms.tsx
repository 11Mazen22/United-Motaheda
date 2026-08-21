import React from "react";

import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeInDown } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { theme } from "@pharmacy/design-tokens";

import { kit } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);

const WA_URL = `https://wa.me/201112343212?text=${encodeURIComponent("السلام عليكم، أحتاج إلى مساعدة بخصوص تطبيق صيدليات المتحدة. يرجى التواصل معي عند أقرب فرصة. شكراً لكم.")}`;



function openWhatsApp() {

  Linking.canOpenURL(WA_URL).then(ok => {

    if (ok) return Linking.openURL(WA_URL);

    Alert.alert("واتساب غير متاح", "تواصل معنا على البريد الإلكتروني:\nunited.pharmacy.eg@gmail.com", [{ text: "حسناً" }]);

  }).catch(() => Alert.alert("خطأ", "تعذّر فتح واتساب. يرجى المحاولة لاحقاً."));

}



function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {

  return (

    <Animated.View entering={FadeInDown.duration(350).delay(delay)} style={styles.sec}>

      <View style={styles.secHdr}>

        <View style={styles.secDot}><Ionicons name="document-text-outline" size={12} color={kit.color.accentDeep} /></View>

        <UIText style={styles.secTitle}>{title}</UIText>

      </View>

      <UIText style={styles.secBody}>{children}</UIText>

    </Animated.View>

  );

}



export default function TermsScreen() {

  const { t } = useTranslation(), router = useRouter(), insets = useSafeAreaInsets();



  return (

    <View style={[styles.screen, { paddingTop: insets.top }]}>

      <View style={styles.header}>

        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />

        </Pressable>

        <UIText style={styles.title}>{t("terms.title")}</UIText>

        <View style={{ width: 38 }} />

      </View>



      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(300)} style={styles.updated}>

          <Ionicons name="calendar-outline" size={15} color={kit.color.accentDeep} />

          <UIText style={styles.updatedT}>{t("terms.lastUpdated", { date: "2025" })}</UIText>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(350).delay(40)} style={styles.warn}>

          <Ionicons name="document-text" size={20} color={kit.color.warn} />

          <UIText style={styles.warnT}>{t("terms.agreeBanner")}</UIText>

        </Animated.View>



        <Section title="١. قبول الشروط" delay={80}>{`باستخدامك لتطبيق الصيدلية المتحدة أو خدماتها، تؤكد موافقتك الكاملة على هذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، فيرجى عدم استخدام التطبيق.

تسري هذه الشروط على جميع المستخدمين بما فيهم الزوار وأصحاب الحسابات، وتُقرأ جنباً إلى جنب مع سياسة الخصوصية.`}</Section>



        <Section title="٢. التسجيل والحساب" delay={120}>{`• يجب أن يكون عمرك ١٨ عاماً أو أكثر للتسجيل
• أنت مسؤول عن الحفاظ على سرية بيانات حسابك
• يجب إخطارنا فوراً عند الاشتباه في اختراق حسابك
• لا يحق لك إنشاء أكثر من حساب واحد
• نحتفظ بحق تعليق أو إلغاء أي حساب يُخالف هذه الشروط`}</Section>



        <Section title="٣. الطلبات والمنتجات" delay={160}>{`• جميع الأسعار المعروضة بالجنيه المصري وتشمل ضريبة القيمة المضافة
• تتوقف الأسعار على حالة المخزون وقد تتغير دون إشعار مسبق
• تأكيد الطلب مشروط بتوفر المنتج وصحة بيانات التوصيل
• لا تتوفر في التطبيق أدوية تستلزم وصفة طبية إلا من خلال القنوات الرسمية
• نحتفظ بحق رفض أي طلب أو إلغائه في حالات استثنائية مع استرداد كامل للمبلغ`}</Section>



        <Section title="٤. التوصيل والشحن" delay={200}>{`• رسوم التوصيل ٢٥ جنيهاً مصرياً لجميع الطلبات
• مواعيد التوصيل تقديرية وقد تتأثر بالظروف الخارجة عن إرادتنا
• يتحمل العميل مسؤولية صحة عنوان التوصيل المُدخَل
• عند غياب العميل وقت التوصيل، يُعاد التواصل معه لترتيب موعد بديل
• نتحمل المسؤولية الكاملة عن أي تلف يحدث للمنتجات أثناء الشحن`}</Section>



        <Section title="٥. الإرجاع والاسترداد" delay={240}>{`• يحق لك إرجاع المنتجات غير المفتوحة خلال ٧ أيام من الاستلام
• لا يُقبل إرجاع الأدوية والمستحضرات الصيدلانية المفتوحة لأسباب صحية وسلامة
• يُستثنى من الإرجاع المنتجات المبرّدة والعروض الخاصة ما لم تكن معيبة
• يتم رد المبلغ خلال ٥-٧ أيام عمل بنفس وسيلة الدفع الأصلية
• للتواصل بشأن الإرجاع: united.pharmacy.eg@gmail.com`}</Section>



        <Section title="٦. الملكية الفكرية" delay={280}>{`جميع محتويات التطبيق من شعارات وصور ونصوص وتصاميم هي ملكية حصرية للصيدلية المتحدة محمية بموجب قوانين حقوق النشر والملكية الفكرية. يُحظر نسخ أي محتوى أو إعادة توزيعه أو استخدامه تجارياً دون إذن كتابي مسبق.`}</Section>



        <Section title="٧. حدود المسؤولية" delay={320}>{`لن تكون الصيدلية المتحدة مسؤولة عن:
• أي أضرار غير مباشرة أو تبعية ناجمة عن استخدام التطبيق
• توقف الخدمة بسبب ظروف قاهرة أو صيانة مجدولة
• أخطاء المستخدم في إدخال بيانات الطلب أو العنوان
• استخدام الأدوية بشكل مخالف للتعليمات الطبية`}</Section>



        <Section title="٨. تعديل الشروط" delay={360}>{`نحتفظ بحق تعديل هذه الشروط في أي وقت. سنُعلمك بأي تغييرات جوهرية عبر إشعار داخل التطبيق قبل نفاذها. استمرار استخدامك للتطبيق بعد التعديل يُعدّ قبولاً منك للشروط المحدّثة.`}</Section>



        <Section title="٩. القانون المنطبق" delay={400}>{`تخضع هذه الشروط وتُفسَّر وفقاً لأحكام القانون المصري. أي نزاع ينشأ عن هذه الشروط يُحال للمحاكم المختصة في جمهورية مصر العربية.`}</Section>



        <Animated.View entering={FadeInDown.duration(350).delay(440)} style={styles.wa}>

          <View style={[styles.waIn, { flexDirection: flexRow(RTL) }]}> 

            <View style={styles.waIcon}><Ionicons name="logo-whatsapp" size={22} color="#25D366" /></View>

            <View style={{ flex: 1, gap: 2 }}>

              <UIText style={styles.waTitle}>{t("terms.supportTitle")}</UIText>

              <UIText style={styles.waSub}>{t("terms.supportSubtitle")}</UIText>

            </View>

            <Pressable style={styles.waBtnT} onPress={openWhatsApp} accessibilityRole="button" accessibilityLabel={t("terms.supportTitle")}>

              {({ pressed }) => <View style={[styles.waBtn, pressed && styles.waBtnP]}><UIText style={styles.waBtnTxt}>{t("terms.supportStart")}</UIText></View>}

            </Pressable>

          </View>

        </Animated.View>



        <UIText style={styles.foot}>{t("terms.footer")}</UIText>

      </ScrollView>

    </View>

  );

}



const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, ...kit.shadow.raised },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised },

  title: { fontSize: 22, fontFamily: theme.fonts.black, color: kit.color.ink },

  content: { padding: 20 },

  updated: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: RTL ? "flex-start" : "flex-end", gap: 6, marginBottom: 14 },

  updatedT: { fontSize: 13, fontFamily: theme.fonts.semibold, color: kit.color.accentDeep },

  warn: { flexDirection: flexRow(RTL), alignItems: "flex-start", gap: 10, backgroundColor: kit.color.warnTint, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(217,119,6,0.25)", marginBottom: 20 },

  warnT: { flex: 1, fontSize: 15, fontFamily: theme.fonts.semibold, color: kit.color.ink, textAlign: TA, lineHeight: 22 },

  sec: { marginBottom: 28 },

  secHdr: { flexDirection: flexRow(RTL), alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line },

  secDot: { width: 26, height: 26, borderRadius: 8, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: "rgba(14,126,116,0.20)", alignItems: "center", justifyContent: "center" },

  secTitle: { fontSize: 17, fontFamily: theme.fonts.black, color: kit.color.ink, flex: 1, textAlign: TA, letterSpacing: -0.3, includeFontPadding: false },

  secBody: { fontSize: 15, fontFamily: theme.fonts.regular, color: kit.color.inkSoft, textAlign: TA, lineHeight: 28, includeFontPadding: false },

  foot: { fontSize: 11, color: kit.color.inkFaint, textAlign: "center", paddingTop: 16 },



  wa: { backgroundColor: "#F0FFF7", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(37,211,102,0.25)", marginBottom: 24 },

  waIn: { alignItems: "center", gap: 12 },

  waIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(37,211,102,0.12)", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  waTitle: { fontSize: 15, fontFamily: theme.fonts.bold, color: kit.color.ink },

  waSub: { fontSize: 12, fontFamily: theme.fonts.regular, color: kit.color.inkSoft },

  waBtnT: { borderRadius: 10, flexShrink: 0 },

  waBtn: { backgroundColor: "#25D366", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },

  waBtnP: { backgroundColor: "#1FB859" },

  waBtnTxt: { fontSize: 13, fontFamily: theme.fonts.bold, color: "#fff" },

});
