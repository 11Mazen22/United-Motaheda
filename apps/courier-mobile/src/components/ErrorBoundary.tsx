import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, radii } from '@pharmacy/ui-native/courier-tokens';

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
        <View style={s.container}>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Pressable style={s.button} onPress={this.retry}>
            <Text style={s.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    fontSize: typography.lg,
    fontFamily: typography.bold,
    color: colors.ink,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: typography.base * typography.normal,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radii.lg,
  },
  buttonText: {
    color: colors.white,
    fontFamily: typography.semibold,
    fontSize: typography.base,
  },
});
