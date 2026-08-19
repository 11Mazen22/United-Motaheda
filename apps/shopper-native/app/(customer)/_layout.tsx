import React from 'react';
import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="checkout" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(shop)/deals" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="(shop)/featured" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
