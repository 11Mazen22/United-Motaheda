import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { typography, spacing, radii, shadows, animation } from '@pharmacy/ui-native/courier-tokens';
import { Button, Input, showToast, useCourierTheme } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  identifier: z.string().min(3, 'Enter your phone or email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useCourierTheme();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await driverApi.login({
        identifier: data.identifier,
        password: data.password,
      });

      if (res.user?.role !== 'DRIVER') {
        throw new Error("Unauthorized: This application is strictly for Drivers.");
      }

      setAuth(res.token, res.user);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes('Unauthorized')
          ? err.message
          : (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
              'Login failed. Check your credentials.';
      showToast(message, 'error');
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.canvas.screen }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header / Brand */}
          <Animated.View entering={FadeInDown.duration(animation.normal).springify()} style={s.header}>
            <View style={[s.logoCircle, { backgroundColor: colors.brand.primary, shadowColor: colors.brand.primary }]}>
              <Ionicons name="car-sport" size={40} color={colors.text.inverse} />
            </View>
            <Text style={[s.title, { color: colors.text.primary }]} accessibilityRole="header">United Pharmacy</Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>Driver Portal</Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View entering={FadeInUp.duration(animation.normal).delay(100).springify()} style={[s.card, { backgroundColor: colors.canvas.surface, shadowColor: colors.text.primary }]}>
            <Text style={[s.formTitle, { color: colors.text.primary }]} accessibilityRole="header">Welcome Back</Text>
            <Text style={[s.formSub, { color: colors.text.secondary }]}>Sign in to continue delivering</Text>

            <View style={s.fields}>
              <Controller
                control={control}
                name="identifier"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Phone or Email"
                    placeholder="+20 10x xxx xxxx or email@example.com"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.identifier?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    leftIcon={
                      <Ionicons name="person-outline" size={18} color={colors.text.muted} />
                    }
                    required
                    accessibilityLabel="Phone or Email input"
                    accessibilityHint="Enter your registered phone number or email"
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Password"
                    placeholder="Your password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    leftIcon={
                      <Ionicons name="lock-closed-outline" size={18} color={colors.text.muted} />
                    }
                    rightIcon={
                      <Pressable
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={16}
                        style={s.iconBtn}
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={colors.text.muted}
                        />
                      </Pressable>
                    }
                    required
                    accessibilityLabel="Password input"
                    accessibilityHint="Enter your account password"
                  />
                )}
              />
            </View>

            <Button
              title="Sign In"
              onPress={() => void handleSubmit(onSubmit)()}
              loading={isSubmitting}
              fullWidth
              size="lg"
              style={s.loginBtn}
              accessibilityLabel="Sign in button"
              accessibilityHint="Double tap to sign in to your account"
            />
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInUp.duration(animation.normal).delay(200)} style={s.footer}>
            <Text style={[s.footerText, { color: colors.text.secondary }]}>Don't have an account?</Text>
            <Pressable
              onPress={() => router.push('/(auth)/register')}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel="Register as driver"
            >
              <Text style={[s.registerLink, { color: colors.brand.primary }]}> Register as Driver</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
    ...shadows.brand,
  },
  title: {
    fontSize: typography['2xl'],
    fontFamily: typography.black,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.base,
    fontFamily: typography.medium,
    marginTop: spacing[1],
  },

  card: {
    borderRadius: radii['2xl'],
    padding: spacing[7],
    ...shadows.lg,
  },
  formTitle: {
    fontSize: typography.xl,
    fontFamily: typography.bold,
    marginBottom: spacing[1],
  },
  formSub: {
    fontSize: typography.sm,
    marginBottom: spacing[6],
  },
  fields: { gap: spacing[4] },

  loginBtn: { marginTop: spacing[7] },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[8],
    gap: spacing[1],
  },
  footerText: { fontSize: typography.sm },
  registerLink: {
    fontSize: typography.sm,
    fontFamily: typography.semibold,
  },
  iconBtn: {
    padding: 12,
    margin: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
