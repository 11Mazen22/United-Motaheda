import React, { memo } from "react";
import { Modal, Pressable, View } from "react-native";
import { kit } from "@/shared/kit";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { tourStyles as s } from "./wallet.styles";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export const TOUR_STEPS: {
  icon:     IoniconsName;
  titleKey: string;
  bodyKey:  string;
}[] = [
  { icon: "wallet-outline",   titleKey: "loyalty.tourStep1Title", bodyKey: "loyalty.tourStep1Body" },
  { icon: "star-outline",     titleKey: "loyalty.tourStep2Title", bodyKey: "loyalty.tourStep2Body" },
  { icon: "pricetag-outline", titleKey: "loyalty.tourStep3Title", bodyKey: "loyalty.tourStep3Body" },
  { icon: "gift-outline",     titleKey: "loyalty.tourStep4Title", bodyKey: "loyalty.tourStep4Body" },
];

interface WalletTourModalProps {
  visible: boolean;
  step:    number;
  onNext:  () => void;
  onSkip:  () => void;
}

export const WalletTourModal = memo(function WalletTourModal({
  visible,
  step,
  onNext,
  onSkip,
}: WalletTourModalProps) {
  const { t } = useTranslation();
  const current = TOUR_STEPS[step]!;
  const isLast  = step === TOUR_STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      accessibilityViewIsModal>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.iconWrap}>
            <View style={[s.iconGrad, { backgroundColor: kit.color.accent }]}>
              <Ionicons name={current.icon} size={32} color="#fff" />
            </View>
          </View>

          <Text style={s.title}>{t(current.titleKey)}</Text>
          <Text style={s.body}>{t(current.bodyKey)}</Text>

          <View style={s.dots}>
            {TOUR_STEPS.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>

          <View style={s.actions}>
            <Pressable
              onPress={onSkip}
              style={s.skipBtn}
              accessibilityRole="button"
              accessibilityLabel={t("loyalty.tourSkipA11y")}>
              <Text style={s.skipText}>{t("loyalty.tourSkip")}</Text>
            </Pressable>
            <Pressable
              onPress={onNext}
              style={s.nextBtn}
              accessibilityRole="button"
              accessibilityLabel={
                isLast ? t("loyalty.tourFinishA11y") : t("loyalty.tourNextA11y")
              }>
              <View style={[s.nextGrad, { backgroundColor: kit.color.ink }]}>
                <Text style={s.nextText}>
                  {isLast ? t("loyalty.tourFinish") : t("loyalty.tourNext")}
                </Text>
                {!isLast && <Ionicons name="arrow-back" size={14} color="#fff" />}
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});
