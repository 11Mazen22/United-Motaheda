import { View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Typography';
import { useLuxuryTheme } from './useLuxuryTheme';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CButton } from './Button';

export interface ErrorStateProps {
  title?: string;
  subtitle?: string;
  message?: string;
  onRetry?: () => void;
  retry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({ title, subtitle, message, onRetry, retry, retryLabel, style }: ErrorStateProps) {
  const { theme, lx, surface } = useLuxuryTheme();
  const { t } = useTranslation();
  const resolvedRetry = onRetry ?? retry;

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
          borderWidth: 1,
          borderColor: theme.colors.status.error,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: lx.space[4],
        }}
      >
        <Ionicons name="alert-circle-outline" size={32} color={theme.colors.status.error} />
      </View>
      <T scale="sectionHead" color="primary" align="center" style={{ marginBottom: lx.space[1] }}>
        {title || t('error.generic.title', 'Something went wrong')}
      </T>
      <T scale="body" color="muted" align="center" style={{ marginBottom: lx.space[6], maxWidth: 280 }}>
        {subtitle || message || t('error.generic.subtitle', 'We could not load this content. Please try again.')}
      </T>
      {resolvedRetry && (
        <CButton
          variant="outline"
          label={retryLabel || t('common.retry', 'Try again')}
          onPress={resolvedRetry}
        />
      )}
    </View>
  );
}

export interface NetworkErrorProps {
  onRetry?: () => void;
}

export function NetworkError({ onRetry }: NetworkErrorProps) {
  const { t } = useTranslation();

  return (
    <ErrorState
      title={t('error.network.title', 'Connection error')}
      subtitle={t('error.network.subtitle', 'Please check your internet connection and try again.')}
      onRetry={onRetry}
    />
  );
}

export interface AuthErrorProps {
  onSignIn?: () => void;
}

export function AuthError({ onSignIn }: AuthErrorProps) {
  const { t } = useTranslation();

  return (
    <ErrorState
      title={t('error.auth.title', 'Session expired')}
      subtitle={t('error.auth.subtitle', 'Please sign in again to continue.')}
      onRetry={onSignIn}
      retryLabel={t('auth.signIn', 'Sign In')}
    />
  );
}
