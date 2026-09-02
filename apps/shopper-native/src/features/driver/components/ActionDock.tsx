import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { kit } from '@pharmacy/ui-native';

export function ActionDock({ children, pagePad = kit.inset.screen }: { children: React.ReactNode; pagePad?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: pagePad }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
});

export default ActionDock;
