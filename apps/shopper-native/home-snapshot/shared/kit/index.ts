export const kit = {
  // minimal kit stub used by snapshot components
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, "3xl": 48 },
  sp: (n: number) => n * 4,
  color: { 
    danger: "#ff4d4f", ink: "#07122a", inkSoft: "#475569", surface: "#fff", line: "#e6eef6",
    accentTint: "#e6f7f8", accentDeep: "#0ea5b7", warnTint: "#fff7ed", warn: "#f59e0b",
    successTint: "#ecfdf5", success: "#059669", inkFaint: "#94a3b8", accent: "#06b6d4", onInk: "#fff", dangerTint: "#fff1f0"
  },
  radius: { pill: 999, card: 12 },
  shadow: { raised: {} as any },
  type: { title: { fontSize: 20, lineHeight: 26 } },
};
