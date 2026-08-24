/**
 * DriverApplicationScreen — 2-step "become a driver" wizard (vehicle info,
 * then document uploads). UX shape is a direct reference from
 * courier-mobile's app/(auth)/register.tsx, rebuilt with shopper-native's
 * own theme/components rather than CourierUI, and with no account-creation
 * step — the applicant is always an already-authenticated user.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { Screen, Text as UIText, Input, Button, SegmentedToggle, useTheme, kit, showToast } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { uploadDriverDocument, type DriverDocumentType } from "../api";
import { useCreateDriverApplication } from "../hooks/useDriverProfile";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type VehicleType = "motorcycle" | "car" | "van";

const DOCUMENTS: { type: DriverDocumentType; labelKey: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { type: "license", labelKey: "driverApplication.docLicense", icon: "card-outline" },
  { type: "id", labelKey: "driverApplication.docId", icon: "id-card-outline" },
  { type: "vehicle", labelKey: "driverApplication.docVehicle", icon: "car-outline" },
  { type: "insurance", labelKey: "driverApplication.docInsurance", icon: "shield-checkmark-outline" },
];

async function pickAndUpload(userId: string, type: DriverDocumentType): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  return uploadDriverDocument(userId, type, result.assets[0].uri);
}

export function DriverApplicationScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const createApplication = useCreateDriverApplication(user?.id);

  const [step, setStep] = useState(0);
  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [documents, setDocuments] = useState<Partial<Record<DriverDocumentType, string>>>({});
  const [uploadingType, setUploadingType] = useState<DriverDocumentType | null>(null);

  const vehicleStepValid = vehiclePlate.trim().length >= 2 && vehicleModel.trim().length >= 2 && vehicleColor.trim().length >= 2;
  const allDocumentsUploaded = DOCUMENTS.every((d) => Boolean(documents[d.type]));

  const handlePickDocument = async (type: DriverDocumentType) => {
    if (!user?.id) return;
    setUploadingType(type);
    try {
      const url = await pickAndUpload(user.id, type);
      if (url) setDocuments((prev) => ({ ...prev, [type]: url }));
    } catch {
      showToast(t("driverApplication.uploadFailed"), "error");
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id || !allDocumentsUploaded) return;
    try {
      await createApplication.mutateAsync({
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        licensePhotoUrl: documents.license!,
        idPhotoUrl: documents.id!,
        vehiclePhotoUrl: documents.vehicle!,
        insurancePhotoUrl: documents.insurance!,
      });
      router.replace("/driver-application" as never);
    } catch {
      showToast(t("driverApplication.submitFailed"), "error");
    }
  };

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader
        title={t("driverApplication.title")}
        subtitle={step === 0 ? t("driverApplication.step1Subtitle") : t("driverApplication.step2Subtitle")}
      />

      <View style={s.stepRow}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              s.stepDot,
              i < step
                ? { backgroundColor: theme.colors.status.success }
                : i === step
                  ? { backgroundColor: theme.colors.brand.primary }
                  : { backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default },
            ]}
          >
            {i < step ? <Ionicons name="checkmark" size={14} color="#fff" /> : <UIText style={{ color: i === step ? "#fff" : theme.colors.text.muted, fontSize: 12 }}>{i + 1}</UIText>}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <View>
            <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginBottom: 8 }}>
              {t("driverApplication.vehicleTypeLabel")}
            </UIText>
            <SegmentedToggle<VehicleType>
              value={vehicleType}
              onChange={setVehicleType}
              options={[
                { value: "motorcycle", label: t("driverApplication.vehicleMotorcycle"), icon: "bicycle-outline" },
                { value: "car", label: t("driverApplication.vehicleCar"), icon: "car-outline" },
                { value: "van", label: t("driverApplication.vehicleVan"), icon: "bus-outline" },
              ]}
            />

            <View style={{ height: 16 }} />
            <Input label={t("driverApplication.plateLabel")} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
            <View style={{ height: 12 }} />
            <Input label={t("driverApplication.modelLabel")} value={vehicleModel} onChangeText={setVehicleModel} />
            <View style={{ height: 12 }} />
            <Input label={t("driverApplication.colorLabel")} value={vehicleColor} onChangeText={setVehicleColor} />

            <View style={{ height: 24 }} />
            <Button label={t("common.next")} onPress={() => setStep(1)} disabled={!vehicleStepValid} fullWidth />
          </View>
        ) : (
          <View>
            {DOCUMENTS.map((doc) => {
              const uploaded = Boolean(documents[doc.type]);
              const uploading = uploadingType === doc.type;
              return (
                <Pressable
                  key={doc.type}
                  onPress={() => void handlePickDocument(doc.type)}
                  disabled={uploading}
                  style={[s.docRow, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surface, borderColor: uploaded ? theme.colors.status.success : theme.colors.border.default }]}
                  accessibilityRole="button"
                >
                  <View style={[s.docIcon, { backgroundColor: uploaded ? `${theme.colors.status.success}1A` : theme.colors.brand.primaryLight }]}>
                    <Ionicons name={uploaded ? "checkmark-circle" : doc.icon} size={18} color={uploaded ? theme.colors.status.success : theme.colors.brand.primary} />
                  </View>
                  <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>{t(doc.labelKey)}</UIText>
                  <UIText variant="caption" color={uploaded ? theme.colors.status.success : "secondary"}>
                    {uploading ? t("driverApplication.uploading") : uploaded ? t("driverApplication.uploaded") : t("driverApplication.tapToUpload")}
                  </UIText>
                </Pressable>
              );
            })}

            <View style={{ height: 24 }} />
            <Button
              label={t("driverApplication.submit")}
              onPress={() => void handleSubmit()}
              disabled={!allDocumentsUploaded || createApplication.isPending}
              loading={createApplication.isPending}
              fullWidth
            />
            <View style={{ height: 8 }} />
            <Button label={t("common.back")} variant="ghost" onPress={() => setStep(0)} fullWidth />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 12 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: kit.inset.screen, paddingBottom: 60 },
  docRow: { alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  docIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
