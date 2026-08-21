import { View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Typography';
import { useLuxuryTheme } from './useLuxuryTheme';

export interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, variant = 'default', size = 'md', style }: BadgeProps) {
  const { theme, lx, surface } = useLuxuryTheme();

  let bg: string = surface.s3;
  let color: string = 'primary';

  switch (variant) {
    case 'success':
      bg = theme.colors.status.success;
      color = 'inverse';
      break;
    case 'warning':
      bg = theme.colors.status.warning;
      color = 'inverse';
      break;
    case 'danger':
      bg = theme.colors.status.error;
      color = 'inverse';
      break;
    case 'info':
      bg = theme.colors.status.info;
      color = 'inverse';
      break;
    case 'brand':
      bg = theme.colors.brand.primary;
      color = 'inverse';
      break;
  }

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: lx.radius.badge,
          paddingHorizontal: size === 'sm' ? lx.space[1.5] : lx.space[2],
          paddingVertical: size === 'sm' ? lx.space[0.5] : lx.space[1],
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <T scale="badge" color={color}>
        {label}
      </T>
    </View>
  );
}

export interface DotBadgeProps {
  count?: number;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function DotBadge({ count, visible = true, style }: DotBadgeProps) {
  const { theme, lx } = useLuxuryTheme();

  if (!visible) return null;

  const hasCount = count !== undefined && count > 0;
  const displayCount = hasCount ? (count > 99 ? '99+' : count.toString()) : '';

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.status.error,
          borderRadius: lx.radius.pill,
          minWidth: hasCount ? 16 : 8,
          height: hasCount ? 16 : 8,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: hasCount ? 4 : 0,
        },
        style,
      ]}
    >
      {hasCount && (
        <T scale="badge" color="inverse" style={{ fontSize: 9, lineHeight: 12 }}>
          {displayCount}
        </T>
      )}
    </View>
  );
}
