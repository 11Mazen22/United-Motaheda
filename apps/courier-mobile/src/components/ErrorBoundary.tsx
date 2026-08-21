import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { typography, spacing, radii } from '@pharmacy/ui-native/courier-tokens';
import { useCourierTheme } from '@pharmacy/ui-native';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback error={this.state.error} onRetry={this.retry} />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }: { error: Error | null, onRetry: () => void }) {
  const { colors } = useCourierTheme();

  return (
    <View style={[s.container, { backgroundColor: colors.canvas.screen }]} accessibilityRole="alert">
      <View style={[s.iconWrap, { backgroundColor: colors.status.error + '20' }]}>
        <Text style={[s.iconText, { color: colors.status.error }]}>!</Text>
      </View>
      <Text style={[s.title, { color: colors.text.primary }]}>Something went wrong</Text>
      <Text style={[s.message, { color: colors.text.secondary }]}>
        {error?.message ?? 'An unexpected error occurred.'}
      </Text>
      <Pressable 
        style={[s.button, { backgroundColor: colors.brand.primary }]} 
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={[s.buttonText, { color: colors.text.inverse }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  iconText: {
    fontSize: 32,
    fontFamily: typography.black,
  },
  title: {
    fontSize: typography.lg,
    fontFamily: typography.bold,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: typography.base * typography.normal,
  },
  button: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
  },
  buttonText: {
    fontFamily: typography.semibold,
    fontSize: typography.base,
  },
});
