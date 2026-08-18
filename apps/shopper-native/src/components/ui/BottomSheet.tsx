import React from 'react';
import { Modal, View, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const c = useDarkColors();
  const [anim] = React.useState(new Animated.Value(SCREEN_HEIGHT));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
    } else {
      Animated.timing(anim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible, anim]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={[styles.overlay, { backgroundColor: c.neutralOverlay }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close bottom sheet" />
        <Animated.View style={[styles.sheet, { backgroundColor: c.surface, transform: [{ translateY: anim }] }]}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: c.line }]} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopStartRadius: kit.radius.sheet,
    borderTopEndRadius: kit.radius.sheet,
    padding: kit.sp(5),
    paddingTop: kit.sp(2),
    minHeight: 200,
    ...kit.shadow.floating,
  },
  handleContainer: { alignItems: 'center', paddingVertical: kit.sp(3), marginBottom: kit.sp(2) },
  handle: { width: 40, height: 4, borderRadius: 2 },
});
