import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  const c = useDarkColors();

  return (
    <View style={[styles.container, { backgroundColor: c.well }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={[styles.tab, isActive && { backgroundColor: c.surface, ...kit.shadow.raised }]}
            >
              <Text style={[styles.label, { color: isActive ? c.ink : c.inkSoft, fontFamily: isActive ? kit.font.bold : kit.font.medium }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    borderRadius: kit.radius.md,
    padding: 2,
  },
  scroll: {
    flexGrow: 1,
  },
  tab: {
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: kit.sp(3),
    borderRadius: kit.radius.sm,
  },
  label: {
    ...kit.type.body,
  }
});
