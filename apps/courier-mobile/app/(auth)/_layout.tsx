import { Stack } from 'expo-router';
import { useCourierTheme } from '@pharmacy/ui-native';

export default function AuthLayout() {
  const { colors } = useCourierTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: colors.canvas.screen },
      }}
    />
  );
}
