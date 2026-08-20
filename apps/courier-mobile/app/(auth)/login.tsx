import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '@pharmacy/ui-native/courier-tokens';
import { Button, Input, showToast } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  identifier: z.string().min(3, 'Enter your phone or email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
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
      
      // Strict Role Guard
      if (res.user?.role !== 'DRIVER') {
         throw new Error("Unauthorized: This application is strictly for Drivers.");
      }
      
      setAuth(res.token, res.user);
      // AuthGuard in _layout.tsx will redirect to /(tabs) automatically
    } catch (err: any) {
      const message = err instanceof Error && err.message.includes("Unauthorized") 
        ? err.message 
        : err?.response?.data?.message ?? 'Login failed. Check your credentials.';
      showToast(message, 'error');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.header}>
            <View style={s.logoCircle}>
              <Ionicons name="car-sport" size={36} color={colors.white} />
            </View>
            <Text style={s.title}>United Pharmacy</Text>
            <Text style={s.subtitle}>Driver Portal</Text>
          </View>

          {/* Form card */}
          <View style={s.card}>
            <Text style={s.formTitle}>Sign In</Text>
            <Text style={s.formSub}>Enter your credentials to continue</Text>

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
                      <Ionicons name="person-outline" size={18} color={colors.inkMuted} />
                    }
                    required
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
                      <Ionicons name="lock-closed-outline" size={18} color={colors.inkMuted} />
                    }
                    rightIcon={
                      <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={colors.inkMuted}
                        />
                      </Pressable>
                    }
                    required
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
            />
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerText}>Don't have an account?</Text>
            <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={8}>
              <Text style={s.registerLink}> Register as Driver</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
    justifyContent: 'center',
  },

  header: { alignItems: 'center', marginBottom: spacing[8] },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography['2xl'],
    fontFamily: typography.black,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.inkMuted,
    marginTop: spacing[1],
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing[6],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  formTitle: {
    fontSize: typography.xl,
    fontFamily: typography.bold,
    color: colors.ink,
    marginBottom: spacing[1],
  },
  formSub: {
    fontSize: typography.sm,
    color: colors.inkMuted,
    marginBottom: spacing[5],
  },
  fields: { gap: spacing[4] },

  loginBtn: { marginTop: spacing[6] },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[6],
  },
  footerText: { fontSize: typography.sm, color: colors.inkMuted },
  registerLink: {
    fontSize: typography.sm,
    color: colors.primary,
    fontFamily: typography.semibold,
  },
});
