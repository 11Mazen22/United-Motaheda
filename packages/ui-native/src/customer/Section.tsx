import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Typography';
import { Divider } from './Surface';
import { useLuxuryTheme } from './useLuxuryTheme';

export interface SectionProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Section({
  title,
  subtitle,
  action,
  children,
  style,
  contentStyle,
}: SectionProps) {
  const { lx } = useLuxuryTheme();

  const hasHeader = title || subtitle || action;

  return (
    <View style={[{ marginBottom: lx.space.sectionGap }, style]}>
      {hasHeader && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: lx.space[4],
            marginBottom: lx.space[4],
            paddingHorizontal: lx.space.screenH,
          }}
        >
          <View style={{ flex: 1 }}>
            {title && (
              <T scale="sectionHead" color="primary">
                {title}
              </T>
            )}
            {subtitle && (
              <T scale="bodySm" color="secondary" style={{ marginTop: lx.space[0.5] }}>
                {subtitle}
              </T>
            )}
          </View>
          {action && <View>{action}</View>}
        </View>
      )}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

export interface SectionSeparatorProps {
  style?: StyleProp<ViewStyle>;
}

export function SectionSeparator({ style }: SectionSeparatorProps) {
  const { lx } = useLuxuryTheme();
  return (
    <View style={[{ marginVertical: lx.space.sectionGap }, style]}>
      <Divider />
    </View>
  );
}
