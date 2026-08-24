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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radii, shadows, animation } from '@pharmacy/ui-native/courier-tokens';
import { Button, Input, showToast, useCourierTheme } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

function createStep1Schema(t: (key: string) => string) {
  return z
    .object({
      fullName: z.string().min(3, t('register.fullNameMin')),
      email: z.string().email(t('register.invalidEmail')),
      phone: z
        .string()
        .regex(/^(\+20|0020|0)?1[0-2,5]{1}[0-9]{8}$/, t('register.invalidPhone')),
      password: z.string().min(8, t('register.passwordMin8')),
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('register.passwordsMismatch'),
      path: ['confirmPassword'],
    });
}

function createStep2Schema(t: (key: string) => string) {
  return z.object({
    vehicleType: z.enum(['motorcycle', 'car', 'van'] as const).refine((v) => v !== undefined, {
      message: t('register.selectVehicleType'),
    }),
    vehiclePlate: z.string().min(2, t('register.plateRequired')),
    vehicleModel: z.string().min(2, t('register.modelRequired')),
    vehicleColor: z.string().min(2, t('register.colorRequired')),
  });
}

type Step1Data = z.infer<ReturnType<typeof createStep1Schema>>;
type Step2Data = z.infer<ReturnType<typeof createStep2Schema>>;

type VehicleType = 'motorcycle' | 'car' | 'van';

const VEHICLE_OPTIONS: { type: VehicleType; labelKey: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { type: 'motorcycle', labelKey: 'register.vehicleMotorcycle', icon: 'motorbike' },
  { type: 'car', labelKey: 'register.vehicleCar', icon: 'car-outline' },
  { type: 'van', labelKey: 'register.vehicleVan', icon: 'van-utility' },
];

type DocumentType = 'license' | 'id' | 'vehicle' | 'insurance';
const DOCUMENTS: { type: DocumentType; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { type: 'license', labelKey: 'register.docLicense', icon: 'card-outline' },
  { type: 'id', labelKey: 'register.docId', icon: 'id-card-outline' },
  { type: 'vehicle', labelKey: 'register.docVehicle', icon: 'car-outline' },
  { type: 'insurance', labelKey: 'register.docInsurance', icon: 'shield-checkmark-outline' },
];

const STEP_TITLE_KEYS = ['register.step1Title', 'register.step2Title', 'register.step3Title'];
const STEP_SUBTITLE_KEYS = [
  'register.step1Subtitle',
  'register.step2Subtitle',
  'register.step3Subtitle',
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
                  { color: tc.text.secondary },
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
  dotLabel: { fontSize: typography.sm, fontFamily: typography.bold },
  line: { flex: 1, height: 2, marginHorizontal: spacing[2], maxWidth: 60 },
});

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    resolver: zodResolver(createStep1Schema(t)),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const form2 = useForm<Step2Data>({
    resolver: zodResolver(createStep2Schema(t)),
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
      showToast(t('register.pleaseUploadAll'), 'warning');
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
          throw new Error(t('register.uploadFailedDoc', { doc: document.type }));
        }
      }
      router.replace('/(auth)/pending');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
              t('register.registrationFailed');
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
            accessibilityLabel={step === 0 ? t('register.goBack') : t('register.previousStep')}
          >
            <Ionicons name="arrow-back" size={24} color={tc.text.primary} />
          </Pressable>

          {/* Title */}
          <Animated.Text
            key={STEP_TITLE_KEYS[step]}
            entering={SlideInRight.duration(animation.fast)}
            style={[s.title, { color: tc.text.primary }]}
            accessibilityRole="header"
          >
            {t(STEP_TITLE_KEYS[step])}
          </Animated.Text>
          <Animated.Text
            key={STEP_SUBTITLE_KEYS[step]}
            entering={SlideInRight.duration(animation.fast).delay(50)}
            style={[s.subtitle, { color: tc.text.secondary }]}
          >
            {t(STEP_SUBTITLE_KEYS[step])}
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
                    label={t('register.fullName')}
                    placeholder={t('register.fullNamePlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.fullName?.message}
                    autoCapitalize="words"
                    required
                    accessibilityLabel={t('register.fullNameA11y')}
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('register.phoneNumber')}
                    placeholder={t('register.phoneNumberPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.phone?.message}
                    keyboardType="phone-pad"
                    required
                    accessibilityLabel={t('register.phoneNumberA11y')}
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('register.email')}
                    placeholder={t('register.emailPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form1.formState.errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    required
                    accessibilityLabel={t('register.emailA11y')}
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('register.password')}
                    placeholder={t('register.passwordPlaceholder')}
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
                          accessibilityLabel={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
                        >
                          <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={tc.text.muted} />
                        </Pressable>
                      }
                    required
                    accessibilityLabel={t('register.passwordA11y')}
                    accessibilityHint={t('register.passwordHint')}
                  />
                )}
              />
              <Controller
                control={form1.control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('register.confirmPassword')}
                    placeholder={t('register.confirmPasswordPlaceholder')}
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
                          accessibilityLabel={showConfirmPass ? t('register.hideConfirmPassword') : t('register.showConfirmPassword')}
                        >
                          <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={tc.text.muted} />
                        </Pressable>
                      }
                    required
                    accessibilityLabel={t('register.confirmPasswordA11y')}
                    accessibilityHint={t('register.confirmPasswordHint')}
                  />
                )}
              />

              <Button
                title={t('register.nextVehicleInfo')}
                onPress={() => void form1.handleSubmit((data) => {
                  setStep1Data(data);
                  setStep(1);
                })()}
                loading={form1.formState.isSubmitting}
                fullWidth
                size="lg"
                style={{ marginTop: spacing[4] }}
                rightIcon={<Ionicons name="arrow-forward" size={18} color={tc.text.inverse} />}
                accessibilityLabel={t('register.continueToVehicleInfo')}
              />
            </Animated.View>
          )}

          {/* ─── Step 2: Vehicle info ─────────────────────────────────────── */}
          {step === 1 && (
            <Animated.View entering={FadeIn.duration(animation.normal)} style={s.fields}>
              <Text style={[s.sectionLabel, { color: tc.text.secondary }]} accessibilityRole="header">{t('register.vehicleTypeLabel')}</Text>
              <View style={s.vehicleRow}>
                {VEHICLE_OPTIONS.map(({ type, labelKey, icon }) => (
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
                        accessibilityLabel={t('register.vehicleTypeA11y', { label: t(labelKey) })}
                      >
                        <MaterialCommunityIcons
                          name={icon}
                          size={28}
                          color={value === type ? tc.brand.primary : tc.text.secondary}
                        />
                        <Text
                          style={[
                            s.vehicleLabel,
                            { color: tc.text.secondary },
                            value === type && { color: tc.brand.primary, fontFamily: typography.bold },
                          ]}
                        >
                          {t(labelKey)}
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
                    label={t('register.plateNumber')}
                    placeholder={t('register.plateNumberPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.vehiclePlate?.message}
                    autoCapitalize="characters"
                    required
                    accessibilityLabel={t('register.plateNumberA11y')}
                  />
                )}
              />
              <Controller
                control={form2.control}
                name="vehicleModel"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('register.vehicleModel')}
                    placeholder={t('register.vehicleModelPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.vehicleModel?.message}
                    required
                    accessibilityLabel={t('register.vehicleModelA11y')}
                  />
                )}
              />
              <Controller
                control={form2.control}
                name="vehicleColor"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('register.vehicleColor')}
                    placeholder={t('register.vehicleColorPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={form2.formState.errors.vehicleColor?.message}
                    required
                    accessibilityLabel={t('register.vehicleColorA11y')}
                  />
                )}
              />

              <Button
                title={t('register.nextDocuments')}
                onPress={() => void form2.handleSubmit((data) => {
                  setStep2Data(data);
                  setStep(2);
                })()}
                fullWidth
                size="lg"
                style={{ marginTop: spacing[4] }}
                rightIcon={<Ionicons name="arrow-forward" size={18} color={tc.text.inverse} />}
                accessibilityLabel={t('register.continueToDocuments')}
              />
            </Animated.View>
          )}

          {/* ─── Step 3: Documents ────────────────────────────────────────── */}
          {step === 2 && (
            <Animated.View entering={FadeIn.duration(animation.normal)} style={s.fields}>
              <Text style={[s.docNote, { color: tc.text.secondary, backgroundColor: tc.brand.primaryLight }]}>
                {t('register.docsRequiredNote')}
              </Text>

              {/* Document progress */}
              <View style={s.docProgressRow}>
                <Text style={[s.docProgressText, { color: tc.text.secondary }]}>
                  {t('register.docsUploadedCount', { count: documentsUploaded, total: DOCUMENTS.length })}
                </Text>
                <View style={s.docProgressBar}>
                  <View
                    style={[s.docProgressFill, { width: `${documentsProgress}%`, backgroundColor: tc.brand.primary }]}
                  />
                </View>
              </View>

              {DOCUMENTS.map(({ type, labelKey, icon }) => {
                const status = uploadProgress[type];
                const uri = documents[type];
                const label = t(labelKey);

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
                     accessibilityLabel={t('register.docA11y', {
                       label,
                       status: status === 'done' ? t('register.docUploaded') : status === 'error' ? t('register.docUploadFailed') : t('register.docTapToUpload'),
                     })}
                     accessibilityHint={t('register.docUploadHint', { label })}
                   >
                     <View style={s.docLeft}>
                       {uri ? (
                         <Image source={{ uri }} style={s.docThumb} accessibilityLabel={t('register.docPreviewA11y', { label })} />
                       ) : (
                         <View style={[s.docIconBox, { backgroundColor: tc.brand.primaryLight }]}>
                           <Ionicons name={icon} size={24} color={tc.brand.primary} />
                         </View>
                       )}
                       <View style={s.docInfo}>
                         <Text style={[s.docLabel, { color: tc.text.primary }]}>{label}</Text>
                         <Text style={[s.docSub, { color: tc.text.secondary }]}>
                           {status === 'idle'
                             ? t('register.docTapToUpload')
                             : status === 'uploading'
                               ? t('register.docUploading')
                               : status === 'done'
                                 ? t('register.docUploadedCheck')
                                 : t('register.docUploadFailedRetry')}
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
                title={t('register.submitRegistration')}
                onPress={handleFinalSubmit}
                loading={isSubmitting}
                fullWidth
                size="lg"
                style={{ marginTop: spacing[4] }}
                accessibilityLabel={t('register.submitRegistrationA11y')}
                accessibilityHint={t('register.submitRegistrationHint')}
              />
            </Animated.View>
          )}

          {/* Sign in link */}
          <View style={s.footer}>
            <Text style={[s.footerText, { color: tc.text.secondary }]}>{t('register.alreadyHaveAccount')}</Text>
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel={t('register.signInExistingA11y')}
            >
              <Text style={[s.loginLink, { color: tc.brand.primary }]}>{t('register.signIn')}</Text>
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
  vehicleLabel: { fontSize: typography.xs, fontFamily: typography.medium },
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
