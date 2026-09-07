import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveOrderBanner } from '@/components/ui/ActiveOrderBanner';
// Import any other existing imports

export default function CustomerLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 🆕 Active Order Banner - Floating on top of everything */}
        <ActiveOrderBanner />
        
        {/* Main content */}
        <View style={styles.content}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: {
                backgroundColor: '#FFFFFF',
              },
            }}
          >
            {/* Your existing screens */}
            <Stack.Screen name="index" />
            <Stack.Screen name="orders" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="cart" />
            <Stack.Screen name="checkout" />
            {/* Add any other screens you have */}
          </Stack>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
});