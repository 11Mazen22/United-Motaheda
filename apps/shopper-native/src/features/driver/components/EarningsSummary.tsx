import React, { useMemo, useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text as UIText } from '@pharmacy/ui-native';
import { kit } from '@pharmacy/ui-native';
import { formatPrice } from '@/utils/format';

export default function EarningsSummary({ orders, offers }: { orders: any[]; offers: number }) {
  const earnings = useMemo(() => orders.reduce((s, o) => s + Number(o.total ?? 0), 0), [orders]);
  const completed = useMemo(() => orders.filter((o) => o.status === 'delivered').length, [orders]);
  const acceptanceRate = useMemo(() => Math.round((orders.length / Math.max(offers, 1)) * 100), [orders.length, offers]);

  const scale = useMemo(() => new Animated.Value(0.95), []);
  useEffect(() => { Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 10 }).start(); }, [scale, earnings]);

  return (
    <Animated.View style={[es.wrap, { transform: [{ scale }] }]}>
      <View style={es.tile}><UIText style={es.value}>{formatPrice(earnings)}</UIText><UIText style={es.label}>Earnings</UIText></View>
      <View style={es.tile}><UIText style={es.value}>{completed}</UIText><UIText style={es.label}>Completed</UIText></View>
      <View style={es.tile}><UIText style={es.value}>{acceptanceRate}%</UIText><UIText style={es.label}>Acceptance</UIText></View>
    </Animated.View>
  );
}

const es = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  tile: { alignItems: 'center' },
  value: { fontSize: 16, color: kit.color.onInk, fontFamily: 'Cairo-Bold' },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
});
