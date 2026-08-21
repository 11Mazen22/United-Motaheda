import { useColorScheme } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useThemeStore } from '@/stores/themeStore';

export function useDarkColors() {
  const scheme = useColorScheme();
  const manualMode = useThemeStore((s) => s.mode);
  
  const isDark = manualMode === 'dark' || (manualMode === 'system' && scheme === 'dark');
  
  // Support both historical call styles: `const c = useDarkColors()` and
  // `const { c } = useDarkColors()` while the native screens are migrated.
  const colors = isDark ? kit.darkColor : kit.color;
  return { ...colors, c: colors, isDark };
}
