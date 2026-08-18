import React from "react";
import { View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { summaryStyles as s } from "./checkout.styles";

interface SummaryRowProps {
  label:      string;
  value:      string;
  valueColor?: string;
}

export const SummaryRow = React.memo(function SummaryRow({
  label,
  value,
  valueColor,
}: SummaryRowProps) {
  return (
    <View style={s.row}>
      <UIText variant="body-sm" color="secondary">
        {label}
      </UIText>
      <UIText
        variant="body-sm"
        weight="bold"
        style={{ color: valueColor ?? kit.color.ink }}>
        {value}
      </UIText>
    </View>
  );
});
