import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Typography';
import { useLuxuryTheme } from './useLuxuryTheme';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CButton } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  message?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, subtitle, description, message, action, actionLabel, onAction, style }: EmptyStateProps) {
  const { theme, lx, surface } = useLuxuryTheme();
  const resolvedSubtitle = subtitle ?? description ?? message;
  const resolvedAction = action ?? (actionLabel && onAction ? <CButton label={actionLabel} onPress={onAction} /> : undefined);

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          padding: lx.space.sectionGap,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: surface.s2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: lx.space[4],
        }}
      >
        {icon || <Ionicons name="ellipse-outline" size={32} color={theme.colors.text.muted} />}
      </View>
      <T scale="sectionHead" color="primary" align="center" style={{ marginBottom: lx.space[1] }}>
        {title}
      </T>
      {resolvedSubtitle && (
        <T scale="body" color="muted" align="center" style={{ marginBottom: lx.space[6], maxWidth: 280 }}>
          {resolvedSubtitle}
        </T>
      )}
      {resolvedAction && <View>{resolvedAction}</View>}
    </View>
  );
}

export interface EmptyCartProps {
  onBrowse?: () => void;
}

export function EmptyCart({ onBrowse }: EmptyCartProps) {
  const { t } = useTranslation();
  const { theme } = useLuxuryTheme();

  return (
    <EmptyState
      icon={<Ionicons name="cart-outline" size={32} color={theme.colors.text.muted} />}
      title={t('cart.empty.title', 'Your cart is waiting')}
      subtitle={t('cart.empty.subtitle', 'Add some products to get started.')}
      action={
        onBrowse ? (
          <CButton label={t('cart.empty.action', 'Browse products')} onPress={onBrowse} />
        ) : undefined
      }
    />
  );
}

export interface EmptyOrdersProps {
  onShop?: () => void;
}

export function EmptyOrders({ onShop }: EmptyOrdersProps) {
  const { t } = useTranslation();
  const { theme } = useLuxuryTheme();

  return (
    <EmptyState
      icon={<Ionicons name="receipt-outline" size={32} color={theme.colors.text.muted} />}
      title={t('orders.empty.title', 'No orders yet')}
      subtitle={t('orders.empty.subtitle', 'Your orders will appear here.')}
      action={
        onShop ? (
          <CButton label={t('orders.empty.action', 'Start shopping')} onPress={onShop} />
        ) : undefined
      }
    />
  );
}

export interface EmptySearchProps {
  query?: string;
}

export function EmptySearch({ query }: EmptySearchProps) {
  const { t } = useTranslation();
  const { theme } = useLuxuryTheme();

  return (
    <EmptyState
      icon={<Ionicons name="search-outline" size={32} color={theme.colors.text.muted} />}
      title={t('search.empty.title', 'No results found')}
      subtitle={query ? t('search.empty.subtitleWithQuery', { query, defaultValue: `We couldn't find anything matching "${query}".` }) : t('search.empty.subtitle', 'Try a different search term.')}
    />
  );
}
