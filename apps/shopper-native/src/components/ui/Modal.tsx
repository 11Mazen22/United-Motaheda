import React from 'react';
import { Modal as RNModal, View, StyleSheet, Pressable, Text } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ visible, onClose, title, children }: ModalProps) {
  const c = useDarkColors();

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: c.neutralOverlay }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close modal" />
        <View style={[styles.content, { backgroundColor: c.surface, ...kit.shadow.overlay }]}>
          {title && <Text style={[styles.title, { color: c.ink }]}>{title}</Text>}
          {children}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kit.sp(5),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    width: '100%',
    borderRadius: kit.radius.lg,
    padding: kit.sp(5),
  },
  title: {
    ...kit.type.title,
    fontFamily: kit.font.bold,
    marginBottom: kit.sp(4),
  }
});
