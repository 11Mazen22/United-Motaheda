import { useColorScheme } from 'react-native';
import { kit } from '@pharmacy/ui-native';

export function useDarkColors() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  // kit.darkColor should be added by the design system subagent
  // If it doesn't exist yet, use the light colors as fallback
  const c = isDark && (kit as any).darkColor ? (kit as any).darkColor : kit.color;
  return { c, isDark };
}
