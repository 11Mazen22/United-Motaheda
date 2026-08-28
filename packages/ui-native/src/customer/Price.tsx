import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { T } from './Typography';
import { Badge } from './Badge';
import { useLuxuryTheme } from './useLuxuryTheme';

export interface PriceProps {
  amount: number;
  currency?: string;
  size?: 'lg' | 'md' | 'sm';
  color?: string;
  strikethrough?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Price({ amount, currency = 'EGP', size = 'md', color, strikethrough, style }: PriceProps) {
  const { isRTL, theme } = useLuxuryTheme();

  const scale = size === 'lg' ? 'priceLg' : size === 'sm' ? 'priceSm' : 'priceMd';
  const resolvedScale = strikethrough ? 'priceStruck' : scale;
  const resolvedColor = color || (strikethrough ? theme.colors.text.muted : theme.colors.text.primary);

  const formatted = Number(amount).toFixed(2);
  const text = isRTL ? `${formatted} ${currency}` : `${currency} ${formatted}`;

  return (
    <T
      scale={resolvedScale}
      color={resolvedColor}
      style={[strikethrough && { textDecorationLine: 'line-through' }, style]}
    >
      {text}
    </T>
  );
}

export interface PriceRowProps {
  current: number;
  original?: number;
  currency?: string;
  size?: 'lg' | 'md' | 'sm';
  discountLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function PriceRow({ current, original, currency, size, discountLabel, style }: PriceRowProps) {
  const { lx } = useLuxuryTheme();

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: lx.space[2] }, style]}>
      <Price amount={current} currency={currency} size={size} />
      {original !== undefined && original > current && (
        <Price amount={original} currency={currency} size="sm" strikethrough />
      )}
      {discountLabel && <Badge label={discountLabel} variant="danger" size="sm" />}
    </View>
  );
}

export interface DeliveryThresholdProps {
  cost: number;
  isFree: boolean;
  amountToFree?: number;
  currency?: string;
  style?: StyleProp<ViewStyle>;
}

export function DeliveryThreshold({ cost, isFree, amountToFree, currency = 'EGP', style }: DeliveryThresholdProps) {
  const { lx } = useLuxuryTheme();

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: lx.space[2] }, style]}>
      <T scale="bodySm" color={isFree ? 'success' : 'primary'}>
        {isFree ? 'Free delivery' : `Delivery: ${cost.toFixed(2)} ${currency}`}
      </T>
      {amountToFree !== undefined && amountToFree > 0 && !isFree && (
        <T scale="caption" color="brand">
          Add {amountToFree.toFixed(2)} {currency} for free delivery
        </T>
      )}
    </View>
  );
}
