import { useColorScheme } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useThemeStore } from '@/stores/themeStore';

export function useDarkColors() {
  const scheme = useColorScheme();
  const manualMode = useThemeStore((s) => s.mode);
  
  const isDark = manualMode === 'dark' || (manualMode === 'system' && scheme === 'dark');
  
  // kit.darkColor provides the dark token mapping
  const c = isDark && (kit as any).darkColor ? (kit as any).darkColor : kit.color;
  return { c, isDark };
}
