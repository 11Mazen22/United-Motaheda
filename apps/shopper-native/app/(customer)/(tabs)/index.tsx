import React, { useState } from "react";
import { StyleSheet, View, Platform, Dimensions, ScrollView, Pressable, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  useSharedValue, 
  interpolate, 
  Extrapolation,
  FadeInDown,
  FadeIn,
  SlideInUp
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CustomerUI, kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const { width, height } = Dimensions.get('window');
const IS_RTL = isRtl();

export default function LuxuryHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler((ev) => {
    scrollY.value = ev.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, height * 0.4], [0, 1], Extrapolation.CLAMP);
    return {
      backgroundColor: 
gba(255,255,255,),
      borderBottomWidth: opacity > 0.5 ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    };
  });

  const headerTextStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [height * 0.3, height * 0.4], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  const onSearch = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push("/(customer)/(shop)/search");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Floating Glass Header */}
      <Animated.View style={[styles.floatHeader, { paddingTop: insets.top, height: insets.top + 60 }, headerStyle]}>
        <View style={styles.headerContent}>
          <Ionicons name="menu-outline" size={28} color={kit.color.ink} />
          <Animated.View style={headerTextStyle}>
            <CustomerUI.Typography scale="navLabel" style={{ fontSize: 16, fontFamily: "Cairo_800ExtraBold", letterSpacing: 2 }}>
              UNITED
            </CustomerUI.Typography>
          </Animated.View>
          <Ionicons name="bag-outline" size={24} color={kit.color.ink} />
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Massive Editorial Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#08101a', '#1a2b3c', '#2c3e50']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Abstract geometric shapes could go here, for now use gradients */}
          
          <View style={[styles.heroContent, { paddingTop: insets.top + 40 }]}>
            <Animated.View entering={FadeIn.duration(1000).delay(200)}>
              <CustomerUI.Typography scale="navLabel" color="rgba(255,255,255,0.6)" style={styles.heroEyebrow}>
                CURATED WELLNESS
              </CustomerUI.Typography>
            </Animated.View>
            
            <Animated.View entering={FadeInDown.duration(1200).springify().damping(14)}>
              <CustomerUI.Typography scale="screenTitle" color="white" style={styles.heroTitle}>
                Elevate Your Health.
              </CustomerUI.Typography>
            </Animated.View>

            {/* Premium Floating Search */}
            <Animated.View entering={SlideInUp.duration(800).delay(400).springify()}>
              <Pressable onPress={onSearch} style={styles.premiumSearch}>
                <View style={[styles.premiumSearchInner, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons name="search" size={22} color="rgba(255,255,255,0.5)" />
                  <CustomerUI.Typography scale="productMeta" color="rgba(255,255,255,0.7)" style={{ marginHorizontal: 16, flex: 1, textAlign: textAlignStart(IS_RTL) }}>
                    Discover premium care...
                  </CustomerUI.Typography>
                  <View style={styles.scanIcon}>
                    <Ionicons name="scan" size={20} color="white" />
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* Editorial Categories */}
        <View style={styles.editorialFeed}>
          <View style={styles.sectionHeader}>
            <CustomerUI.Typography scale="screenTitle" style={{ fontSize: 24, fontFamily: "Cairo_900Black" }}>
              The Collection
            </CustomerUI.Typography>
          </View>

          <View style={styles.bentoGrid}>
            <Pressable style={[styles.bentoItem, styles.bentoLarge, { backgroundColor: '#f0f4f8' }]}>
              <CustomerUI.Typography scale="screenTitle" color="brand" style={styles.bentoTitle}>Skincare</CustomerUI.Typography>
              <Ionicons name="sparkles" size={40} color={kit.color.brand} style={styles.bentoIcon} />
            </Pressable>
            <View style={styles.bentoColumn}>
              <Pressable style={[styles.bentoItem, styles.bentoSmall, { backgroundColor: '#fff0f5' }]}>
                <CustomerUI.Typography scale="sectionHead" color="brand" style={styles.bentoTitle}>Vitamins</CustomerUI.Typography>
                <Ionicons name="leaf" size={28} color="#ec4899" style={styles.bentoIcon} />
              </Pressable>
              <Pressable style={[styles.bentoItem, styles.bentoSmall, { backgroundColor: '#f0fdf4' }]}>
                <CustomerUI.Typography scale="sectionHead" color="brand" style={styles.bentoTitle}>Pharmacy</CustomerUI.Typography>
                <Ionicons name="medical" size={28} color="#22c55e" style={styles.bentoIcon} />
              </Pressable>
            </View>
          </View>

          {/* Luxury Banner */}
          <View style={styles.luxuryBanner}>
            <LinearGradient
              colors={['#8B5CF6', '#D946EF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <CustomerUI.Typography scale="sectionHead" color="white" style={{ fontFamily: "Cairo_800ExtraBold" }}>
              Prescriptions, Delivered.
            </CustomerUI.Typography>
            <CustomerUI.Typography scale="productMeta" color="rgba(255,255,255,0.8)" style={{ marginTop: 8 }}>
              Upload your prescription and receive it at your doorstep within 30 minutes.
            </CustomerUI.Typography>
            <Pressable style={styles.whiteBtn} onPress={() => router.push("/(customer)/prescriptions/scan")}>
              <CustomerUI.Typography scale="buttonMd" color="brand">Upload Now</CustomerUI.Typography>
            </Pressable>
          </View>
        </View>

      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  floatHeader: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 100,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  heroSection: {
    height: height * 0.65,
    width: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  heroContent: {
    paddingHorizontal: 24,
  },
  heroEyebrow: {
    letterSpacing: 4,
    fontSize: 12,
    marginBottom: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  heroTitle: {
    fontSize: 56,
    lineHeight: 64,
    fontFamily: "Cairo_900Black",
    letterSpacing: -2,
    marginBottom: 48,
  },
  premiumSearch: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    padding: 8,
    backdropFilter: 'blur(10px)', // web only, but visually on mobile we use semi-transparent
  },
  premiumSearchInner: {
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
  },
  scanIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 16,
  },
  editorialFeed: {
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 32,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  bentoGrid: {
    flexDirection: 'row',
    height: 280,
    gap: 16,
  },
  bentoItem: {
    borderRadius: 32,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  bentoLarge: {
    flex: 1.2,
  },
  bentoColumn: {
    flex: 1,
    gap: 16,
  },
  bentoSmall: {
    flex: 1,
    padding: 20,
  },
  bentoTitle: {
    fontFamily: "Cairo_800ExtraBold",
  },
  bentoIcon: {
    alignSelf: 'flex-end',
    opacity: 0.8,
  },
  luxuryBanner: {
    borderRadius: 32,
    padding: 32,
    overflow: 'hidden',
    marginTop: 16,
  },
  whiteBtn: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginTop: 24,
  }
});