import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kit } from '@pharmacy/ui-native';

export function ActionDock({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }] as any}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: kit.inset.screen,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
});

export default ActionDock;
