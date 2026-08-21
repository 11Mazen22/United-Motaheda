import { View, type ViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useCustomerTheme } from './useCustomerTheme';

export interface AppSurfaceProps extends ViewProps {
  level?: 'base' | 's1' | 's2' | 's3' | 's4';
  children?: React.ReactNode;
}

export function AppSurface({ level = 's1', style, ...props }: AppSurfaceProps) {
  const { surface } = useCustomerTheme();
  return <View style={[{ backgroundColor: surface[level] }, style]} {...props} />;
}

export interface DividerProps extends ViewProps {
  vertical?: boolean;
}

export function Divider({ vertical, style, ...props }: DividerProps) {
  const { surface } = useCustomerTheme();
  return (
    <View
      style={[
        { backgroundColor: surface.s3 },
        vertical ? { width: 1, height: '100%' } : { height: 1, width: '100%' },
        style,
      ]}
      {...props}
    />
  );
}

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  children?: React.ReactNode;
}

export function ScreenContainer({ edges = ['left', 'right'], style, ...props }: ScreenContainerProps) {
  const { surface, cx } = useCustomerTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: surface.base, paddingHorizontal: cx.space.screenH }, style as ViewStyle]}
      {...props}
    />
  );
}
