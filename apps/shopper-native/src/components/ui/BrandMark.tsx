import React from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from "react-native-svg";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { Text as UIText } from "@pharmacy/ui-native";

type BrandMarkSize    = "sm" | "md" | "lg" | "xl";
type BrandMarkVariant = "onHero" | "onLight";

interface BrandMarkProps {
  size?:      BrandMarkSize;
  variant?:   BrandMarkVariant;
  showText?:  boolean;
  showSlogan?: boolean;
}

const SIZE_MAP: Record<BrandMarkSize, { logo: number; gap: number; titleSize: number; sloganSize: number }> = {
  sm: { logo: 52,  gap: 7,  titleSize: 13, sloganSize: 9  },
  md: { logo: 68,  gap: 9,  titleSize: 16, sloganSize: 10 },
  lg: { logo: 86,  gap: 11, titleSize: 20, sloganSize: 11 },
  xl: { logo: 108, gap: 13, titleSize: 25, sloganSize: 12 },
};

function PharmacyLogoMark({ size }: { size: number }) {
  const s = size;
  const r = s * 0.26;   // corner radius of outer square
  const cw = s * 0.22;  // cross bar width (pill thickness)
  const cl = s * 0.72;  // cross bar length
  const cx = (s - cw) / 2;
  const cy = (s - cl) / 2;
  const rx = s * 0.12;  // corner radius of pill bars

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        {/* Deep navy background */}
        <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor={theme.colors.hero} />
          <Stop offset="100%" stopColor="#053348" />
        </LinearGradient>
        {/* Teal cross gradient */}
        <LinearGradient id="crossGrad" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0%"   stopColor={kit.color.accentTint} />
          <Stop offset="50%"  stopColor={kit.color.accent} />
          <Stop offset="100%" stopColor={kit.color.accentDeep} />
        </LinearGradient>
        {/* Shimmer gradient (top-left light catch) */}
        <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </LinearGradient>
      </Defs>

      {/* Outer rounded square — dark navy */}
      <Rect x="0" y="0" width={s} height={s} rx={r} fill="url(#bgGrad)" />

      {/* Subtle shimmer highlight in top-left corner */}
      <Path
        d={`M ${r} 0 L ${s * 0.7} 0 Q ${s * 0.5} ${s * 0.18} ${s * 0.18} ${s * 0.5} Q 0 ${s * 0.5} 0 ${r} Z`}
        fill="url(#shimmer)"
      />

      {/* Vertical pill bar */}
      <Rect x={cx} y={cy} width={cw} height={cl} rx={rx} fill="url(#crossGrad)" />

      {/* Horizontal pill bar */}
      <Rect x={cy} y={cx} width={cl} height={cw} rx={rx} fill="url(#crossGrad)" />

      {/* Center square fill (blends the intersection cleanly) */}
      <Rect x={cx} y={cx} width={cw} height={cw} fill={kit.color.accent} />

      {/* Tiny center dot highlight */}
      <Circle cx={s / 2} cy={s / 2} r={s * 0.045} fill="rgba(255,255,255,0.55)" />

      {/* Bottom-right subtle border arc accent (brand teal ring) */}
      <Circle
        cx={s / 2}
        cy={s / 2}
        r={s * 0.46}
        fill="none"
        stroke="rgba(6,182,212,0.18)"
        strokeWidth={s * 0.025}
      />
    </Svg>
  );
}

export function BrandMark({
  size      = "md",
  variant   = "onHero",
  showText  = false,
  showSlogan = false,
}: BrandMarkProps) {
  const s          = SIZE_MAP[size];
  const isOnHero   = variant === "onHero";
  const textColor  = isOnHero ? "#fff" : theme.colors.slate[900];
  const subtleColor = isOnHero ? "rgba(255,255,255,0.50)" : theme.colors.slate[400];

  return (
    <View style={{ alignItems: "center", gap: s.gap }}>
      <PharmacyLogoMark size={s.logo} />

      {showText && (
        <View style={{ alignItems: "center", gap: 3 }}>
          <UIText
            style={{
              color:         textColor,
              fontSize:      s.titleSize,
              fontFamily:    theme.fonts.black,
              letterSpacing: 0.2,
            }}>
            صيدليات المتحدة
          </UIText>
          {showSlogan && (
            <UIText
              style={{
                color:         subtleColor,
                fontSize:      s.sloganSize,
                fontFamily:    theme.fonts.semibold,
                letterSpacing: 1.6,
              }}>
              لكل داء دواء
            </UIText>
          )}
        </View>
      )}
    </View>
  );
}
