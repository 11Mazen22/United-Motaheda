import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import { useState } from "react";
import { Typography } from "./Typography";
import { Button } from "./Button";

export interface ErrorStateProps {
  message: string;
  retry?: () => void | Promise<void>;
  details?: string;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({ message, retry, details, style }: ErrorStateProps) {
  const [loading, setLoading] = useState(false);
  const handleRetry = async () => {
    if (!retry) return;
    setLoading(true);
    try { await retry(); } finally { setLoading(false); }
  };
  return (
    <View style={[styles.state, style]} accessibilityRole="alert">
      <View style={[styles.iconWrap, { backgroundColor: "#FEF2F2" }]}>
        <Typography scale="metric" color="danger">!</Typography>
      </View>
      <Typography scale="sectionHead" align="center">{message}</Typography>
      {details ? <Typography scale="body" color="secondary" align="center">{details}</Typography> : null}
      {retry ? <Button label="Retry" onPress={handleRetry} loading={loading} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
});
