import React from "react";
import { View } from "react-native";
import { Text as UIText } from "../shared/ui/Text";

export function CategoryCard({ category }: any) {
  return (
    <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#fff" }}>
      <UIText>{category?.name ?? "Category"}</UIText>
    </View>
  );
}
