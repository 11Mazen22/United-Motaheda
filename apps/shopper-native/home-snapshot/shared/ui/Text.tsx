import React from "react";
import { StyleSheet, Text as RNText } from "react-native";
import { theme } from "../theme";

export function Text(props: any) {
  const { children, style, ...rest } = props;
  return (
    <RNText {...rest} style={[{ color: theme.colors.text.primary }, style]}>{children}</RNText>
  );
}

export default Text;
