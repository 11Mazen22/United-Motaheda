import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radii, shadows } from '@pharmacy/ui-native/courier-tokens';
import { Button, Input, Card, Badge, showToast } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// ─── Step schemas ─────────────────────────────────────────────────────────────

const step1Schema = z
  .object({
    fullName: z.string().min(3, 'Full name must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    phone: z
      .string()
      .regex(/^(\+20|0020|0)?1[0-2,5]{1}[0-9]{8}$/, 'Enter a valid Egyptian phone number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const step2Schema = z.object({
  vehicleType: z.enum(['motorcycle', 'car', 'van'] as const).refine((v) => v !== undefined, {
    message: 'Select a vehicle type',
  }),
  vehiclePlate: z.string().min(2, 'Enter vehicle plate number'),
  vehicleModel: z.string().min(2, 'Enter vehicle model'),
  vehicleColor: z.string().min(2, 'Enter vehicle color'),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

type VehicleType = 'motorcycle' | 'car' | 'van';

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: string }[] = [
  { type: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
  { type: 'car', label: 'Car', icon: '🚗' },
  { type: 'van', label: 'Van', icon: '🚐' },
];

type DocumentType = 'license' | 'id' | 'vehicle' | 'insurance';
const DOCUMENTS: { type: DocumentType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { type: 'license', label: 'Driver License', icon: 'card-outline' },
  { type: 'id', label: 'National ID', icon: 'id-card-outline' },
  { type: 'vehicle', label: 'Vehicle Photo', icon: 'car-outline' },
  { type: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View style={[si.dot, i < current ? si.done : i === current ? si.active : si.idle]}>
            {i < current ? (
              <Ionicons name="checkmark" size={12} color={colors.white} />
            ) : (
              <Text style={[si.dotLabel, i === current && si.dotLabelActive]}>
                {i + 1}
              </Text>
            )}
          </View>
          {i < total - 1 && (
            <View style={[si.line, i < current && si.lineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[6] },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.well, borderWidth: 1.5, borderColor: colors.border },
  active: { backgroundColor: colors.primary },
  done: { backgroundColor: colors.success },
  dotLabel: { fontSize: typography.sm, fontFamily: typography.bold, color: colors.inkMuted },
  dotLabelActive: { color: colors.white },
  line: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: spacing[1] },
  lineDone: { backgroundColor: colors.success },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);

  // Document state
  const [documents, setDocuments] = useState<Record<DocumentType, string | null>>({
    license: null,
    id: null,
    vehicle: null,
    insurance: null,
  });
  const [uploadProgress, setUploadProgress] = useState<Record<DocumentType, 'idle' | 'uploading' | 'done' | 'error'>>({
    license: 'idle',
    id: 'idle',
    vehicle: 'idle',
    insurance: 'idle',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 form
  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  // Step 2 form
  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { vehicleType: undefined, vehiclePlate: '', vehicleModel: '', vehicleColor: '' },
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // ─── Document picking ──────────────────────────────────────────────────────

  const pickDocument = async (type: DocumentType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setDocuments((d) => ({ ...d, [type]: uri }));
      setUploadProgress((p) => ({ ...p, [type]: 'idle' }));
    }
  };

  // ─── Final submission ──────────────────────────────────────────────────────

  const handleFinalSubmit = async () => {
    const allSelected = DOCUMENTS.every((d) => documents[d.type]);
    if (!allSelected) {
      showToast('Please upload all required documents', 'warning');
      return;
    }

    if (!step1Data || !step2Data) return;
    setIsSubmitting(true);

    try {
      const res = await driverApi.register({
        fullName: step1Data.fullName,
        email: step1Data.email,
        phone: step1Data.phone,
        password: step1Data.password,
        vehicleType: step2Data.vehicleType,
        vehiclePlate: step2Data.vehiclePlate,
        vehicleModel: step2Data.vehicleModel,
        vehicleColor: step2Data.vehicleColor,
      });
      setAuth(res.token, res.user);

      for (const document of DOCUMENTS) {
        const uri = documents[document.type];
        if (!uri) continue;
        setUploadProgress((p) => ({ ...p, [document.type]: 'uploading' }));
        try {
          await driverApi.uploadDocument(document.type, uri);
          setUploadProgress((p) => ({ ...p, [document.type]: 'done' }));
        } catch {
          setUploadProgress((p) => ({ ...p, [document.type]: 'error' }));
          throw new Error(`Failed to upload ${document.type} document`);
        }
      }
      router.replace('/(auth)/pending');
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? 'Registration failed. Please try again.';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render steps ──────────────────────────────────────────────────────────

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
          {/* Back button */}
          <Pressable
            style={s.backBtn}
            onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>

          {/* Title */}
          <Text style={s.title}>
            {step === 0 ? 'Personal Info' : step === 1 ? 'Vehicle Info' : 'Documents'}
          </Text>
          <Text style={s.subtitle}>
            {step === 0
              ? 'Tell us about yourself'
              : step === 1
              ? 'Your delivery vehicle details'
              : 'Upload required documents'}
          </Text>

          <StepIndicator current={step} total={3} />

          {/* ─── Step 1: Personal info ────────────────────────────────────── */}
          {step === 0 && (
            <View style={s.fields}>
              <Controller
                control={form1.control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Full Name"
                    placeholder="Ahmed Mohamed"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.fullName?.message}
                    autoCapitalize="words"
                    required
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Phone Number"
                    placeholder="+201012345678"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.phone?.message}
                    keyboardType="phone-pad"
                    required
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email"
                    placeholder="driver@example.com"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    required
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Password"
                    placeholder="Min. 8 characters"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.password?.message}
                    secureTextEntry={!showPass}
                    rightIcon={
                      <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.inkMuted} />
                      </Pressable>
                    }
                    required
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Confirm Password"
                    placeholder="Repeat password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.confirmPassword?.message}
                    secureTextEntry={!showConfirmPass}
                    rightIcon={
                      <Pressable onPress={() => setShowConfirmPass((v) => !v)} hitSlop={8}>
                        <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.inkMuted} />
                      </Pressable>
                    }
                    required
                  />
                )}
              />

              <Button
                title="Next: Vehicle Info"
                onPress={() => void form1.handleSubmit((data) => {
                  setStep1Data(data);
                  setStep(1);
                })()}
                loading={form1.formState.isSubmitting}
                fullWidth
                size="lg"
                style={{ marginTop: spacing[4] }}
                rightIcon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
              />
            </View>
          )}

          {/* ─── Step 2: Vehicle info ─────────────────────────────────────── */}
          {step === 1 && (
            <View style={s.fields}>
              {/* Vehicle type selector */}
              <Text style={s.sectionLabel}>Vehicle Type *</Text>
              <View style={s.vehicleRow}>
                {VEHICLE_OPTIONS.map(({ type, label, icon }) => (
                  <Controller
                    key={type}
                    control={form2.control}
                    name="vehicleType"
                    render={({ field: { onChange, value } }) => (
                      <TouchableOpacity
                        style={[
                          s.vehicleCard,
                          value === type && s.vehicleCardActive,
                        ]}
                        onPress={() => onChange(type)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.vehicleEmoji}>{icon}</Text>
                        <Text
                          style={[
                            s.vehicleLabel,
                            value === type && s.vehicleLabelActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                ))}
              </View>
              {form2.formState.errors.vehicleType && (
                <Text style={s.errorText}>{form2.formState.errors.vehicleType.message}</Text>
              )}

              <Controller
                control={form2.control}
                name="vehiclePlate"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Plate Number"
                    placeholder="ABC 1234"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.vehiclePlate?.message}
                    autoCapitalize="characters"
                    required
                  />
                )}
              />
              <Controller
                control={form2.control}
                name="vehicleModel"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Vehicle Model"
                    placeholder="Toyota Corolla 2020"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.vehicleModel?.message}
                    required
                  />
                )}
              />
              <Controller
                control={form2.control}
                name="vehicleColor"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Vehicle Color"
                    placeholder="White"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.vehicleColor?.message}
                    required
                  />
                )}
              />

              <Button
                title="Next: Documents"
                onPress={() => void form2.handleSubmit((data) => {
                  setStep2Data(data);
                  setStep(2);
                })()}
                fullWidth
                size="lg"
                style={{ marginTop: spacing[4] }}
                rightIcon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
              />
            </View>
          )}

          {/* ─── Step 3: Documents ────────────────────────────────────────── */}
          {step === 2 && (
            <View style={s.fields}>
              <Text style={s.docNote}>
                All documents are required before registration can be processed.
              </Text>

              {DOCUMENTS.map(({ type, label, icon }) => {
                const status = uploadProgress[type];
                const uri = documents[type];

                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      s.docCard,
                      status === 'done' && s.docCardDone,
                      status === 'error' && s.docCardError,
                    ]}
                    onPress={() => pickDocument(type)}
                    activeOpacity={0.7}
                  >
                    <View style={s.docLeft}>
                      {uri ? (
                        <Image source={{ uri }} style={s.docThumb} />
                      ) : (
                        <View style={s.docIconBox}>
                          <Ionicons name={icon} size={24} color={colors.primary} />
                        </View>
                      )}
                      <View style={s.docInfo}>
                        <Text style={s.docLabel}>{label}</Text>
                        <Text style={s.docSub}>
                          {status === 'idle'
                            ? 'Tap to upload'
                            : status === 'uploading'
                            ? 'Uploading…'
                            : status === 'done'
                            ? 'Uploaded ✓'
                            : 'Upload failed — tap to retry'}
                        </Text>
                      </View>
                    </View>
                    <View style={s.docStatus}>
                      {status === 'done' ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                      ) : status === 'uploading' ? (
                        <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                      ) : status === 'error' ? (
                        <Ionicons name="alert-circle" size={24} color={colors.error} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <Button
                title="Submit Registration"
                onPress={handleFinalSubmit}
                loading={isSubmitting}
                fullWidth
                size="lg"
                style={{ marginTop: spacing[4] }}
              />
            </View>
          )}

          {/* Sign in link */}
          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={8}>
              <Text style={s.loginLink}> Sign In</Text>
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
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
    ...shadows.sm,
  },

  title: {
    fontSize: typography['2xl'],
    fontFamily: typography.black,
    color: colors.ink,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.inkMuted,
    marginBottom: spacing[6],
  },

  fields: { gap: spacing[4] },

  sectionLabel: {
    fontSize: typography.sm,
    fontFamily: typography.medium,
    color: colors.inkSoft,
    marginBottom: spacing[1],
  },
  vehicleRow: { flexDirection: 'row', gap: spacing[3] },
  vehicleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing[2],
    ...shadows.sm,
  },
  vehicleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  vehicleEmoji: { fontSize: 28 },
  vehicleLabel: { fontSize: typography.xs, fontFamily: typography.medium, color: colors.inkMuted },
  vehicleLabelActive: { color: colors.primary, fontFamily: typography.bold },

  errorText: { fontSize: typography.xs, color: colors.error, marginTop: -spacing[2] },

  docNote: {
    fontSize: typography.sm,
    color: colors.inkMuted,
    backgroundColor: colors.primaryLight,
    padding: spacing[3],
    borderRadius: radii.lg,
    marginBottom: spacing[2],
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  docCardDone: { borderColor: colors.success, backgroundColor: '#F0FFF4' },
  docCardError: { borderColor: colors.error, backgroundColor: '#FFF5F5' },
  docLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  docIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docThumb: { width: 48, height: 48, borderRadius: radii.lg },
  docInfo: { flex: 1 },
  docLabel: { fontSize: typography.base, fontFamily: typography.semibold, color: colors.ink },
  docSub: { fontSize: typography.xs, color: colors.inkMuted, marginTop: 2 },
  docStatus: { paddingLeft: spacing[2] },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[8],
  },
  footerText: { fontSize: typography.sm, color: colors.inkMuted },
  loginLink: { fontSize: typography.sm, color: colors.primary, fontFamily: typography.semibold },
});
