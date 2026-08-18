/**
 * Component preview harness — dev-only.
 *
 * Renders every new shared molecule in each of its variants and key states.
 * Manual QA harness; keep updated as you add components.
 *
 * Open with: deep link /__preview/components, or `router.push("/__preview/components")`.
 * Returns a 404 outside __DEV__ so prod bundles can't reach it.
 */

import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@pharmacy/design-tokens";
import {
  AppHeader,
  RxCard,
  ReminderRow,
  InteractionBanner,
  type Prescription,
  type Reminder,
} from "@/shared/components";
import { Text } from "@pharmacy/ui-native";
import { Button } from "@pharmacy/ui-native";
import { EmptyState } from "@/components/ui/EmptyState";

const NOW = new Date().toISOString();
const UID = "preview-user";

const RX_READY: Prescription = {
  id: "rx-1", userId: UID, name: "ميتفورمين 500 مج", dose: "قرص × 2 يومياً مع الطعام",
  refills: 3, nextRefill: "20 يوليو 2026", doctor: "د. أحمد سامي",
  status: "ready", addedAt: NOW, updatedAt: NOW,
};

const RX_EXPIRING: Prescription = {
  id: "rx-2", userId: UID, name: "ليبيتور 20 مج", dose: "قرص واحد ليلاً",
  refills: 0, nextRefill: "خلال 4 أيام", doctor: "د. منى رشاد",
  status: "expiring", addedAt: NOW, updatedAt: NOW,
};

const RX_EXPIRED: Prescription = {
  id: "rx-3", userId: UID, name: "أوميبرازول 40 مج", dose: "قرص قبل الإفطار",
  refills: 0, nextRefill: "انتهى منذ 12 يوماً", doctor: "د. سامي ناصر",
  status: "expired", addedAt: NOW, updatedAt: NOW,
};

const REMINDER_PENDING: Reminder = {
  id: "rm-1", prescriptionId: "rx-1",
  name: "ميتفورمين 500 مج", doseNote: "قرص واحد · مع الطعام",
  time: "8:00 ص", due: "Today", taken: false,
};

const REMINDER_TAKEN: Reminder = {
  id: "rm-2", prescriptionId: "rx-2",
  name: "ليبيتور 20 مج", doseNote: "قرص واحد",
  time: "10:00 م", due: "Today", taken: true, takenAt: "2026-05-17T22:03:00Z",
};

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View style={{ gap: theme.spacing[1], marginBottom: theme.spacing[3] }}>
      <Text variant="eyebrow" color="brand" align="right">{title}</Text>
      {children}
    </View>
  );
}

export default function ComponentPreview(): React.ReactElement | null {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([REMINDER_PENDING, REMINDER_TAKEN]);

  if (!__DEV__) {
    // Hide the harness in production bundles.
    router.replace("/");
    return null;
  }

  const toggleReminder = (id: string, taken: boolean): void => {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, taken } : r));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: kit.color.bg }}>
        <AppHeader title="معاينة المكونات" showBack showCart={false} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: theme.spacing[2.5],
            gap: theme.spacing[2],
          }}>

          <Section title="RxCard · active">
            <RxCard prescription={RX_READY}    variant="active" />
            <View style={{ height: theme.spacing[1.5] }} />
            <RxCard prescription={RX_EXPIRING} variant="active" />
            <View style={{ height: theme.spacing[1.5] }} />
            <RxCard prescription={RX_EXPIRED}  variant="active" />
          </Section>

          <Section title="RxCard · list">
            <RxCard prescription={RX_READY}    variant="list" />
            <View style={{ height: theme.spacing[1] }} />
            <RxCard prescription={RX_EXPIRING} variant="list" />
            <View style={{ height: theme.spacing[1] }} />
            <RxCard prescription={RX_EXPIRED}  variant="list" />
          </Section>

          <Section title="ReminderRow">
            <View style={{ backgroundColor: kit.color.surface, borderRadius: theme.layout.cardRadius, borderWidth: 1, borderColor: kit.color.border.default }}>
              {reminders.map((r, i) => (
                <View key={r.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: kit.color.border.default }}>
                  <ReminderRow
                    reminder={r}
                    onToggle={toggleReminder}
                    onSnooze={() => {}}
                  />
                </View>
              ))}
            </View>
          </Section>

          <Section title="InteractionBanner · card (moderate)">
            <InteractionBanner
              severity="moderate"
              drugA={{ name: "وارفارين", dose: "5 مج", status: "current" }}
              drugB={{ name: "أيبوبروفين", dose: "400 مج", status: "new" }}
              summary="يزيد هذا التفاعل من خطر النزيف بشكل ملحوظ."
              detail="أيبوبروفين قد يقوّي تأثير وارفارين المضاد للتجلط، مما يرفع احتمالية النزيف الداخلي."
              watchFor={["كدمات غير معتادة", "نزيف اللثة", "براز داكن"]}
            />
          </Section>

          <Section title="InteractionBanner · full (severe)">
            <InteractionBanner
              severity="severe"
              variant="full"
              drugA={{ name: "ترامادول", dose: "50 مج", status: "current" }}
              drugB={{ name: "سيرترالين", dose: "100 مج", status: "new" }}
              summary="خطر متلازمة السيروتونين — تفاعل شديد."
              detail="الجمع بين هذين الدوائين قد يسبب ارتفاعاً خطيراً في مستويات السيروتونين."
              watchFor={["ارتباك ذهني", "تسارع ضربات القلب", "ارتفاع الحرارة"]}
              onAskPharmacist={() => {}}
              onCancel={() => {}}
              onProceed={() => {}}
            />
          </Section>

          <Section title="PrescriptionsList · live (dev seed)">
            <Button
              variant="primary"
              full
              onPress={() => router.push("/prescriptions" as never)}
              label="فتح /prescriptions"
            />
            <Text variant="caption" color="tertiary" align="right" style={{ marginTop: theme.spacing[1] }}>
              يعرض الوصفات المزروعة في وضع التطوير
            </Text>
          </Section>

          <Section title="AddRxEntry · live">
            <Button
              variant="secondary"
              full
              onPress={() => router.push("/prescriptions/add" as never)}
              label="فتح /prescriptions/add"
            />
            <Text variant="caption" color="tertiary" align="right" style={{ marginTop: theme.spacing[1] }}>
              4 بطاقات إدخال + ملاحظة المواد الخاضعة للرقابة
            </Text>
          </Section>

          <Section title="AddRxManual · live">
            <Button
              variant="secondary"
              full
              onPress={() => router.push("/prescriptions/manual" as never)}
              label="فتح /prescriptions/manual"
            />
            <Text variant="caption" color="tertiary" align="right" style={{ marginTop: theme.spacing[1] }}>
              جرّب 47820094 للبحث الناجح، أو أي 8 أرقام أخرى للحالة غير الموجودة
            </Text>
          </Section>



          <Section title="PrescriptionsList · empty state (static)">
            <View style={{ height: 320, backgroundColor: kit.color.surface, borderRadius: theme.layout.cardRadius, borderWidth: 1, borderColor: kit.color.border.default, overflow: "hidden" }}>
              <EmptyState
                icon="medkit-outline"
                title="لا توجد وصفات حالياً"
                description="أضف وصفتك الأولى — يمكنك مسحها بالكاميرا، أو نقلها من صيدلية أخرى"
                actionLabel="إضافة وصفة"
                onAction={() => {}}
              />
            </View>
          </Section>

          <Section title="InteractionBanner · card (mild)">
            <InteractionBanner
              severity="mild"
              drugA={{ name: "أموكسيسيلين", dose: "500 مج" }}
              drugB={{ name: "أوميبرازول", dose: "20 مج" }}
              summary="تفاعل خفيف — قد يقلل من فعالية المضاد الحيوي."
              watchFor={["بطء في التحسن"]}
            />
          </Section>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
