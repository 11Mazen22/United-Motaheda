import os
import re

# 1. apps/shopper-native/app/(customer)/(account)/order/track/[id].tsx
f1 = 'apps/shopper-native/app/(customer)/(account)/order/track/[id].tsx'
content1 = open(f1, 'r', encoding='utf-8').read()
content1 = content1.replace('import { TrackOrderScreen }', 'import TrackOrderScreen')
with open(f1, 'w', encoding='utf-8') as f: f.write(content1)

# 2. apps/shopper-native/src/features/orders/screens/TrackOrderScreen.tsx
f2 = 'apps/shopper-native/src/features/orders/screens/TrackOrderScreen.tsx'
content2 = open(f2, 'r', encoding='utf-8').read()
content2 = content2.replace('import React, { useMemo } from "react";', 'import React, { useMemo, useEffect } from "react";')
content2 = content2.replace(', useEffect } from "react-native-reanimated";', ' } from "react-native-reanimated";')
with open(f2, 'w', encoding='utf-8') as f: f.write(content2)

# 3. apps/shopper-native/app/(customer)/(shop)/deals.tsx
f3 = 'apps/shopper-native/app/(customer)/(shop)/deals.tsx'
content3 = open(f3, 'r', encoding='utf-8').read()
content3 = content3.replace('import { ProductCardSkeleton } from "@/components/ProductCard";', '')
content3 = content3.replace('<ProductCardSkeleton', '<SkeletonCard')
if 'import { SkeletonCard }' not in content3:
    content3 = content3.replace('import { ProductCard } from "@/components/ProductCard";', 'import { ProductCard } from "@/components/ProductCard";\nimport { SkeletonCard } from "@pharmacy/ui-native";')
with open(f3, 'w', encoding='utf-8') as f: f.write(content3)

# 4. apps/shopper-native/src/features/home/components/FeaturedSection.tsx
f4 = 'apps/shopper-native/src/features/home/components/FeaturedSection.tsx'
content4 = open(f4, 'r', encoding='utf-8').read()
content4 = content4.replace('import { ProductCardSkeleton } from "@/components/ProductCard";', '')
content4 = content4.replace('<ProductCardSkeleton', '<SkeletonCard')
if 'import { SkeletonCard }' not in content4:
    content4 = content4.replace('import { ProductCard } from "@/components/ProductCard";', 'import { ProductCard } from "@/components/ProductCard";\nimport { SkeletonCard } from "@pharmacy/ui-native";')
with open(f4, 'w', encoding='utf-8') as f: f.write(content4)

# 5. apps/shopper-native/src/features/pharmacist/components/StatCard.tsx
f5 = 'apps/shopper-native/src/features/pharmacist/components/StatCard.tsx'
content5 = open(f5, 'r', encoding='utf-8').read()
content5 = content5.replace('import { StyleSheet, View, Text as RNText, type StyleProp, type ViewStyle } from "react-native";', 'import { StyleSheet, View, Text as RNText, StyleProp, ViewStyle } from "react-native";')
with open(f5, 'w', encoding='utf-8') as f: f.write(content5)

# 6. apps/shopper-native/app/(auth)/register.tsx
f6 = 'apps/shopper-native/app/(auth)/register.tsx'
content6 = open(f6, 'r', encoding='utf-8').read()
# Just remove register from the import since it's not exported
content6 = content6.replace('import { useAuth, register } from "@/features/auth";', 'import { useAuth } from "@/features/auth";')
with open(f6, 'w', encoding='utf-8') as f: f.write(content6)

