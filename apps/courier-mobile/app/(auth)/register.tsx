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
import Animated, { FadeIn, FadeInRight, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { typography, spacing, radii, shadows, animation } from '@pharmacy/ui-native/courier-tokens';
import { Button, Input, Card, Badge, showToast, useCourierTheme } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

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

const STEP_TITLES = ['Personal Info', 'Vehicle Info', 'Documents'];
const STEP_SUBTITLES = [
  'Tell us about yourself',
  'Your delivery vehicle details',
  'Upload required documents',
];

function StepIndicator({ current, total, tc }: { current: number; total: number; tc: ReturnType<typeof useCourierTheme>['colors'] }) {
  return (
    <View style={si.row} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total - 1, now: current }}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <Animated.View
            entering={FadeIn.duration(animation.fast).delay(i * 80)}
            style={[
              si.dot,
              i < current
                ? { backgroundColor: tc.status.success }
                : i === current
                  ? { backgroundColor: tc.brand.primary, ...shadows.sm }
                  : { backgroundColor: tc.canvas.surfaceMuted, borderWidth: 1.5, borderColor: tc.border.default },
            ]}
          >
            {i < current ? (
              <Ionicons name="checkmark" size={14} color={tc.text.inverse} />
            ) : (
              <Text
                style={[
                  si.dotLabel,
                  i === current && { color: tc.text.inverse },
                ]}
              >
                {i + 1}
              </Text>
            )}
          </Animated.View>
          {i < total - 1 && (
            <View
              style={[
                si.line,
                i < current && { backgroundColor: tc.status.success },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[8] },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: { fontSize: typography.sm, fontFamily: typography.bold, color: 'transparent' },
  line: { flex: 1, height: 2, marginHorizontal: spacing[2], maxWidth: 60 },
});

export default function RegisterScreen() {
  const router = useRouter();
  const { colors: tc } = useCourierTheme();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);

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

  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { vehicleType: undefined, vehiclePlate: '', vehicleModel: '', vehicleColor: '' },
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

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

  const handleBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const documentsUploaded = DOCUMENTS.filter((d) => documents[d.type]).length;
  const documentsProgress = (documentsUploaded / DOCUMENTS.length) * 100;

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
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? "Go back" : "Previous step"}
          >
            <Ionicons name="arrow-back" size={24} color={tc.text.primary} />
          </Pressable>

          {/* Title */}
          <Animated.Text
            key={STEP_TITLES[step]}
            entering={SlideInRight.duration(animation.fast)}
            style={[s.title, { color: tc.text.primary }]}
            accessibilityRole="header"
          >
            {STEP_TITLES[step]}
          </Animated.Text>
          <Animated.Text
            key={STEP_SUBTITLES[step]}
            entering={SlideInRight.duration(animation.fast).delay(50)}
            style={[s.subtitle, { color: tc.text.secondary }]}
          >
            {STEP_SUBTITLES[step]}
          </Animated.Text>

          <StepIndicator current={step} total={3} tc={tc} />

          {/* ─── Step 1: Personal info ────────────────────────────────────── */}
          {step === 0 && (
            <Animated.View entering={FadeIn.duration(animation.normal)} style={s.fields}>
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
                    accessibilityLabel="Full name input"
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
                    accessibilityLabel="Phone number input"
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
                    accessibilityLabel="Email input"
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
                        <Pressable
                          onPress={() => setShowPass((v) => !v)}
                          hitSlop={16}
                          style={s.iconBtn}
                          accessibilityRole="button"
                          accessibilityLabel={showPass ? "Hide password" : "Show password"}
                        >
                          <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={tc.text.muted} />
                        </Pressable>
                      }
                    required
                    accessibilityLabel="Password input"
                    accessibilityHint="Create a password with at least 8 characters"
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
                        <Pressable
                          onPress={() => setShowConfirmPass((v) => !v)}
                          hitSlop={16}
                          style={s.iconBtn}
                          accessibilityRole="button"
                          accessibilityLabel={showConfirmPass ? "Hide confirm password" : "Show confirm password"}
                        >
                          <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={tc.text.muted} />
                        </Pressable>
                      }
                    required
                    accessibilityLabel="Confirm password input"
                    accessibilityHint="Re-enter your password"
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
                rightIcon={<Ionicons name="arrow-forward" size={18} color={tc.text.inverse} />}
                accessibilityLabel="Continue to vehicle info"
              />
            </Animated.View>
          )}

          {/* ─── Step 2: Vehicle info ─────────────────────────────────────── */}
          {step === 1 && (
            <Animated.View entering={FadeIn.duration(animation.normal)} style={s.fields}>
              <Text style={[s.sectionLabel, { color: tc.text.secondary }]} accessibilityRole="header">Vehicle Type *</Text>
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
                          value === type && [
                            s.vehicleCardActive,
                            { borderColor: tc.brand.primary, backgroundColor: tc.brand.primaryLight },
                          ],
                        ]}
                        onPress={() => onChange(type)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: value === type }}
                        accessibilityLabel={`${label} vehicle type`}
                      >
                        <Text style={s.vehicleEmoji}>{icon}</Text>
                        <Text
                          style={[
                            s.vehicleLabel,
                            value === type && { color: tc.brand.primary, fontFamily: typography.bold },
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
                <Text style={[s.errorText, { color: tc.status.error }]} accessibilityRole="alert">
                  {form2.formState.errors.vehicleType.message}
                </Text>
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
                    accessibilityLabel="Vehicle plate number input"
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
                    accessibilityLabel="Vehicle model input"
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
                    accessibilityLabel="Vehicle color input"
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
                rightIcon={<Ionicons name="arrow-forward" size={18} color={tc.text.inverse} />}
                accessibilityLabel="Continue to documents"
              />
            </Animated.View>
          )}

          {/* ─── Step 3: Documents ────────────────────────────────────────── */}
          {step === 2 && (
            <Animated.View entering={FadeIn.duration(animation.normal)} style={s.fields}>
              <Text style={[s.docNote, { color: tc.text.secondary, backgroundColor: tc.brand.primaryLight }]}>
                All documents are required before registration can be processed.
              </Text>

              {/* Document progress */}
              <View style={s.docProgressRow}>
                <Text style={[s.docProgressText, { color: tc.text.secondary }]}>
                  {documentsUploaded} of {DOCUMENTS.length} uploaded
                </Text>
                <View style={s.docProgressBar}>
                  <View
                    style={[s.docProgressFill, { width: `${documentsProgress}%`, backgroundColor: tc.brand.primary }]}
                  />
                </View>
              </View>

              {DOCUMENTS.map(({ type, label, icon }) => {
                const status = uploadProgress[type];
                const uri = documents[type];

                return (
                   <TouchableOpacity
                     key={type}
                     style={[
                       s.docCard,
                       status === 'done' && [s.docCardDone, { backgroundColor: tc.status.success + '20' }],
                       status === 'error' && [s.docCardError, { backgroundColor: tc.status.error + '20' }],
                     ]}
                     onPress={() => pickDocument(type)}
                     activeOpacity={0.7}
                     accessibilityRole="button"
                     accessibilityLabel={`${label} - ${status === 'done' ? 'Uploaded' : status === 'error' ? 'Upload failed' : 'Tap to upload'}`}
                     accessibilityHint={`Upload your ${label.toLowerCase()}`}
                   >
                     <View style={s.docLeft}>
                       {uri ? (
                         <Image source={{ uri }} style={s.docThumb} accessibilityLabel={`${label} preview`} />
                       ) : (
                         <View style={[s.docIconBox, { backgroundColor: tc.brand.primaryLight }]}>
                           <Ionicons name={icon} size={24} color={tc.brand.primary} />
                         </View>
                       )}
                       <View style={s.docInfo}>
                         <Text style={[s.docLabel, { color: tc.text.primary }]}>{label}</Text>
                         <Text style={[s.docSub, { color: tc.text.secondary }]}>
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
                         <Ionicons name="checkmark-circle" size={28} color={tc.status.success} />
                       ) : status === 'uploading' ? (
                         <Ionicons name="cloud-upload-outline" size={28} color={tc.brand.primary} />
                       ) : status === 'error' ? (
                         <Ionicons name="alert-circle" size={28} color={tc.status.error} />
                       ) : (
                         <Ionicons name="add-circle-outline" size={28} color={tc.brand.primary} />
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
                accessibilityLabel="Submit registration"
                accessibilityHint="Double tap to submit your registration"
              />
            </Animated.View>
          )}

          {/* Sign in link */}
          <View style={s.footer}>
            <Text style={[s.footerText, { color: tc.text.secondary }]}>Already have an account?</Text>
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel="Sign in to existing account"
            >
              <Text style={[s.loginLink, { color: tc.brand.primary }]}> Sign In</Text>
            </Pressable>
          </View>
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
    paddingVertical: spacing[6],
  },

  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
    ...shadows.sm,
  },

  title: {
    fontSize: typography['2xl'],
    fontFamily: typography.black,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.base,
    marginBottom: spacing[4],
  },

  fields: { gap: spacing[4] },

  sectionLabel: {
    fontSize: typography.sm,
    fontFamily: typography.semibold,
    marginBottom: spacing[2],
  },
  vehicleRow: { flexDirection: 'row', gap: spacing[3] },
  vehicleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[5],
    borderRadius: radii.xl,
    borderWidth: 2,
    gap: spacing[2],
    ...shadows.sm,
  },
  vehicleCardActive: {
    ...shadows.brand,
  },
  vehicleEmoji: { fontSize: 32 },
  vehicleLabel: { fontSize: typography.xs, fontFamily: typography.medium, color: 'transparent' },
  vehicleLabelActive: { fontFamily: typography.bold },

  errorText: { fontSize: typography.xs, marginTop: -spacing[2] },

  docNote: {
    fontSize: typography.sm,
    padding: spacing[4],
    borderRadius: radii.lg,
    marginBottom: spacing[2],
    overflow: 'hidden',
  },
  docProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  docProgressText: {
    fontSize: typography.xs,
    fontFamily: typography.medium,
  },
  docProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  docProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.xl,
    padding: spacing[4],
    borderWidth: 2,
    ...shadows.sm,
  },
  docCardDone: {},
  docCardError: {},
  docLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  docIconBox: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docThumb: { width: 56, height: 56, borderRadius: radii.lg },
  docInfo: { flex: 1 },
  docLabel: { fontSize: typography.base, fontFamily: typography.semibold, color: 'transparent' },
  docSub: { fontSize: typography.xs, marginTop: 2 },
  docStatus: { paddingLeft: spacing[2] },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[8],
    gap: spacing[1],
  },
  footerText: { fontSize: typography.sm, color: 'transparent' },
  loginLink: { fontSize: typography.sm, fontFamily: typography.semibold, color: 'transparent' },
  iconBtn: { justifyContent: 'center', alignItems: 'center' },
});
